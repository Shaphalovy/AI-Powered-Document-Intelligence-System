# PROJECT_STATE (handoff document)

Last updated: 2026-10-29. Update this file at the end of every step.

## 0. How to use this file (for any AI assistant or person)
1. Read this file fully, then the assignment in docs/ (senior-ai-enginner.pdf) and docs/AI_INSTRUCTIONS.md if present.
2. Run the commands in section 9 and confirm the current state before changing anything.
3. Work ONE step at a time. After each step give the owner test cases (TC) with exact copy-paste commands (one command per block) and expected output, then wait for the real output. Do not assume anything was run without evidence.
4. Never claim something is verified unless it was actually run or checked in a reliable source. Separate "verified" from "assumed".
5. Before recommending any tool/library/version, check current official docs and known issues, and cite them with the date checked. Pin exact versions.
6. Owner preferences: reply in short Banglish (Bengali in English letters), plain step-by-step, commands as copyable text, always include a "harsh truth" when giving suggestions, ask a question first if in doubt, double-check answers. At the end of each step give the FULL updated PROJECT_STATE.md (owner dislikes line-by-line patches).
7. Never put secrets in git. Never send real confidential invoices to any external service (use synthetic or public samples).

## 1. Project
AI-Powered Document Intelligence System (Senior AI Engineer take-home assignment).
Owner: Sabbir. Location: E:\Projects\docintel (Windows, Docker Desktop; Node is installed on the PC but Docker is used on purpose, see section 11).
Constraints: 100% free (no paid APIs or tools). Quality over speed; the 5-day deadline is relaxed by the owner (may finish later and use it in a portfolio).
Extra goal: a live online demo so interviewers can test without installing anything, plus a one-command local run (`docker compose up`).
Git: repo is on GitHub (private) so work can continue from another AI account. Commit and push after every step.

## 2. Assignment requirements (source of truth: senior-ai-enginner.pdf)
Business problem: thousands of invoices/receipts/scanned PDFs/images/Excel/CSV per day (PDFs up to ~1000 pages). Needs extraction, validation, PDF-PDF and PDF-Excel cross verification, search.

| Task | Requirement | Planned step | Status |
|---|---|---|---|
| 1 | Accept PDF, JPG, PNG, TIFF, XLSX, XLS, CSV. Text from digital PDFs, OCR for scans/images, parse spreadsheets. Multi-page, multi-sheet, poor quality, corrupted files | 5, 7, 8, 9 | Step 5 (upload) in progress |
| 2 | Extract invoice no, date, supplier, customer, subtotal, tax, total, currency, line items as JSON. Never invent missing values | 10, 11 | Not started |
| 3 | Validation: missing fields, bad numbers, duplicates, subtotal/tax/line-item/total mismatch. Flag for manual review | 12, 13 | Not started |
| 4 | REST APIs: upload, status, results, search, manual corrections, failed-job reprocess. Background processing | 4, 5, 6, 15 | Auth done (Step 4); upload in progress |
| 5 | DB for metadata, text, structured results, validation errors, history. Keyword filter + semantic search | 3, 14 | Schema done (Step 3); search not started |
| 6 | React/Next.js UI: upload many, progress, inspect, errors, correct, search | 16-19 | Not started |
| 7 | Automated tests + labeled dataset evaluation (accuracy, time, success rate, failure rate) | 20, 21 | Not started |
| Deliverables | Git repo, README, architecture diagram, DB schema, working API+UI, pipelines, tests+results, evaluation report, walkthrough video, AI prompts and AI-assistance disclosure | 23 | Not started |
| Non-functional | Speed, scalability, reliability, strong security | 22 | Not started |

