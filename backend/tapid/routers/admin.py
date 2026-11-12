"""Administrator dashboard API."""
import re
import secrets
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.errors import DuplicateKeyError

from ..config import settings
from ..db import db
from ..models import (
    AccessPermission, Building, BuildingIn, Credential, EnrollmentIn, IssueIn,
    PermissionsIn, SimulateIn, Student, TapIn, VerificationLog, REASON_MESSAGES,
)
from ..readers import ADMIN_CONSOLE_SIMULATOR
from ..security import Principal, require_admin
from ..services.tap_tokens import mint_tap_token
from ..services.verification import verify_tap

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def oid_or_404(value: str, what: str = "Resource") -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(404, f"{what} not found")
    return ObjectId(value)


async def get_student_or_404(student_id: str) -> Student:
    doc = await db.students.find_one({"_id": oid_or_404(student_id, "Student")})
    if not doc:
        raise HTTPException(404, "Student not found")
    return Student.from_mongo(doc)


def new_credential_uid() -> str:
    return "TID-" + secrets.token_hex(6).upper()


# ------------------------------------------------------------------ students
@router.get("/students")
async def list_students(
    q: str = Query("", max_length=80),
    status: str = Query("all", pattern="^(all|pending|active|suspended|graduated)$"),
    limit: int = Query(100, ge=1, le=500),
):
    query: dict = {}
    if status != "all":
        query["enrollment_status"] = status
    if q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"full_name": rx}, {"email": rx}, {"student_number": rx}, {"program": rx}]
    students = [Student.from_mongo(d) async for d in db.students.find(query).sort("created_at", -1).limit(limit)]
    ids = [s.id for s in students]
    active = {d["student_id"] async for d in db.credentials.find({"student_id": {"$in": ids}, "status": "active"}, {"student_id": 1})}
    return [{**s.public(), "has_active_credential": s.id in active} for s in students]


@router.get("/students/{student_id}")
async def student_detail(student_id: str):
    student = await get_student_or_404(student_id)
    creds = [Credential.from_mongo(d).public() async for d in db.credentials.find({"student_id": student.id}).sort("issued_at", -1)]
    permitted = [d["building_id"] async for d in db.access_permissions.find({"student_id": student.id})]
    logs = [VerificationLog.from_mongo(d).public() async for d in db.verification_logs.find({"student_id": student.id}).sort("created_at", -1).limit(10)]
    return {"student": student.public(), "credentials": creds, "permitted_building_ids": permitted, "recent_logs": logs}


@router.patch("/students/{student_id}")
async def update_enrollment(student_id: str, body: EnrollmentIn):
    student = await get_student_or_404(student_id)
    await db.students.update_one({"_id": ObjectId(student.id)}, {"$set": {"enrollment_status": body.enrollment_status}})
    return Student.from_mongo(await db.students.find_one({"_id": ObjectId(student.id)})).public()


@router.post("/students/{student_id}/credential", status_code=201)
async def issue_credential(student_id: str, body: IssueIn, admin: Principal = Depends(require_admin)):
    student = await get_student_or_404(student_id)
    if student.enrollment_status != "active":
        raise HTTPException(409, "Student must be actively enrolled before an ID can be issued")
    credential = Credential(
        student_id=student.id, credential_uid=new_credential_uid(), device_label=body.device_label,
        issued_at=datetime.now(timezone.utc), issued_by=admin.id,
    )
    try:
        result = await db.credentials.insert_one(credential.to_mongo())
    except DuplicateKeyError:
        raise HTTPException(409, "Student already has an active credential - revoke it first")
    return Credential.from_mongo(await db.credentials.find_one({"_id": result.inserted_id})).public()


@router.post("/students/{student_id}/credential/revoke")
async def revoke_credential(student_id: str):
    student = await get_student_or_404(student_id)
    doc = await db.credentials.find_one_and_update(
        {"student_id": student.id, "status": "active"},
        {"$set": {"status": "revoked", "revoked_at": datetime.now(timezone.utc), "revoke_reason": "admin_revoked"}},
        return_document=True,
    )
    if not doc:
        raise HTTPException(409, "No active credential to revoke")
    return Credential.from_mongo(doc).public()


@router.put("/students/{student_id}/permissions")
async def set_permissions(student_id: str, body: PermissionsIn, admin: Principal = Depends(require_admin)):
    student = await get_student_or_404(student_id)
    wanted = set(body.building_ids)
    if any(not ObjectId.is_valid(b) for b in wanted):
        raise HTTPException(422, "Invalid building id")
    existing = {d["_id"]: 0 async for d in db.buildings.find({"_id": {"$in": [ObjectId(b) for b in wanted]}}, {"_id": 1})}
    if len(existing) != len(wanted):
        raise HTTPException(422, "One or more buildings do not exist")
    await db.access_permissions.delete_many({"student_id": student.id, "building_id": {"$nin": list(wanted)}})
    now = datetime.now(timezone.utc)
    for bid in wanted:
        perm = AccessPermission(student_id=student.id, building_id=bid, granted_by=admin.id, granted_at=now)
        await db.access_permissions.update_one(
            {"student_id": student.id, "building_id": bid}, {"$setOnInsert": perm.to_mongo()}, upsert=True,
        )
    return {"permitted_building_ids": sorted(wanted)}


