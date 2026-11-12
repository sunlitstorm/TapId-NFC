"""Centralised settings. Every secret comes from backend/.env - nothing is hardcoded."""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")


class Settings:
    mongo_url: str = os.environ["MONGO_URL"]
    db_name: str = os.environ["DB_NAME"]
    jwt_secret: str = os.environ["JWT_SECRET"]
    access_token_minutes: int = int(os.environ["ACCESS_TOKEN_MINUTES"])
    tap_token_ttl_seconds: int = int(os.environ["NFC_TOKEN_TTL_SECONDS"])
    admin_email: str = os.environ["ADMIN_EMAIL"].lower()
    admin_password: str = os.environ["ADMIN_PASSWORD"]
    demo_student_password: str = os.environ["DEMO_STUDENT_PASSWORD"]
    reader_api_keys: set[str] = {k.strip() for k in os.environ["READER_API_KEYS"].split(",") if k.strip()}
    emergent_key: str | None = os.environ.get("EMERGENT_LLM_KEY")
    app_name: str = "tapid"


settings = Settings()
