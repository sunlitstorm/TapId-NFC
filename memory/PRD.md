# TapID - PRD

## Original problem statement
Build a production-quality MVP called TapID, a digital student identification and NFC campus access platform:
- **Student app:** registration and login, digital ID, profile with photo and enrollment status, QR fallback, NFC credential management, access history, lost-device revocation.
- **Admin:** student management, ID issuance and revocation, building permissions, access logs, analytics and charts, search and filter.
- **NFC verification:** simulated reader, secure verification API, enrollment and permission checks, nonces and short-lived tokens against replay, every attempt logged, clear granted/denied responses.
- **Data:** normalized tables for Students, Credentials, Buildings, Permissions, Logs and Administrators. RBAC, validation, tests and a README.
- **Design:** navy, white and light grey.
- **Constraint:** never pretend simulated NFC is real.

## User choices
- Built-in server and database (FastAPI + MongoDB), with a PostgreSQL reference DDL kept for later migration.
- Defaults applied: admin screens in the same app (role login), students stay pending until an admin approves, real photo upload to object storage.

## Architecture
- **Backend** (`backend/tapid`): config, db (indexes, including a partial unique index for one active credential and a TTL nonce store), models, security (bcrypt, JWT, RBAC), services/tap_tokens (pure), services/verification (pipeline and logging), readers (adapter seam), routers (auth/student/admin/verify/files), seed.
- **Frontend** (Expo Router):
  - Screens: login, register, student tabs (ID, History, Profile), admin tabs (Overview, Students, Reader, Logs), admin-student/[id], buildings.
  - `src/nfc/transport.ts` is the transport seam.
- **Tests:** 38 pytest (unit + integration). README and `schema/postgres_schema.sql`.

## Implemented (2026-06)
- Full feature set above. The simulated NFC tap and QR (30s, single-use) work, and replay is blocked.
- Lost-device revoke, admin issue/revoke/permissions/enrollment, analytics charts, log filters, buildings CRUD (create), photo upload.

## Backlog
- **P1:**
  - Delete/edit students and buildings.
  - Signed short-lived photo URLs instead of passing the token in the query.
  - Analytics aggregation done in the database.
  - Admin QR scanner via camera.
- **P1:** Real NFC through native HCE (needs a dev build).
- **P2:**
  - Password reset.
  - Login rate limiting.
  - CSV export of logs.
  - Time-window permissions (e.g. lab hours).