# ------------------------------------------------------------------ buildings
@router.get("/buildings")
async def list_buildings():
    counts: dict[str, int] = {}
    async for row in db.access_permissions.aggregate([{"$group": {"_id": "$building_id", "n": {"$sum": 1}}}]):
        counts[row["_id"]] = row["n"]
    return [{**Building.from_mongo(d).public(), "permitted_students": counts.get(str(d["_id"]), 0)} async for d in db.buildings.find().sort("name", 1)]


@router.post("/buildings", status_code=201)
async def create_building(body: BuildingIn):
    building = Building(name=body.name.strip(), code=body.code.upper(), description=body.description.strip(), created_at=datetime.now(timezone.utc))
    try:
        result = await db.buildings.insert_one(building.to_mongo())
    except DuplicateKeyError:
        raise HTTPException(409, "Building code already exists")
    return Building.from_mongo(await db.buildings.find_one({"_id": result.inserted_id})).public()


# ------------------------------------------------------------------ logs
@router.get("/logs")
async def list_logs(
    result: str = Query("all", pattern="^(all|granted|denied)$"),
    building_id: str = Query("", max_length=24),
    q: str = Query("", max_length=80),
    limit: int = Query(100, ge=1, le=500),
):
    query: dict = {}
    if result != "all":
        query["result"] = result
    if building_id:
        query["building_id"] = building_id
    if q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"student_name": rx}, {"student_number": rx}, {"building_name": rx}, {"reason": rx}]
    return [VerificationLog.from_mongo(d).public() async for d in db.verification_logs.find(query).sort("created_at", -1).limit(limit)]


# ------------------------------------------------------------------ analytics
@router.get("/analytics")
async def analytics():
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    since = today - timedelta(days=6)
    logs = await db.verification_logs.find(
        {"created_at": {"$gte": since}}, {"result": 1, "reason": 1, "building_name": 1, "created_at": 1}
    ).to_list(50000)

    daily = {(since + timedelta(days=i)).date().isoformat(): {"granted": 0, "denied": 0} for i in range(7)}
    by_building: dict[str, dict] = {}
    reasons: dict[str, int] = {}
    for log in logs:
        day = log["created_at"].astimezone(timezone.utc).date().isoformat()
        if day in daily:
            daily[day][log["result"]] += 1
        name = log.get("building_name") or "Unknown"
        by_building.setdefault(name, {"granted": 0, "denied": 0})[log["result"]] += 1
        if log["result"] == "denied":
            reasons[log["reason"]] = reasons.get(log["reason"], 0) + 1

    status_counts = {s: 0 for s in ("pending", "active", "suspended", "graduated")}
    async for row in db.students.aggregate([{"$group": {"_id": "$enrollment_status", "n": {"$sum": 1}}}]):
        status_counts[row["_id"]] = row["n"]
    today_key = today.date().isoformat()
    recent_denied = [VerificationLog.from_mongo(d).public() async for d in db.verification_logs.find({"result": "denied"}).sort("created_at", -1).limit(5)]
    return {
        "totals": {
            "students": sum(status_counts.values()),
            "students_by_status": status_counts,
            "active_credentials": await db.credentials.count_documents({"status": "active"}),
            "revoked_credentials": await db.credentials.count_documents({"status": "revoked"}),
            "buildings": await db.buildings.count_documents({}),
            "granted_today": daily[today_key]["granted"],
            "denied_today": daily[today_key]["denied"],
            "attempts_7d": len(logs),
        },
        "daily": [{"date": d, **v} for d, v in daily.items()],
        "by_building": sorted(({"building": k, **v} for k, v in by_building.items()), key=lambda r: -(r["granted"] + r["denied"])),
        "denial_reasons": sorted(({"reason": k, "message": REASON_MESSAGES.get(k, k), "count": v} for k, v in reasons.items()), key=lambda r: -r["count"]),
        "recent_denied": recent_denied,
    }


# ------------------------------------------------------------------ simulated reader console
@router.get("/credentials/active")
async def active_credentials():
    creds = [Credential.from_mongo(d) async for d in db.credentials.find({"status": "active"}).sort("issued_at", -1).limit(200)]
    students = {str(d["_id"]): Student.from_mongo(d) async for d in db.students.find({"_id": {"$in": [ObjectId(c.student_id) for c in creds]}})}
    return [
        {**c.public(), "student_name": students[c.student_id].full_name, "student_number": students[c.student_id].student_number,
         "enrollment_status": students[c.student_id].enrollment_status}
        for c in creds if c.student_id in students
    ]


@router.post("/reader/simulate")
async def simulate_tap(body: SimulateIn):
    """SIMULATION ONLY: mints the token a phone would transmit, then runs real verification."""
    doc = await db.credentials.find_one({"_id": oid_or_404(body.credential_id, "Credential")})
    if not doc:
        raise HTTPException(404, "Credential not found")
    credential = Credential.from_mongo(doc)
    minted = mint_tap_token(
        settings.jwt_secret, credential_id=credential.id, credential_uid=credential.credential_uid,
        student_id=credential.student_id, ttl_seconds=settings.tap_token_ttl_seconds,
    )
    result = await verify_tap(db, secret=settings.jwt_secret, token=minted["token"], building_id=body.building_id,
                              reader_id=ADMIN_CONSOLE_SIMULATOR.reader_id, method="nfc")
    return {**result, "presented_token": minted["token"]}


@router.post("/reader/verify")
async def console_verify(body: TapIn):
    """Verify a raw token (e.g. pasted from a QR scan, or replaying a previous token)."""
    return await verify_tap(db, secret=settings.jwt_secret, token=body.token, building_id=body.building_id,
                            reader_id=ADMIN_CONSOLE_SIMULATOR.reader_id, method=body.method)
