"""Password hashing, access JWTs and role-based authorization dependencies."""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from bson import ObjectId
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings
from .db import db

ISSUER = "tapid"
COLLECTION = {"student": "students", "admin": "administrators"}
bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


DUMMY_HASH = hash_password("timing-equaliser-not-a-password")


def create_access_token(user_id: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        "sub": user_id,
        "role": role,
        "typ": "access",
        "iss": ISSUER,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(claims, settings.jwt_secret, algorithm="HS256")


@dataclass
class Principal:
    id: str
    role: str
    doc: dict


def _unauthorized() -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session", headers={"WWW-Authenticate": "Bearer"})


async def principal_from_token(token: str | None) -> Principal:
    if not token:
        raise _unauthorized()
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=["HS256"], issuer=ISSUER,
            options={"require": ["sub", "exp", "iss", "role"]},
        )
    except jwt.InvalidTokenError:
        raise _unauthorized()
    role, sub = payload.get("role"), payload.get("sub")
    if payload.get("typ") != "access" or role not in COLLECTION or not ObjectId.is_valid(sub):
        raise _unauthorized()
    # Role is re-checked against the database on every request (collection membership).
    doc = await db[COLLECTION[role]].find_one({"_id": ObjectId(sub)})
    if not doc:
        raise _unauthorized()
    return Principal(id=str(doc["_id"]), role=role, doc=doc)


async def get_principal(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> Principal:
    return await principal_from_token(creds.credentials if creds else None)


async def get_principal_header_or_query(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    token: str | None = Query(default=None, max_length=2048),
) -> Principal:
    """For media reads: <img> on web cannot send headers, so accept ?token= as well."""
    return await principal_from_token(creds.credentials if creds else token)


def require_role(role: str):
    async def dependency(principal: Principal = Depends(get_principal)) -> Principal:
        if principal.role != role:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return principal

    return dependency


require_admin = require_role("admin")
require_student = require_role("student")
