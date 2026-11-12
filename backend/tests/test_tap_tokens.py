"""Unit tests for the pure tap-token module (no database, no server)."""
import time

import jwt
import pytest

from tapid.services.tap_tokens import TapTokenError, decode_tap_token, mint_tap_token

SECRET = "unit-test-secret"


def mint(**kw):
    args = dict(credential_id="c1", credential_uid="TID-1", student_id="s1", ttl_seconds=30)
    args.update(kw)
    return mint_tap_token(SECRET, **args)


def test_round_trip_contains_claims():
    t = mint()
    claims = decode_tap_token(SECRET, t["token"])
    assert claims["cid"] == "c1" and claims["sid"] == "s1" and claims["uid"] == "TID-1"
    assert claims["nonce"] == t["nonce"] and t["ttl_seconds"] == 30


def test_each_token_has_unique_nonce():
    assert len({mint()["nonce"] for _ in range(50)}) == 50


def test_expired_token_rejected():
    t = mint(now=time.time() - 120)
    with pytest.raises(TapTokenError) as e:
        decode_tap_token(SECRET, t["token"])
    assert e.value.reason == "token_expired"


def test_wrong_secret_rejected():
    t = mint()
    with pytest.raises(TapTokenError) as e:
        decode_tap_token("other-secret", t["token"])
    assert e.value.reason == "invalid_token"


def test_tampered_payload_rejected():
    t = mint()["token"]
    head, body, sig = t.split(".")
    tampered = f"{head}.{body[:-2]}xx.{sig}"
    with pytest.raises(TapTokenError):
        decode_tap_token(SECRET, tampered)


def test_session_token_cannot_be_used_as_tap_token():
    # Signed with the raw secret (like an access JWT) - domain separation must reject it.
    fake = jwt.encode({"typ": "tap", "cid": "c", "uid": "u", "sid": "s", "nonce": "n",
                       "iat": int(time.time()), "exp": int(time.time()) + 30}, SECRET, algorithm="HS256")
    with pytest.raises(TapTokenError):
        decode_tap_token(SECRET, fake)


def test_future_issued_token_rejected():
    t = mint(now=time.time() + 60)
    with pytest.raises(TapTokenError) as e:
        decode_tap_token(SECRET, t["token"], now=time.time())
    assert e.value.reason == "invalid_token"


def test_garbage_rejected():
    with pytest.raises(TapTokenError):
        decode_tap_token(SECRET, "not-a-token")
