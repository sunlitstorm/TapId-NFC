# TapID - Digital Student ID & Campus Access (MVP)

TapID gives every student a digital ID in a mobile wallet. Students present a short-lived, single-use credential token to campus readers over **simulated NFC** or a **QR fallback**. Administrators manage enrollment, issue and revoke IDs, assign building permissions, and monitor access logs and analytics.

> **NFC is simulated.** No NFC hardware or native NFC APIs are used. The "tap" sends the signed token to the backend over HTTPS. The verification layer is modular, so real hardware can be plugged in later (see *Extending to real NFC*).

## Stack (as deployed on this platform)
| Layer | Tech |
|---|---|
| Mobile app (student + admin, role-based) | Expo / React Native, expo-router, TypeScript, React Query |
| API | Python FastAPI (REST, `/api` prefix) |
| Database | MongoDB. Collections mirror normalized tables, with unique/partial/TTL indexes. Relational DDL: `backend/schema/postgres_schema.sql` |
| Files | Emergent managed object storage (student photos) |

The original brief asked for Node/Express + PostgreSQL/Supabase. This platform runs FastAPI + MongoDB natively. The domain design is engine-agnostic, and the PostgreSQL schema is kept as the canonical model for a later migration.

## Folder structure
```
backend/
  server.py                  # app assembly: routers, CORS, startup (indexes, seed, storage)
  schema/postgres_schema.sql # normalized relational schema
  tapid/
    config.py                # env-driven settings (no hardcoded secrets)
    db.py                    # Mongo client + index definitions
    models.py                # PyObjectId/BaseDocument models + validated request schemas
    security.py              # bcrypt, access JWT, role dependencies (require_admin/require_student)
    storage.py               # object storage client
    readers.py               # ReaderAdapter abstraction (SimulatedReader today)
    seed.py                  # idempotent admin/buildings/demo students
    services/
      tap_tokens.py          # PURE: mint/decode short-lived tap tokens (unit-tested)
      verification.py        # verification pipeline + logging
    routers/ auth.py student.py admin.py verify.py files.py
  tests/ test_tap_tokens.py (unit)  test_api_integration.py (integration)
frontend/
  app/ login, register, student/(ID, history, profile), admin/(overview, students, reader, logs),
       admin-student/[id], buildings
  src/ api.ts auth.tsx theme.ts types.ts nfc/transport.ts components/*
```

## Security model
- **Auth:** email + password (bcrypt). HS256 access JWT (`typ=access`, 12h). Role comes from collection membership and is re-checked against the DB on every request. `require_admin` / `require_student` dependencies enforce RBAC.
- **Tap tokens:** HS256 JWT signed with a key derived from `JWT_SECRET` (domain-separated, so a session token cannot be used as a tap token). Claims: `cid, uid, sid, nonce, iat, exp`. TTL is `NFC_TOKEN_TTL_SECONDS` (30s).
- **Replay prevention:** each nonce is consumed by an atomic insert into `used_nonces`, which has a unique index (a TTL index purges old ones). A second presentation returns `replay_detected`.
- **Verification order:** signature/expiry → nonce → building → credential exists & active → student enrolled → building permission. **Every attempt is logged** (`verification_logs`), granted or denied, with a reason code.
- **Reader endpoint** `POST /api/verify` requires an `X-Reader-Key` header (`READER_API_KEYS`). Keys are compared in constant time.
- **Lost device:** `POST /api/me/credential/revoke` takes effect immediately on every reader, including tokens already minted.
- Secrets live only in `backend/.env`: `JWT_SECRET, ADMIN_*, READER_API_KEYS, EMERGENT_LLM_KEY`. The app bundle only contains `EXPO_PUBLIC_BACKEND_URL`.

## REST API (summary)
| Method | Path | Role |
|---|---|---|
| POST | /api/auth/register, /api/auth/login | public |
| GET | /api/auth/me | any |
| GET | /api/me | student |
| POST | /api/me/photo · /api/me/credential/token · /api/me/credential/revoke · /api/me/simulated-tap | student |
| GET | /api/me/history | student |
| GET/PATCH | /api/admin/students[/{id}] | admin |
| POST | /api/admin/students/{id}/credential[/revoke] | admin |
| PUT | /api/admin/students/{id}/permissions | admin |
| GET/POST | /api/admin/buildings | admin |
| GET | /api/admin/logs?result=&building_id=&q= · /api/admin/analytics · /api/admin/credentials/active | admin |
| POST | /api/admin/reader/simulate · /api/admin/reader/verify | admin |
| POST | /api/verify | reader key |
| GET | /api/files/students/{id}/photo | owner or admin |

## Extending to real NFC
1. **Phone side:** implement `CredentialTransport` (`frontend/src/nfc/transport.ts`) with Android Host Card Emulation or Apple's NFC & SE platform. It emits the same tap token. This needs a native build, not Expo Go.
2. **Door side:** a hardware reader (a `ReaderAdapter` in `backend/tapid/readers.py`) reads the token and calls `POST /api/verify` with its reader key.
3. The verification service, logs and admin UI stay unchanged.

## Running tests
```
cd backend && python -m pytest tests -q
```
Unit tests cover the token module: round-trip, expiry, tampering, domain separation and future-iat. Integration tests run against the live API and cover RBAC, validation, issuance rules, granted/denied, replay, suspension, revocation and logging.

## Demo accounts
See `memory/test_credentials.md`.
