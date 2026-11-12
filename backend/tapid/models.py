"""Document models (one per normalized table) and request schemas with validation."""
from datetime import datetime
from typing import Annotated, Literal, Optional

from bson import ObjectId
from pydantic import BaseModel, BeforeValidator, ConfigDict, EmailStr, Field, field_validator

PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]

EnrollmentStatus = Literal["pending", "active", "suspended", "graduated"]
CredentialStatus = Literal["active", "revoked"]
VerifyMethod = Literal["nfc", "qr"]

REASON_MESSAGES: dict[str, str] = {
    "granted": "Access granted",
    "invalid_token": "Credential token is invalid or has been tampered with",
    "token_expired": "Credential token has expired - refresh and tap again",
    "replay_detected": "Token was already used - replay attempt blocked",
    "building_not_found": "Unknown building or reader location",
    "credential_not_found": "Credential not recognised",
    "credential_revoked": "Credential has been revoked",
    "student_not_found": "Student record not found",
    "not_enrolled": "Student is not actively enrolled",
    "no_permission": "No access permission for this building",
}


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    @classmethod
    def from_mongo(cls, doc: dict | None):
        return cls.model_validate(doc) if doc else None

    def to_mongo(self) -> dict:
        data = self.model_dump(by_alias=True)
        if data.get("_id") is None:
            data.pop("_id", None)
        else:
            data["_id"] = ObjectId(data["_id"])
        return data


class Student(BaseDocument):
    email: str
    password_hash: str
    full_name: str
    student_number: str
    program: str
    enrollment_status: EnrollmentStatus = "pending"
    photo_path: Optional[str] = None
    photo_version: int = 0
    created_at: datetime

    def public(self) -> dict:
        photo_url = f"/api/files/students/{self.id}/photo?v={self.photo_version}" if self.photo_path else None
        return {
            "id": self.id,
            "email": self.email,
            "full_name": self.full_name,
            "student_number": self.student_number,
            "program": self.program,
            "enrollment_status": self.enrollment_status,
            "photo_url": photo_url,
            "created_at": self.created_at.isoformat(),
        }


class Administrator(BaseDocument):
    email: str
    password_hash: str
    full_name: str
    created_at: datetime

    def public(self) -> dict:
        return {"id": self.id, "email": self.email, "full_name": self.full_name}


class Credential(BaseDocument):
    student_id: str
    credential_uid: str
    status: CredentialStatus = "active"
    device_label: str = "Primary mobile device"
    issued_at: datetime
    issued_by: Optional[str] = None
    revoked_at: Optional[datetime] = None
    revoke_reason: Optional[str] = None

    def public(self) -> dict:
        return {
            "id": self.id,
            "student_id": self.student_id,
            "credential_uid": self.credential_uid,
            "status": self.status,
            "device_label": self.device_label,
            "issued_at": self.issued_at.isoformat(),
            "revoked_at": self.revoked_at.isoformat() if self.revoked_at else None,
            "revoke_reason": self.revoke_reason,
        }


class Building(BaseDocument):
    name: str
    code: str
    description: str = ""
    created_at: datetime

    def public(self) -> dict:
        return {"id": self.id, "name": self.name, "code": self.code, "description": self.description}


class AccessPermission(BaseDocument):
    student_id: str
    building_id: str
    granted_by: Optional[str] = None
    granted_at: datetime


class VerificationLog(BaseDocument):
    student_id: Optional[str] = None
    student_name: Optional[str] = None
    student_number: Optional[str] = None
    credential_id: Optional[str] = None
    building_id: Optional[str] = None
    building_name: Optional[str] = None
    reader_id: str
    method: VerifyMethod
    result: Literal["granted", "denied"] = "denied"
    reason: str = ""
    nonce: Optional[str] = None
    created_at: datetime

    def public(self) -> dict:
        return {
            "id": self.id,
            "student_id": self.student_id,
            "student_name": self.student_name,
            "student_number": self.student_number,
            "credential_id": self.credential_id,
            "building_id": self.building_id,
            "building_name": self.building_name,
            "reader_id": self.reader_id,
            "method": self.method,
            "result": self.result,
            "reason": self.reason,
            "message": REASON_MESSAGES.get(self.reason, self.reason),
            "created_at": self.created_at.isoformat(),
        }


# ---------------------------------------------------------------- request schemas
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=120)
    student_number: str = Field(min_length=4, max_length=20, pattern=r"^[A-Za-z0-9-]+$")
    program: str = Field(min_length=2, max_length=120)

    @field_validator("full_name", "program", "student_number")
    @classmethod
    def strip(cls, v: str) -> str:
        return v.strip()


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RevokeIn(BaseModel):
    reason: Literal["lost_device", "stolen_device", "admin_revoked", "other"] = "lost_device"


class IssueIn(BaseModel):
    device_label: str = Field(default="Primary mobile device", min_length=2, max_length=60)


class EnrollmentIn(BaseModel):
    enrollment_status: EnrollmentStatus


class PermissionsIn(BaseModel):
    building_ids: list[str] = Field(max_length=200)


class BuildingIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    code: str = Field(min_length=2, max_length=10, pattern=r"^[A-Za-z0-9-]+$")
    description: str = Field(default="", max_length=200)


class TapIn(BaseModel):
    token: str = Field(min_length=20, max_length=2048)
    building_id: str = Field(min_length=24, max_length=24)
    method: VerifyMethod = "nfc"


class VerifyIn(TapIn):
    reader_id: str = Field(min_length=2, max_length=60, pattern=r"^[A-Za-z0-9._-]+$")


class SimulateIn(BaseModel):
    credential_id: str = Field(min_length=24, max_length=24)
    building_id: str = Field(min_length=24, max_length=24)
