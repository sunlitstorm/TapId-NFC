from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pymongo.errors import DuplicateKeyError

from ..db import db
from ..models import Administrator, LoginIn, RegisterIn, Student
from ..security import DUMMY_HASH, Principal, create_access_token, get_principal, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def principal_public(role: str, doc: dict) -> dict:
    model = Student if role == "student" else Administrator
    return {"role": role, **model.from_mongo(doc).public()}


@router.post("/register", status_code=201)
async def register(body: RegisterIn):
    student = Student(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        student_number=body.student_number.upper(),
        program=body.program,
        enrollment_status="pending",
        created_at=datetime.now(timezone.utc),
    )
    if await db.administrators.find_one({"email": student.email}):
        raise HTTPException(409, "Email is already registered")
    try:
        result = await db.students.insert_one(student.to_mongo())
    except DuplicateKeyError as exc:
        field = "Student number" if "student_number" in str(exc) else "Email"
        raise HTTPException(409, f"{field} is already registered")
    doc = await db.students.find_one({"_id": result.inserted_id})
    return {"access_token": create_access_token(str(result.inserted_id), "student"), "user": principal_public("student", doc)}


@router.post("/login")
async def login(body: LoginIn):
    email = body.email.lower()
    role, doc = "admin", await db.administrators.find_one({"email": email})
    if not doc:
        role, doc = "student", await db.students.find_one({"email": email})
    if not doc:
        verify_password(body.password, DUMMY_HASH)
        raise HTTPException(401, "Incorrect email or password")
    if not verify_password(body.password, doc["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")
    return {"access_token": create_access_token(str(doc["_id"]), role), "user": principal_public(role, doc)}


@router.get("/me")
async def me(principal: Principal = Depends(get_principal)):
    return principal_public(principal.role, principal.doc)
