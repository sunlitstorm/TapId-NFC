from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.concurrency import run_in_threadpool

from ..db import db
from ..security import Principal, get_principal_header_or_query
from ..storage import get_object

router = APIRouter(prefix="/api/files", tags=["files"])


@router.get("/students/{student_id}/photo")
async def student_photo(student_id: str, p: Principal = Depends(get_principal_header_or_query)):
    if p.role == "student" and p.id != student_id:
        raise HTTPException(403, "Insufficient permissions")
    doc = await db.students.find_one({"_id": ObjectId(student_id)}) if ObjectId.is_valid(student_id) else None
    if not doc or not doc.get("photo_path"):
        raise HTTPException(404, "Photo not found")
    try:
        data, content_type = await run_in_threadpool(get_object, doc["photo_path"])
    except Exception:
        raise HTTPException(503, "Photo storage unavailable")
    return Response(content=data, media_type=content_type, headers={"Cache-Control": "private, max-age=86400"})
