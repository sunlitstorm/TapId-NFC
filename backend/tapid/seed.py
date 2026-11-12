"""Idempotent seed: admin from env, demo buildings and two demo students."""
import secrets
from datetime import datetime, timezone

from .config import settings
from .db import db
from .models import AccessPermission, Administrator, Building, Credential, Student
from .security import hash_password

BUILDINGS = [
    ("Main Library", "LIB", "Open 24/7 study commons"),
    ("Engineering Hall", "ENG", "Labs, lecture theatres and maker space"),
    ("Science Research Lab", "SCI", "Restricted laboratory wing"),
    ("Recreation Center", "REC", "Gym, pool and courts"),
    ("North Residence Hall", "RES", "Student housing - residents only"),
]


async def seed() -> None:
    now = datetime.now(timezone.utc)
    admin = Administrator(email=settings.admin_email, password_hash=hash_password(settings.admin_password),
                          full_name="Campus Security Admin", created_at=now)
    await db.administrators.update_one({"email": admin.email}, {"$setOnInsert": admin.to_mongo()}, upsert=True)

    for name, code, desc in BUILDINGS:
        b = Building(name=name, code=code, description=desc, created_at=now)
        await db.buildings.update_one({"code": code}, {"$setOnInsert": b.to_mongo()}, upsert=True)

    if not await db.students.find_one({"email": "student@tapid.edu"}):
        s = Student(email="student@tapid.edu", password_hash=hash_password(settings.demo_student_password),
                    full_name="Alex Morgan", student_number="S2026001", program="BSc Computer Science",
                    enrollment_status="active", created_at=now)
        sid = str((await db.students.insert_one(s.to_mongo())).inserted_id)
        c = Credential(student_id=sid, credential_uid="TID-" + secrets.token_hex(6).upper(), issued_at=now)
        await db.credentials.insert_one(c.to_mongo())
        async for b in db.buildings.find({"code": {"$in": ["LIB", "ENG", "REC"]}}):
            p = AccessPermission(student_id=sid, building_id=str(b["_id"]), granted_at=now)
            await db.access_permissions.insert_one(p.to_mongo())

    if not await db.students.find_one({"email": "pending@tapid.edu"}):
        s = Student(email="pending@tapid.edu", password_hash=hash_password(settings.demo_student_password),
                    full_name="Jordan Lee", student_number="S2026002", program="BA Economics",
                    enrollment_status="pending", created_at=now)
        await db.students.insert_one(s.to_mongo())
