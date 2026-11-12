"""Emergent managed object storage (student photos)."""
import logging
import os

import requests

from .config import settings

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
_storage_key: str | None = None
log = logging.getLogger(__name__)


def init_storage() -> str:
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": settings.emergent_key}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _with_retry(fn):
    global _storage_key
    try:
        return fn(init_storage())
    except requests.HTTPError as exc:
        if exc.response is not None and exc.response.status_code == 503:
            _storage_key = None
            return fn(init_storage())
        raise


def put_object(path: str, data: bytes, content_type: str) -> dict:
    def call(key: str):
        r = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
        r.raise_for_status()
        return r.json()

    return _with_retry(call)


def get_object(path: str) -> tuple[bytes, str]:
    def call(key: str):
        r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
        r.raise_for_status()
        return r.content, r.headers.get("Content-Type", "application/octet-stream")

    return _with_retry(call)
