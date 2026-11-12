"""Short-lived, single-use credential tokens presented over NFC (or QR fallback).

Pure functions - no database access - so they can be unit tested in isolation.

Token = HS256 JWT signed with a key derived from JWT_SECRET (domain-separated so a
session token can never be used as a tap token, and vice versa). Each token embeds a
random nonce; the verification service consumes the nonce exactly once.
"""
import hashlib
import secrets
import time

import jwt

TAP_TYP = "tap"
REQUIRED = ["typ", "cid", "uid", "sid", "nonce", "iat", "exp"]


class TapTokenError(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def _derive_key(secret: str) -> str:
    return hashlib.sha256(f"tapid-tap-token::{secret}".encode()).hexdigest()


def mint_tap_token(secret: str, *, credential_id: str, credential_uid: str, student_id: str, ttl_seconds: int, now: float | None = None) -> dict:
    issued = int(now if now is not None else time.time())
    nonce = secrets.token_urlsafe(18)
    claims = {
        "typ": TAP_TYP,
        "cid": credential_id,
        "uid": credential_uid,
        "sid": student_id,
        "nonce": nonce,
        "iat": issued,
        "exp": issued + ttl_seconds,
    }
    token = jwt.encode(claims, _derive_key(secret), algorithm="HS256")
    return {"token": token, "nonce": nonce, "expires_at": claims["exp"], "ttl_seconds": ttl_seconds}


def decode_tap_token(secret: str, token: str, now: float | None = None) -> dict:
    try:
        claims = jwt.decode(
            token,
            _derive_key(secret),
            algorithms=["HS256"],
            options={"require": ["exp", "iat"], "verify_exp": False},
        )
    except jwt.InvalidTokenError:
        raise TapTokenError("invalid_token")
    if claims.get("typ") != TAP_TYP or any(k not in claims for k in REQUIRED):
        raise TapTokenError("invalid_token")
    current = now if now is not None else time.time()
    if current >= claims["exp"]:
        raise TapTokenError("token_expired")
    if claims["iat"] > current + 5:  # issued in the future -> clock tampering
        raise TapTokenError("invalid_token")
    return claims
