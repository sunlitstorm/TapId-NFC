"""Integration tests against the running API (default http://localhost:8001).

Run:  cd /app/backend && python -m pytest tests -q
"""
import os
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

ENV = dotenv_values(Path(__file__).resolve().parent.parent / ".env")
BASE = os.environ.get("TAPID_API_URL", "http://localhost:8001").rstrip("/") + "/api"
ADMIN = {"email": ENV["ADMIN_EMAIL"], "password": ENV["ADMIN_PASSWORD"]}
READER_KEY = ENV["READER_API_KEYS"].split(",")[0].strip()


@pytest.fixture(scope="module", autouse=True)
def cleanup_test_students():
    yield
    from bson import ObjectId
    from pymongo import MongoClient
    db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
    ids = [str(d["_id"]) for d in db.students.find({"email": {"$regex": "^t_.*@tapid\\.edu$"}}, {"_id": 1})]
    for coll in ("credentials", "access_permissions", "verification_logs"):
        db[coll].delete_many({"student_id": {"$in": ids}})
    db.students.delete_many({"_id": {"$in": [ObjectId(i) for i in ids]}})


def auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE}/auth/login", json=ADMIN, timeout=10)
    assert r.status_code == 200, r.text
    assert r.json()["user"]["role"] == "admin"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def buildings(admin_token):
    r = requests.get(f"{BASE}/admin/buildings", headers=auth(admin_token), timeout=10)
    assert r.status_code == 200
    return {b["code"]: b["id"] for b in r.json()}


@pytest.fixture()
def student():
    suffix = uuid.uuid4().hex[:8]
    body = {"email": f"t_{suffix}@tapid.edu", "password": "Passw0rd!x", "full_name": "Test Student",
            "student_number": f"T{suffix}".upper(), "program": "BSc Testing"}
    r = requests.post(f"{BASE}/auth/register", json=body, timeout=10)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["user"]["enrollment_status"] == "pending"
    return {"token": data["access_token"], "id": data["user"]["id"], **body}


def activate_and_issue(admin_token, student_id, building_ids):
    h = auth(admin_token)
    assert requests.patch(f"{BASE}/admin/students/{student_id}", json={"enrollment_status": "active"}, headers=h).status_code == 200
    r = requests.post(f"{BASE}/admin/students/{student_id}/credential", json={}, headers=h)
    assert r.status_code == 201, r.text
    assert requests.put(f"{BASE}/admin/students/{student_id}/permissions", json={"building_ids": building_ids}, headers=h).status_code == 200
    return r.json()


def tap_token(student_token):
    r = requests.post(f"{BASE}/me/credential/token", headers=auth(student_token))
    assert r.status_code == 200, r.text
    return r.json()["token"]


def tap(student_token, token, building_id):
    r = requests.post(f"{BASE}/me/simulated-tap", json={"token": token, "building_id": building_id}, headers=auth(student_token))
    assert r.status_code == 200, r.text
    return r.json()


# ------------------------------------------------------------ auth & validation
def test_register_validation_rejects_bad_input():
    r = requests.post(f"{BASE}/auth/register", json={"email": "bad", "password": "x", "full_name": "", "student_number": "!", "program": ""})
    assert r.status_code == 422


def test_duplicate_email_conflict(student):
    body = {k: student[k] for k in ("email", "password", "full_name", "program")}
    body["student_number"] = "DUP" + uuid.uuid4().hex[:6].upper()
    assert requests.post(f"{BASE}/auth/register", json=body).status_code == 409


def test_wrong_password_rejected():
    assert requests.post(f"{BASE}/auth/login", json={"email": ADMIN["email"], "password": "nope"}).status_code == 401


def test_missing_token_401():
    assert requests.get(f"{BASE}/auth/me").status_code == 401


def test_student_cannot_call_admin_routes(student):
    assert requests.get(f"{BASE}/admin/students", headers=auth(student["token"])).status_code == 403


def test_admin_cannot_call_student_routes(admin_token):
    assert requests.get(f"{BASE}/me", headers=auth(admin_token)).status_code == 403


