"""Reader-facing verification endpoint (what door hardware would call).

Authenticated with an X-Reader-Key header (READER_API_KEYS in backend/.env).
"""
import hmac

from fastapi import APIRouter, Header, HTTPException

from ..config import settings
from ..db import db
from ..models import VerifyIn
from ..services.verification import verify_tap

router = APIRouter(prefix="/api", tags=["verification"])


def _reader_key_valid(key: str | None) -> bool:
    return bool(key) and any(hmac.compare_digest(key, k) for k in settings.reader_api_keys)


@router.post("/verify")
async def verify(body: VerifyIn, x_reader_key: str | None = Header(default=None)):
    if not _reader_key_valid(x_reader_key):
        raise HTTPException(401, "Reader is not authorised")
    return await verify_tap(db, secret=settings.jwt_secret, token=body.token, building_id=body.building_id,
                            reader_id=body.reader_id, method=body.method)
