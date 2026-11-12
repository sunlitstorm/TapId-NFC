"""Endpoints for the signed-in student (the mobile wallet)."""
import uuid
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.concurrency import run_in_threadpool

from ..config import settings
from ..db import db
from ..models import Building, Credential, RevokeIn, Student, TapIn, VerificationLog
from ..readers import STUDENT_APP_SIMULATOR
from ..security import Principal, require_student
from ..services.tap_tokens import decode_tap_token, TapTokenError, mint_tap_token
from ..services.verification import verify_tap
from ..storage import put_object

router = APIRouter(prefix="/api/me", tags=["student"])
MAX_PHOTO_BYTES = 5 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic"}


async def active_credential(student_id: str) -> Credential | None:
    return Credential.from_mongo(await db.credentials.find_one({"student_id": student_id, "status": "active"}))


async def latest_credential(student_id: str) -> Credential | None:
    return Credential.from_mongo(await db.credentials.find_one({"student_id": student_id}, sort=[("issued_at", -1)]))


@router.get("")
async def my_profile(p: Principal = Depends(require_student)):
    student = Student.from_mongo(p.doc)
    credential = await latest_credential(p.id)
    permitted = {d["building_id"] async for d in db.access_permissions.find({"student_id": p.id}, {"building_id": 1})}
    buildings = [Building.from_mongo(b) async for b in db.buildings.find().sort("name", 1)]
    return {
        "student": student.public(),
        "credential": credential.public() if credential else None,
        "buildings": [{**b.public(), "permitted": b.id in permitted} for b in buildings],
        "token_ttl_seconds": settings.tap_token_ttl_seconds,
    }


@router.post("/photo")
async def upload_photo(file: UploadFile = File(...), p: Principal = Depends(require_student)):
    ext = ALLOWED_TYPES.get((file.content_type or "").lower())
    if not ext:
        raise HTTPException(415, "Photo must be JPEG, PNG, WEBP or HEIC")
    data = await file.read()
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(413, "Photo must be under 5 MB")
    path = f"{settings.app_name}/uploads/{p.id}/{uuid.uuid4()}.{ext}"
    try:
        result = await run_in_threadpool(put_object, path, data, file.content_type)
    except Exception as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        raise HTTPException(503 if status != 402 else 402, "Photo storage is unavailable, try again later")
    await db.students.update_one({"_id": ObjectId(p.id)}, {"$set": {"photo_path": result["path"]}, "$inc": {"photo_version": 1}})
    doc = await db.students.find_one({"_id": ObjectId(p.id)})
    return Student.from_mongo(doc).public()


@router.post("/credential/token")
async def issue_tap_token(p: Principal = Depends(require_student)):
    """Mint a short-lived, single-use token the phone presents over NFC or QR."""
    credential = await active_credential(p.id)
    if not credential:
        raise HTTPException(409, "No active digital ID credential")
    return mint_tap_token(
        settings.jwt_secret,
        credential_id=credential.id,
        credential_uid=credential.credential_uid,
        student_id=p.id,
        ttl_seconds=settings.tap_token_ttl_seconds,
    )


@router.post("/credential/revoke")
async def revoke_my_credential(body: RevokeIn, p: Principal = Depends(require_student)):
    """Lost / stolen device: immediately invalidate the credential on every reader."""
    result = await db.credentials.find_one_and_update(
        {"student_id": p.id, "status": "active"},
        {"$set": {"status": "revoked", "revoked_at": datetime.now(timezone.utc), "revoke_reason": body.reason}},
        return_document=True,
    )
    if not result:
        raise HTTPException(409, "No active credential to revoke")
    return Credential.from_mongo(result).public()


@router.post("/simulated-tap")
async def simulated_tap(body: TapIn, p: Principal = Depends(require_student)):
    """SIMULATED reader: the app hands the token to this endpoint instead of real NFC hardware."""
    try:
        claims = decode_tap_token(settings.jwt_secret, body.token)
        if claims["sid"] != p.id:
            raise HTTPException(403, "Token does not belong to this student")
    except TapTokenError:
        pass  # invalid / expired tokens are still logged by the verification service
    return await verify_tap(
        db, secret=settings.jwt_secret, token=body.token, building_id=body.building_id,
        reader_id=STUDENT_APP_SIMULATOR.reader_id, method=body.method,
    )


@router.get("/history")
async def my_history(limit: int = Query(50, ge=1, le=200), p: Principal = Depends(require_student)):
    cursor = db.verification_logs.find({"student_id": p.id}).sort("created_at", -1).limit(limit)
    return [VerificationLog.from_mongo(d).public() async for d in cursor]
