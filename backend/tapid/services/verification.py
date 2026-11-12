"""Credential verification pipeline. Every attempt - granted or denied - is logged.

Order of checks:
  1. signature / structure / expiry of the tap token
  2. nonce single-use (atomic insert into a unique index -> replay protection)
  3. building exists
  4. credential exists, matches uid, and is active
  5. student exists and is actively enrolled
  6. student has an access permission for the building
"""
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from ..models import REASON_MESSAGES, Building, Credential, Student, VerificationLog
from .tap_tokens import TapTokenError, decode_tap_token


def _oid(value) -> ObjectId | None:
    return ObjectId(value) if isinstance(value, str) and ObjectId.is_valid(value) else None


async def verify_tap(db, *, secret: str, token: str, building_id: str, reader_id: str, method: str) -> dict:
    now = datetime.now(timezone.utc)
    log = VerificationLog(reader_id=reader_id, method=method, created_at=now)
    building = Building.from_mongo(await db.buildings.find_one({"_id": _oid(building_id)})) if _oid(building_id) else None
    if building:
        log.building_id, log.building_name = building.id, building.name
    student: Student | None = None

    async def finish(reason: str) -> dict:
        log.reason = reason
        log.result = "granted" if reason == "granted" else "denied"
        if student:
            log.student_id, log.student_name, log.student_number = student.id, student.full_name, student.student_number
        inserted = await db.verification_logs.insert_one(log.to_mongo())
        return {
            "granted": log.result == "granted",
            "result": log.result,
            "reason": reason,
            "message": REASON_MESSAGES[reason],
            "building": building.public() if building else None,
            "student": {"id": student.id, "full_name": student.full_name, "student_number": student.student_number} if student else None,
            "reader_id": reader_id,
            "method": method,
            "verified_at": now.isoformat(),
            "log_id": str(inserted.inserted_id),
        }

    try:
        claims = decode_tap_token(secret, token, now=now.timestamp())
    except TapTokenError as exc:
        return await finish(exc.reason)

    log.nonce, log.credential_id = claims["nonce"], claims["cid"]
    sid = _oid(claims["sid"])
    student = Student.from_mongo(await db.students.find_one({"_id": sid})) if sid else None

    try:
        await db.used_nonces.insert_one({
            "nonce": claims["nonce"],
            "used_at": now,
            "expires_at": datetime.fromtimestamp(claims["exp"], tz=timezone.utc) + timedelta(minutes=10),
        })
    except DuplicateKeyError:
        return await finish("replay_detected")

    if not building:
        return await finish("building_not_found")

    cid = _oid(claims["cid"])
    credential = Credential.from_mongo(await db.credentials.find_one({"_id": cid})) if cid else None
    if not credential or credential.credential_uid != claims["uid"]:
        return await finish("credential_not_found")
    if credential.status != "active":
        return await finish("credential_revoked")
    if not student or student.id != credential.student_id:
        return await finish("student_not_found")
    if student.enrollment_status != "active":
        return await finish("not_enrolled")
    permission = await db.access_permissions.find_one({"student_id": student.id, "building_id": building.id})
    if not permission:
        return await finish("no_permission")
    return await finish("granted")