## 3. Stack and reasons
| Layer | Choice | Why |
|---|---|---|
| API (control plane) | NestJS 11 on Node 24 (Docker) | Assignment suggests NestJS. NestJS 12 is newer but its package compatibility was not verified, so 11 is used |
| Processor (data plane) | Python 3.12 + FastAPI, internal only | Best OCR/data ecosystem (Tesseract, OpenCV, pandas) |
| DB | PostgreSQL 17 + pgvector (image pgvector/pgvector:pg17, pgvector 0.8.7 verified) | Relational integrity for invoices; keyword + semantic search in one SQL; one less service than a separate vector DB (Qdrant is the fallback if a literal vector DB is wanted) |
| Queue | BullMQ on Redis 7 (noeviction + appendonly verified) | Assignment suggests it. Queue payload = document ID only (job data is plain text in Redis) |
| ORM / migrations | TypeORM 0.3.31 + @nestjs/typeorm 11.0.3 (pinned exact, verified working) | TypeORM 1.0 exists but was not chosen for now (section 11) |
| ioredis | 5.11.1 (pinned exact) | typeorm 0.3.31 needs ioredis ^5; npm had resolved 6.0.0 in Step 1 |
| Password hashing | Node built-in crypto.scrypt (N=2^17, r=8, p=1), format scrypt$N$r$p$salt$hash (verified working) | No native dependency. Parameters are from memory of OWASP guidance, not verified against current text |
| Auth | @nestjs/jwt 11.0.0 (HS256 pinned, custom guards, no passport), @nestjs/throttler 6.5.0, helmet 8.3.0, class-validator 0.15.1, class-transformer 0.5.1 (all pinned exact, verified working) | Fewer dependencies than passport; secure-by-default global guard |
| Uploads (Step 5) | multer 2.5.0 (forced by npm overrides) via @nestjs/platform-express, disk storage, @types/multer 2.3.0 (dev), own magic-byte detector (no file-type library) | Own detector avoids ESM-only package problems in CommonJS Nest; multer patched (section 10) |
| OCR | Tesseract + OpenCV (inside processor image) | Free, local, no data leaves the machine |
| Spreadsheets | pandas, openpyxl, xlrd | Standard |
| LLM | Any OpenAI-compatible API, configured from an admin panel (provider, base URL, model, key, test button, fallback model). Fallback ladder: json_schema, then json_object + Pydantic validation + retry | Free tiers differ in structured-output support; client can switch to a private/paid provider later without code changes |
| Embeddings | all-MiniLM-L6-v2, local (384 dimensions) | Free, text never leaves the machine. Not yet confirmed by owner; changing the model needs a migration (vector size) |
| Frontend | Next.js + Tailwind (quality UI) | Assignment suggests it |
| Money math | Python Decimal, never float | Avoid float rounding bugs |
| n8n | NOT used | Assessment wants engineering code (API, queue, DB, tests) |

## 4. Architecture
```
Next.js UI
   |
NestJS API  --- PostgreSQL + pgvector (owned by NestJS)
   |  auth, upload, search, admin settings, encrypted API keys
   |
BullMQ queue (Redis)   payload = document ID only
   |
Python Processor (FastAPI, Docker-network only, stateless)
   - PDF text + OCR, image/TIFF, XLSX/XLS/CSV
   - LLM extraction (rules first, LLM only for uncertain fields)
   - Validation (Decimal), cross-document verification
   - Embeddings
```
Data flow (target): upload -> validate file (magic bytes, size) -> store file -> create documents row -> enqueue ID -> worker calls processor -> pages/text saved -> extraction -> validation -> invoices + issues saved -> status completed or needs_review -> user reviews/corrects -> corrections audited.

