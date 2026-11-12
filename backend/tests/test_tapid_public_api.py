# TapID regression suite against the PUBLIC preview URL (auth, RBAC, issuance, verification, admin, photo)
import io
import os
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

FENV = dotenv_values(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BENV = dotenv_values(Path(__file__).resolve().parents[1] / ".env")
BASE = (os.environ.get("EXPO_BACKEND_URL") or FENV["EXPO_PUBLIC_BACKEND_URL"]).rstrip("/") + "/api"
READER_KEY = BENV["READER_API_KEYS"].split(",")[0].strip()
ADMIN = {"email": "admin@tapid.edu", "password": "TapIDAdmin!2026"}
DEMO = {"email": "student@tapid.edu", "password": "Student!2026"}
PENDING = {"email": "pending@tapid.edu", "password": "Student!2026"}


def H(t):
    return {"Authorization": f"Bearer {t}"}


def login(c):
    r = requests.post(f"{BASE}/auth/login", json=c, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def admin():
    return login(ADMIN)["access_token"]


@pytest.fixture(scope="module")
def buildings(admin):
    r = requests.get(f"{BASE}/admin/buildings", headers=H(admin), timeout=15)
    assert r.status_code == 200
    return {b["code"]: b for b in r.json()}


@pytest.fixture(scope="module")
def stu(admin, buildings):
    # fresh TEST_ student: register -> approve -> issue -> permit LIB only
    sfx = uuid.uuid4().hex[:6]
    body = {"email": f"test_{sfx}@tapid.edu", "password": "Password!1", "full_name": f"TEST_ Student {sfx}",
            "student_number": f"T-{sfx}", "program": "TEST_ Program"}
    r = requests.post(f"{BASE}/auth/register", json=body, timeout=15)
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["user"]["enrollment_status"] == "pending" and "password_hash" not in d["user"] and "_id" not in d["user"]
    return {"id": d["user"]["id"], "token": d["access_token"], "body": body}


# --- auth / RBAC / validation
def test_login_roles():
    assert login(ADMIN)["user"]["role"] == "admin"
    assert login(DEMO)["user"]["role"] == "student"


def test_bad_login_and_validation():
    assert requests.post(f"{BASE}/auth/login", json={**ADMIN, "password": "bad"}).status_code == 401
    assert requests.post(f"{BASE}/auth/login", json={"email": "nope@x.edu", "password": "x"}).status_code == 401
    assert requests.post(f"{BASE}/auth/register", json={"email": "bad"}).status_code == 422
    assert requests.get(f"{BASE}/auth/me", headers=H("garbage")).status_code == 401


def test_rbac(admin, stu):
    assert requests.get(f"{BASE}/admin/analytics").status_code == 401
    assert requests.get(f"{BASE}/admin/analytics", headers=H(stu["token"])).status_code == 403
    assert requests.get(f"{BASE}/me", headers=H(admin)).status_code == 403
    assert requests.get(f"{BASE}/me").status_code == 401


def test_duplicate_register(stu):
    assert requests.post(f"{BASE}/auth/register", json=stu["body"]).status_code == 409
    b = {**stu["body"], "email": "x" + stu["body"]["email"]}
    r = requests.post(f"{BASE}/auth/register", json=b)
    assert r.status_code == 409 and "Student number" in r.json()["detail"]


# --- issuance rules
def test_issuance_rules(admin, stu, buildings):
    sid = stu["id"]
    assert requests.post(f"{BASE}/admin/students/{sid}/credential", json={}, headers=H(admin)).status_code == 409
    r = requests.patch(f"{BASE}/admin/students/{sid}", json={"enrollment_status": "active"}, headers=H(admin))
    assert r.status_code == 200 and r.json()["enrollment_status"] == "active"
    r = requests.post(f"{BASE}/admin/students/{sid}/credential", json={}, headers=H(admin))
    assert r.status_code == 201 and r.json()["status"] == "active"
    assert requests.post(f"{BASE}/admin/students/{sid}/credential", json={}, headers=H(admin)).status_code == 409
    r = requests.put(f"{BASE}/admin/students/{sid}/permissions", json={"building_ids": [buildings["LIB"]["id"]]}, headers=H(admin))
    assert r.status_code == 200 and r.json()["permitted_building_ids"] == [buildings["LIB"]["id"]]
    det = requests.get(f"{BASE}/admin/students/{sid}", headers=H(admin)).json()
    assert det["permitted_building_ids"] == [buildings["LIB"]["id"]] and det["credentials"][0]["status"] == "active"
    assert requests.put(f"{BASE}/admin/students/{sid}/permissions", json={"building_ids": ["bad"]}, headers=H(admin)).status_code == 422
    assert requests.put(f"{BASE}/admin/students/{sid}/permissions", json={"building_ids": ["0" * 24]}, headers=H(admin)).status_code == 422
    assert requests.get(f"{BASE}/admin/students/notanid", headers=H(admin)).status_code == 404


def tok(stu):
    r = requests.post(f"{BASE}/me/credential/token", headers=H(stu["token"]))
    assert r.status_code == 200, r.text
    return r.json()["token"]


def tap(stu, token, bid):
    r = requests.post(f"{BASE}/me/simulated-tap", json={"token": token, "building_id": bid}, headers=H(stu["token"]))
    assert r.status_code == 200, r.text
    return r.json()


# --- verification pipeline
def test_verify_granted_replay_noperm(stu, buildings):
    t = tok(stu)
    assert tap(stu, t, buildings["LIB"]["id"])["reason"] == "granted"
    assert tap(stu, t, buildings["LIB"]["id"])["reason"] == "replay_detected"
    other = next(b for c, b in buildings.items() if c != "LIB")
    assert tap(stu, tok(stu), other["id"])["reason"] == "no_permission"
    assert tap(stu, "x" * 40, buildings["LIB"]["id"])["reason"] == "invalid_token"


def test_reader_verify_endpoint(stu, buildings):
    body = {"token": tok(stu), "building_id": buildings["LIB"]["id"], "reader_id": "TEST_door-1", "method": "nfc"}
    assert requests.post(f"{BASE}/verify", json=body).status_code == 401
    assert requests.post(f"{BASE}/verify", json=body, headers={"X-Reader-Key": "wrong"}).status_code == 401
    r = requests.post(f"{BASE}/verify", json=body, headers={"X-Reader-Key": READER_KEY})
    assert r.status_code == 200 and r.json()["granted"] is True
    r = requests.post(f"{BASE}/verify", json=body, headers={"X-Reader-Key": READER_KEY})
    assert r.json()["reason"] == "replay_detected"
    assert requests.post(f"{BASE}/verify", json={"token": "short"}, headers={"X-Reader-Key": READER_KEY}).status_code == 422


def test_cross_student_token_forbidden(stu, buildings):
    demo = login(DEMO)["access_token"]
    t = tok(stu)
    r = requests.post(f"{BASE}/me/simulated-tap", json={"token": t, "building_id": buildings["LIB"]["id"]}, headers=H(demo))
    assert r.status_code == 403


def test_not_enrolled(admin, stu, buildings):
    t = tok(stu)
    requests.patch(f"{BASE}/admin/students/{stu['id']}", json={"enrollment_status": "suspended"}, headers=H(admin))
    try:
        assert tap(stu, t, buildings["LIB"]["id"])["reason"] == "not_enrolled"
    finally:
        requests.patch(f"{BASE}/admin/students/{stu['id']}", json={"enrollment_status": "active"}, headers=H(admin))


def test_admin_reader_console(admin, stu, buildings):
    creds = requests.get(f"{BASE}/admin/credentials/active", headers=H(admin)).json()
    c = next(x for x in creds if x["student_id"] == stu["id"])
    r = requests.post(f"{BASE}/admin/reader/simulate", json={"credential_id": c["id"], "building_id": buildings["LIB"]["id"]}, headers=H(admin))
    assert r.status_code == 200 and r.json()["granted"]
    t = r.json()["presented_token"]
    r = requests.post(f"{BASE}/admin/reader/verify", json={"token": t, "building_id": buildings["LIB"]["id"]}, headers=H(admin))
    assert r.json()["reason"] == "replay_detected"


def test_history_and_logs(admin, stu, buildings):
    h = requests.get(f"{BASE}/me/history", headers=H(stu["token"])).json()
    assert len(h) >= 4 and all(x["student_id"] == stu["id"] for x in h)
    g = requests.get(f"{BASE}/admin/logs", params={"result": "granted"}, headers=H(admin)).json()
    assert g and all(x["result"] == "granted" for x in g)
    d = requests.get(f"{BASE}/admin/logs", params={"result": "denied", "building_id": buildings["LIB"]["id"]}, headers=H(admin)).json()
    assert all(x["result"] == "denied" and x["building_id"] == buildings["LIB"]["id"] for x in d)
    q = requests.get(f"{BASE}/admin/logs", params={"q": stu["body"]["student_number"]}, headers=H(admin)).json()
    assert q and all(x["student_number"] == stu["body"]["student_number"].upper() for x in q)
    assert requests.get(f"{BASE}/admin/logs", params={"result": "xx"}, headers=H(admin)).status_code == 422


def test_students_search_filter(admin, stu):
    r = requests.get(f"{BASE}/admin/students", params={"q": stu["body"]["student_number"]}, headers=H(admin)).json()
    assert len(r) == 1 and r[0]["has_active_credential"] is True
    p = requests.get(f"{BASE}/admin/students", params={"status": "pending"}, headers=H(admin)).json()
    assert all(x["enrollment_status"] == "pending" for x in p)


def test_analytics(admin):
    a = requests.get(f"{BASE}/admin/analytics", headers=H(admin)).json()
    assert len(a["daily"]) == 7 and a["totals"]["attempts_7d"] >= 1 and a["totals"]["active_credentials"] >= 1
    assert isinstance(a["by_building"], list) and isinstance(a["denial_reasons"], list)


def test_photo_upload(stu):
    jpeg = bytes.fromhex("ffd8ffe000104a46494600010100000100010000ffdb004300" + "08" * 64 + "ffd9")
    r = requests.post(f"{BASE}/me/photo", files={"file": ("p.jpg", io.BytesIO(jpeg), "image/jpeg")}, headers=H(stu["token"]), timeout=30)
    assert r.status_code == 200, r.text
    assert r.json().get("photo_url") or r.json().get("photo_path") or r.json().get("has_photo")
    bad = requests.post(f"{BASE}/me/photo", files={"file": ("p.txt", b"hi", "text/plain")}, headers=H(stu["token"]))
    assert bad.status_code == 415
    # photo retrieval: owner OK (bytes round-trip), other student 403, anonymous 401
    g = requests.get(f"{BASE}/files/students/{stu['id']}/photo", headers=H(stu["token"]), timeout=30)
    assert g.status_code == 200 and g.content == jpeg
    demo = login(DEMO)["access_token"]
    assert requests.get(f"{BASE}/files/students/{stu['id']}/photo", headers=H(demo)).status_code == 403
    assert requests.get(f"{BASE}/files/students/{stu['id']}/photo").status_code == 401


def test_student_self_revoke_then_denied(stu, buildings):
    t = tok(stu)
    r = requests.post(f"{BASE}/me/credential/revoke", json={"reason": "lost_device"}, headers=H(stu["token"]))
    assert r.status_code == 200 and r.json()["status"] == "revoked"
    assert tap(stu, t, buildings["LIB"]["id"])["reason"] == "credential_revoked"
    assert requests.post(f"{BASE}/me/credential/token", headers=H(stu["token"])).status_code == 409
    assert requests.post(f"{BASE}/me/credential/revoke", json={"reason": "lost_device"}, headers=H(stu["token"])).status_code == 409


def test_admin_reissue_and_revoke(admin, stu):
    r = requests.post(f"{BASE}/admin/students/{stu['id']}/credential", json={}, headers=H(admin))
    assert r.status_code == 201
    r = requests.post(f"{BASE}/admin/students/{stu['id']}/credential/revoke", headers=H(admin))
    assert r.status_code == 200 and r.json()["status"] == "revoked"


def test_create_building_dup(admin, buildings):
    r = requests.post(f"{BASE}/admin/buildings", json={"name": "Library dup", "code": "LIB"}, headers=H(admin))
    assert r.status_code == 409
    assert requests.post(f"{BASE}/admin/buildings", json={"name": "x", "code": "!!"}, headers=H(admin)).status_code == 422


def test_pending_demo_and_demo_active():
    p = login(PENDING)["access_token"]
    me = requests.get(f"{BASE}/me", headers=H(p)).json()
    assert me["student"]["enrollment_status"] == "pending" and me["credential"] is None
    d = login(DEMO)["access_token"]
    me = requests.get(f"{BASE}/me", headers=H(d)).json()
    assert me["credential"]["status"] == "active"
    assert {b["code"] for b in me["buildings"] if b["permitted"]} >= {"LIB", "ENG", "REC"}