# ------------------------------------------------------------ issuance rules
def test_pending_student_cannot_get_credential_or_token(admin_token, student):
    r = requests.post(f"{BASE}/admin/students/{student['id']}/credential", json={}, headers=auth(admin_token))
    assert r.status_code == 409
    assert requests.post(f"{BASE}/me/credential/token", headers=auth(student["token"])).status_code == 409


def test_only_one_active_credential(admin_token, student, buildings):
    activate_and_issue(admin_token, student["id"], [buildings["LIB"]])
    r = requests.post(f"{BASE}/admin/students/{student['id']}/credential", json={}, headers=auth(admin_token))
    assert r.status_code == 409


# ------------------------------------------------------------ verification
def test_full_verification_flow(admin_token, student, buildings):
    activate_and_issue(admin_token, student["id"], [buildings["LIB"]])

    granted = tap(student["token"], tap_token(student["token"]), buildings["LIB"])
    assert granted["granted"] is True and granted["reason"] == "granted"

    denied = tap(student["token"], tap_token(student["token"]), buildings["SCI"])
    assert denied["granted"] is False and denied["reason"] == "no_permission"

    # Replay: the same token presented twice
    token = tap_token(student["token"])
    assert tap(student["token"], token, buildings["LIB"])["granted"] is True
    replay = tap(student["token"], token, buildings["LIB"])
    assert replay["granted"] is False and replay["reason"] == "replay_detected"

    # Tampered token
    bad = tap(student["token"], token[:-4] + "abcd", buildings["LIB"])
    assert bad["reason"] == "invalid_token"

    # Suspended enrollment
    h = auth(admin_token)
    requests.patch(f"{BASE}/admin/students/{student['id']}", json={"enrollment_status": "suspended"}, headers=h)
    assert tap(student["token"], tap_token(student["token"]), buildings["LIB"])["reason"] == "not_enrolled"
    requests.patch(f"{BASE}/admin/students/{student['id']}", json={"enrollment_status": "active"}, headers=h)

    # Lost device revocation: an already-minted token stops working immediately
    pre_revoke = tap_token(student["token"])
    r = requests.post(f"{BASE}/me/credential/revoke", json={"reason": "lost_device"}, headers=auth(student["token"]))
    assert r.status_code == 200 and r.json()["status"] == "revoked"
    assert tap(student["token"], pre_revoke, buildings["LIB"])["reason"] == "credential_revoked"
    assert requests.post(f"{BASE}/me/credential/token", headers=auth(student["token"])).status_code == 409

    # Every attempt was logged
    history = requests.get(f"{BASE}/me/history", headers=auth(student["token"])).json()
    reasons = {h["reason"] for h in history}
    assert {"granted", "no_permission", "replay_detected", "not_enrolled", "credential_revoked"} <= reasons


def test_reader_endpoint_requires_key(student, admin_token, buildings):
    body = {"token": "x" * 40, "building_id": buildings["LIB"], "reader_id": "door-lib-01"}
    assert requests.post(f"{BASE}/verify", json=body).status_code == 401
    r = requests.post(f"{BASE}/verify", json=body, headers={"X-Reader-Key": READER_KEY})
    assert r.status_code == 200 and r.json()["reason"] == "invalid_token"


def test_admin_console_simulation_and_replay(admin_token, student, buildings):
    cred = activate_and_issue(admin_token, student["id"], [buildings["ENG"]])
    h = auth(admin_token)
    r = requests.post(f"{BASE}/admin/reader/simulate", json={"credential_id": cred["id"], "building_id": buildings["ENG"]}, headers=h)
    assert r.status_code == 200 and r.json()["granted"] is True
    replay = requests.post(f"{BASE}/admin/reader/verify", json={"token": r.json()["presented_token"], "building_id": buildings["ENG"]}, headers=h)
    assert replay.json()["reason"] == "replay_detected"


def test_admin_search_logs_and_analytics(admin_token, student):
    h = auth(admin_token)
    found = requests.get(f"{BASE}/admin/students", params={"q": student["student_number"]}, headers=h).json()
    assert [s["id"] for s in found] == [student["id"]]
    assert requests.get(f"{BASE}/admin/logs", params={"result": "denied"}, headers=h).status_code == 200
    a = requests.get(f"{BASE}/admin/analytics", headers=h).json()
    assert len(a["daily"]) == 7 and "totals" in a
