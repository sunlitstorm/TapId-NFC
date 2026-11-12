"""TapID API entrypoint - assembles routers; business logic lives in the tapid package."""
import logging

from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool
from starlette.middleware.cors import CORSMiddleware

from tapid.db import client, ensure_indexes
from tapid.routers import admin, auth, files, student, verify
from tapid.seed import seed
from tapid.storage import init_storage

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("tapid")

app = FastAPI(title="TapID API", version="1.0.0")


@app.get("/health", include_in_schema=False)
@app.head("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


@app.get("/api/")
async def root():
    return {"service": "TapID", "nfc_mode": "simulated", "status": "ok"}


for module in (auth, student, admin, verify, files):
    app.include_router(module.router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    # Awaited (not background): unique indexes back replay protection & uniqueness rules.
    await ensure_indexes()
    await seed()
    try:
        await run_in_threadpool(init_storage)
    except Exception as exc:
        logger.error("Object storage init failed: %s", exc)


@app.on_event("shutdown")
async def shutdown():
    client.close()
