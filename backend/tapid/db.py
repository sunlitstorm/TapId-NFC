"""MongoDB client + index definitions (the 'schema' enforced at the database level)."""
import logging

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

from .config import settings

client = AsyncIOMotorClient(settings.mongo_url, tz_aware=True)
db = client[settings.db_name]

INDEXES: dict[str, list[IndexModel]] = {
    "students": [
        IndexModel([("email", ASCENDING)], name="email_unique", unique=True),
        IndexModel([("student_number", ASCENDING)], name="student_number_unique", unique=True),
        IndexModel([("enrollment_status", ASCENDING)], name="enrollment_status"),
        IndexModel([("created_at", DESCENDING)], name="created_at_desc"),
    ],
    "administrators": [IndexModel([("email", ASCENDING)], name="email_unique", unique=True)],
    "credentials": [
        IndexModel([("credential_uid", ASCENDING)], name="uid_unique", unique=True),
        IndexModel([("student_id", ASCENDING), ("issued_at", DESCENDING)], name="student_issued"),
        # At most ONE active credential per student.
        IndexModel(
            [("student_id", ASCENDING)],
            name="one_active_per_student",
            unique=True,
            partialFilterExpression={"status": "active"},
        ),
    ],
    "buildings": [IndexModel([("code", ASCENDING)], name="code_unique", unique=True)],
    "access_permissions": [
        IndexModel([("student_id", ASCENDING), ("building_id", ASCENDING)], name="student_building_unique", unique=True),
        IndexModel([("building_id", ASCENDING)], name="building_id"),
    ],
    "verification_logs": [
        IndexModel([("created_at", DESCENDING)], name="created_at_desc"),
        IndexModel([("student_id", ASCENDING), ("created_at", DESCENDING)], name="student_created"),
        IndexModel([("building_id", ASCENDING), ("created_at", DESCENDING)], name="building_created"),
        IndexModel([("result", ASCENDING), ("created_at", DESCENDING)], name="result_created"),
    ],
    # Consumed tap-token nonces. Unique index = atomic replay protection; TTL purges old ones.
    "used_nonces": [
        IndexModel([("nonce", ASCENDING)], name="nonce_unique", unique=True),
        IndexModel([("expires_at", ASCENDING)], name="expires_ttl", expireAfterSeconds=0),
    ],
}


async def ensure_indexes() -> None:
    log = logging.getLogger(__name__)
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on one bad index
                log.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