## 5. Repository structure
```
docintel/
  docker-compose.yml        db, redis, processor, api
  .env.example / .env       (.env is git-ignored)
  PROJECT_STATE.md
  docs/                     assignment PDF, AI instructions
  api/                      NestJS 11
    src/main.ts, app.module.ts
    src/config/env.ts       requireEnv()
    src/health/             health controller/service/spec (db, redis, processor)
    src/database/           data-source.ts (migration CLI) + migrations/1793232000000-InitialSchema.ts
    src/users/              user.entity, password.service(+spec), users.service, admin-seed.service, users.module   (Step 4A, DONE)
    src/auth/               auth.config, auth.types, auth.service, auth.controller, auth.module, jwt-auth.guard(+spec),
                            roles.guard(+spec), public.decorator, roles.decorator, dto/login.dto   (Step 4B, DONE)
    src/documents/          file-type.detector(+spec) (5A, DONE); document.entity, upload.config(+spec) (5B-1, DONE);
                            multer.options, upload.interceptor, upload-filename(+spec), documents.service/controller/module,
                            documents.upload.spec (5B-2, code pushed, owner must verify)
  processor/                FastAPI
    app/main.py             GET /health
    tests/test_health.py
```

## 6. Environment
Ports on host: api 4700 (container 4000; host 4000 is blocked by a Windows reserved port range), db 5433, redis 6500 (6380 was blocked). Processor 8001 is NOT published (Docker network only, verified).
If a port fails after reboot: `netsh interface ipv4 show excludedportrange protocol=tcp`
Optional upload env vars (defaults in code, not required in .env): UPLOAD_DIR (absolute, default /data/uploads), MAX_UPLOAD_MB (default 100, max 500), MAX_FILES_PER_UPLOAD (default 20, max 100). Invalid values stop the app at startup. Uploaded files live in the Docker volume `uploads` mounted at /data/uploads in the api container (processor will mount it read-only in Step 7).
Env vars (see .env.example): POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, DATABASE_URL, REDIS_URL, PORT, PROCESSOR_URL, ADMIN_EMAIL, ADMIN_PASSWORD (min 12), JWT_SECRET (random, 32+ chars; the app refuses values starting with "change-me"; generate with `docker compose exec api node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`), JWT_EXPIRES_SECONDS (default 3600), DEMO_USER_EMAIL, DEMO_USER_PASSWORD (min 12), optional CORS_ORIGIN (default http://localhost:3000).
IMPORTANT: `docker compose restart` does NOT reload .env. Use `docker compose up -d --force-recreate api`.
Seeded accounts (local defaults from .env.example): admin@example.com (admin), demo@example.com (user). Change passwords for any public demo.

## 7. Database schema
IMPLEMENTED (Step 3, migration 1793232000000-InitialSchema): users, documents, document_pages, invoices, invoice_line_items, validation_issues, corrections, processing_events, document_chunks + typeorm_migrations. Verified: vector(384) column, HNSW (cosine) index, GIN full-text index, CHECK constraints reject bad values, migrate/revert/re-run works.
Run: `docker compose exec api npm run migration:run` (revert: `npm run migration:revert`).
Design rules: money as numeric(18,4) (never float); duplicate invoices are flagged, not blocked by a unique constraint (index on supplier_name + invoice_number); one document can contain many invoices; queue holds IDs only; events/audit log avoid storing document contents; synchronize is false, migrations are the schema owner. Later: app_settings (LLM config, Step 10). Never edit an applied migration, add a new one.

## 8. API
Implemented and verified:
- GET /health (public): db, redis, processor.
- POST /auth/login (public, 5/min/IP), GET /auth/me, GET /auth/admin-ping (admin only, TEMPORARY test route, remove later).
- Global guards in order: throttler (120/min/IP), JWT guard (secure by default; @Public() opts out), roles guard (@Roles()). helmet, global ValidationPipe (whitelist, forbidNonWhitelisted), CORS limited to CORS_ORIGIN.
POST /documents (Step 5B-2, JWT required, 30/min/IP): multipart/form-data, field name `files` (max MAX_FILES_PER_UPLOAD files, each max MAX_UPLOAD_MB, no other text fields). Per file: saved to UPLOAD_DIR/incoming under a random name, content type detected from magic bytes, extension must match, sha256 computed, moved to UPLOAD_DIR/<uuid>.<ext>, documents row inserted (status `uploaded`, stored_path is relative). Response 201 `{accepted, rejected, results[]}` with per-file status accepted/rejected + reason; 422 when no file is accepted; 400 no files / too many files / wrong field name / extra fields; 413 file too large; 401 without token. Rejected and failed files are deleted. Client MIME type and client path are ignored.
Planned: document list/status, extracted results, search (keyword + semantic), manual correction, reprocess failed, admin LLM settings. OpenAPI/Swagger at the end (helmet CSP may need adjusting for Swagger UI, unverified). No public registration.

## 9. Commands
- Start: `docker compose up -d --build`
- Status: `docker compose ps`
- Health: `curl.exe -i http://localhost:4700/health`
- API tests: `docker compose exec api npm test`
- Processor tests: `docker compose exec processor python -m pytest -q`
- Build: `docker compose exec api npm run build`
- Migrations: `docker compose exec api npm run migration:run`
- Logs: `docker compose logs <service> --tail 40` (a --force-recreate clears old logs)
- DB shell: `docker compose exec db psql -U docintel -d docintel`
- Login test (PowerShell): `$body = @{ email = "admin@example.com"; password = "<ADMIN_PASSWORD>" } | ConvertTo-Json; Invoke-RestMethod -Method Post -Uri http://localhost:4700/auth/login -ContentType "application/json" -Body $body`

## 10. Security rules
No secrets in git; validate uploads (magic bytes, size, limits); JWT + roles; AI output is untrusted until validated; queue payload IDs only; processor not exposed; free LLM tiers may send data to third parties, so only synthetic/public documents are used, and this is stated openly in the README; encrypted storage of LLM API keys; audit trail for corrections.
Known auth limits: JWT is stateless, no logout/revocation, short expiry instead; no refresh tokens; rate limit is in-memory per instance per IP (revisit behind a proxy/when scaling); no account lockout; where the frontend stores the token is decided in the UI steps.
Multer advisory (VERIFIED 2026-10-29 from the GitHub advisory GHSA-q7qp-rjg7-q26m, CVE-2026-113872): high severity DoS (CVSS 7.5). If a request is aborted while an ASYNC fileFilter is still pending, the process can crash; one unauthenticated request is enough. Affected: multer >= 2.0.0 and < 2.5.0. Patched: 2.5.0. Workaround: use a synchronous fileFilter (or none).
FIXED 2026-10-29 (Step 5A-fix): platform-express 11.2.8 pins multer exactly 2.4.0 (vulnerable), and the audit lists platform-express up to 12.2.0 as affected, so upgrading platform-express does not help. Fix = `overrides` in api/package.json forcing multer 2.5.0. Verified: `npm ls multer` shows 2.5.0 overridden, `npm audit --omit=dev` = 0 vulnerabilities, 42 tests pass, build passes. Re-check `npm audit` whenever platform-express is upgraded; remove the override only when platform-express itself depends on multer >= 2.5.0.
Upload rule kept as defense in depth: never use an async fileFilter; validate file content AFTER saving (magic bytes), not inside multer. Not yet verified: upload behaviour with multer 2.5.0 under real requests (done in Step 5B).
Earlier note: the full `npm audit` (including dev dependencies) reported 10 vulnerabilities (8 low, 2 high) in Step 1/4; the low ones are not yet inspected.

## 11. Decisions and research log
- Docker is used on purpose: the system needs Postgres with pgvector, Redis, and Python with Tesseract; Docker makes it reproducible for interviewers (`docker compose up`) and easier to deploy. Not required by the assignment. Trade-off: slower dev loop and Windows quirks (ports, bind mounts).
- 2026-10-28: Chose NestJS + Python split, Postgres+pgvector, BullMQ, TypeORM. Sources: BullMQ production guide, pgvector-node ORM support (mostly third-party pages).
- 2026-10-29: TypeORM 1.0 was released in 2026 and NestJS integration needs @nestjs/typeorm 11.0.1+ (typeorm.io release blog, InfoQ). The 0.3 line still gets releases (0.3.31, July 2026). Decision: pin 0.3.31; upgrade later via the official codemod if wanted.
- 2026-10-29: npm resolved ioredis 6 in Step 1, which conflicted with typeorm. Pinned ioredis 5.11.1. Check BullMQ's ioredis requirement before Step 6.
- 2026-10-29: Windows reserved port ranges blocked host ports 4000 and 6380 after a reboot; changed to 4700 and 6500.
- 2026-10-29: Password hashing uses built-in scrypt to avoid native build problems (verified working in tests).
- 2026-10-29: Auth design: custom JWT guard with @nestjs/jwt (no passport), HS256 pinned on sign and verify, global guard with @Public() opt-out, expiry as seconds number. @nestjs/throttler 6.5.0 declares Nest 11 support (its package.json). Verified by 20 passing tests and live checks (401/403/400/429).
- 2026-10-29: Upload design: own magic-byte detector for pdf/jpg/png/tiff/xlsx/xls/csv instead of the file-type library (recent versions are ESM-only, awkward with CommonJS Nest; not independently verified this session). Stored file name = random UUID, never the client name. Detected type must match the file extension. Client MIME type is ignored.
- Groq/Gemini structured-output differences are the reason for the json_schema -> json_object fallback ladder.
- Vercel hosts only the Next.js frontend. API, worker, processor, Postgres, Redis need a Docker host (free options not verified; decide in Step 22-23).

## 12. Progress
| Step | Description | Status | Evidence |
|---|---|---|---|
| 1 | Docker infra + NestJS /health | DONE | All TC passed (2026-10-28) |
| 2 | Python processor + NestJS connection | DONE | All TC passed (2026-10-28) |
| 3 | DB schema + TypeORM migrations | DONE | All TC passed (2026-10-29) |
| 4A | TypeORM wiring, User entity, scrypt hashing, admin seed | DONE | All TC passed (2026-10-29) |
| 4B | JWT login, guards, roles, rate limit, helmet, validation | DONE | All TC passed (2026-10-29): 20 API tests, 401 without token, admin-ping 200 for admin and 403 for user, wrong/unknown email both 401, invalid body 400, rate limit returns 429, no X-Powered-By |
| 5A | Multer version check + file type detector (magic bytes) + tests | DONE | Owner ran on 2026-10-29: `npm test` = 5 suites, 42 tests passed (2.8 s); `npm run build` succeeded with no errors; commit 65c9db4 pushed. `npm ls multer` = 2.4.0 (vulnerable, see section 10) |
| 5A-fix | Upgrade multer to >= 2.5.0 (npm overrides) + re-check audit/tests/build | DONE (owner must commit api/package.json + api/package-lock.json) | Owner ran 2026-10-29: `npm view multer@2.5.0` = 2.5.0 exists; platform-express 11.2.8 pins multer exactly 2.4.0; added `"overrides": {"multer": "2.5.0"}`; `npm ls multer` = 2.5.0 overridden; `npm audit --omit=dev` = 0 vulnerabilities; `npm test` = 42 passed; `npm run build` OK |
| 5B-1 | DocumentEntity, upload config (env limits, fail-fast), `uploads` Docker volume at /data/uploads | DONE | Owner ran 2026-10-29: git pull fast-forward 93c3063..77fe5ff; api container recreated, volume docintel_uploads created; `npm test` = 6 suites, 48 tests passed; `npm run build` OK; /data/uploads exists (root, drwxr-xr-x); `docker compose build api` OK (`npm ci` succeeded on node:24-slim) |
| 5B-2 | Upload endpoint POST /documents (multi-file, multer disk storage, NO async fileFilter, magic-byte check after save, sha256, documents rows, cleanup of rejected files) + tests | CODE PUSHED, NOT VERIFIED BY OWNER | Claude ran in a scratch copy (Node 22, with @types/multer 2.3.0): 8 suites, 64 tests pass, nest build OK. The integration test found and fixed a real bug (temp file left behind on the 401 path). Owner must: git pull, `npm install --save-dev --save-exact @types/multer@2.3.0` in the container, recreate api, test, build, live curl test, commit package.json + lock file |
| 6 | BullMQ pipeline (retry, idempotency, status, reprocess) | TODO | |
| 7 | Digital PDF + OCR | TODO | |
| 8 | Image/TIFF | TODO | |
| 9 | XLSX/XLS/CSV | TODO | |
| 10 | LLM provider layer + admin settings | TODO | |
| 11 | Extraction | TODO | |
| 12 | Validation + duplicates + review flags | TODO | |
| 13 | Cross-document verification (PDF-PDF, PDF-Excel) | TODO | |
| 14 | Search (keyword + semantic) | TODO | |
| 15 | Correction + audit + reprocess APIs, OpenAPI | TODO | |
| 16-19 | Next.js UI (foundation, upload/progress, results/review, search+admin) | TODO | |
| 20 | Synthetic labeled dataset | TODO | |
| 21 | Full tests + evaluation (real metrics only) | TODO | |
| 22 | Security + performance pass, pin all package versions, auto-run migrations, deployment | TODO | |
| 23 | README, diagram, schema, prompts, AI disclosure, video | TODO | |

Current test status: API 42 tests passing in 5 suites (as of Step 5A-fix, run by owner 2026-10-29, after the multer override), processor 1 passing (as of Step 4B, not re-run since). API build passes.

## 13. Known issues and todo
- Migrations are NOT run automatically. A fresh clone + `docker compose up` crashes when the API needs the users table. Must be automated before delivery (Step 22/23).
- A fresh clone needs a real JWT_SECRET; provide a setup script or auto-generation (Step 22/23).
- Remove the temporary GET /auth/admin-ping route once real admin routes exist.
- multer filenames arrive latin1-decoded (busboy default); decode to UTF-8 in Step 5B (unverified, check with a non-ASCII filename).
- Detector limits: BigTIFF and UTF-16 CSV are rejected; .xlsm/macros not specially handled (revisit in Step 9). Real file validity is checked by the processor.
- Python packages unpinned (pin in Step 22). httpx deprecation warning in processor tests (harmless).
- npm install-scripts warning (@parcel/watcher, unrs-resolver) ignored for now.
- Free hosting will not handle a 1000-page OCR run; the live demo uses small samples (state in README).
- Tests must never use real confidential invoices.

- RESOLVED 2026-10-29: `npm ci` failed in Claude's sandbox (Node 22, npm 10: "Missing: webpack@5.112.2 from lock file") but succeeds in the project's Docker build (node:24-slim), so it was an npm version difference. Always trust the Docker build for lock file checks.
- Upload container runs as root (Dockerfile has no USER). Acceptable for local dev; harden in Step 22.
- multer limits apply to the whole request (fileSize per file, files count). Express body limits do not apply to multipart. Source: expressjs.com multer page, checked 2026-10-29.

- Known gaps after 5B-2: leftover files in UPLOAD_DIR/incoming after a crash are not cleaned automatically (add a cleanup job, Step 6 or 22); no processing_events row is written on upload yet (Step 6); no sha256 duplicate-file warning yet (Step 14/12); a unit test intentionally logs "database is down" (expected).
- Test design note: the integration test fakes the JWT guard with a header; the real guard order (guard before multer) is covered by the live curl test in the owner checklist.

## 14. Next action
Owner: verify Step 5B-2 (see section 12). Then Step 6: BullMQ pipeline (enqueue document ID after upload, worker, retries, idempotency, status updates, reprocess).

Note on access: Claude reads/pushes this repo through the GitHub connection of the owner's claude.ai account (not a password in the repo). Commits by Claude so far: 7ec7909, c1d60ab, 77fe5ff, all on main.
