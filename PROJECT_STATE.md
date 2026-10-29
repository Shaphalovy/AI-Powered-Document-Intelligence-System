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

## 2. Assignment requirements (source of truth: senior-ai-enginner.pdf)
Business problem: thousands of invoices/receipts/scanned PDFs/images/Excel/CSV per day (PDFs up to ~1000 pages). Needs extraction, validation, PDF-PDF and PDF-Excel cross verification, search.

| Task | Requirement | Planned step | Status |
|---|---|---|---|
| 1 | Accept PDF, JPG, PNG, TIFF, XLSX, XLS, CSV. Text from digital PDFs, OCR for scans/images, parse spreadsheets. Multi-page, multi-sheet, poor quality, corrupted files | 5, 7, 8, 9 | Not started |
| 2 | Extract invoice no, date, supplier, customer, subtotal, tax, total, currency, line items as JSON. Never invent missing values | 10, 11 | Not started |
| 3 | Validation: missing fields, bad numbers, duplicates, subtotal/tax/line-item/total mismatch. Flag for manual review | 12, 13 | Not started |
| 4 | REST APIs: upload, status, results, search, manual corrections, failed-job reprocess. Background processing | 4, 5, 6, 15 | Step 4 in progress |
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
| ORM / migrations | TypeORM 0.3.31 (pinned exact) + @nestjs/typeorm 11.0.3 (planned in 4A, not yet verified) | TypeORM 1.0 exists but was not chosen for now (section 11) |
| ioredis | 5.11.1 (pinned exact) | typeorm 0.3.31 needs ioredis ^5; npm had resolved 6.0.0 in Step 1 |
| Password hashing | Node built-in crypto.scrypt (N=2^17, r=8, p=1), format scrypt$N$r$p$salt$hash | No native dependency. Parameters are from memory of OWASP guidance, not verified this session |
| OCR | Tesseract + OpenCV (inside processor image) | Free, local, no data leaves the machine |
| Spreadsheets | pandas, openpyxl, xlrd | Standard |
| LLM | Any OpenAI-compatible API, configured from an admin panel (provider, base URL, model, key, test button, fallback model). Fallback ladder: json_schema, then json_object + Pydantic validation + retry | Free tiers differ in structured-output support; client can switch to a private/paid provider later without code changes |
| Embeddings | all-MiniLM-L6-v2, local (384 dimensions) | Free, text never leaves the machine. Not yet confirmed by owner; changing the model needs a migration (vector size) |
| Frontend | Next.js + Tailwind (quality UI) | Assignment suggests it |
| Auth | JWT, roles admin/user | Required for access control |
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
  docs/                     assignment PDF, AI instructions (owner adds)
  api/                      NestJS 11
    src/main.ts, app.module.ts
    src/config/env.ts       requireEnv()
    src/health/             health controller/service/spec (db, redis, processor)
    src/database/           data-source.ts (migration CLI) + migrations/1793232000000-InitialSchema.ts
    src/users/              (Step 4A, code given, not yet run) user.entity, password.service(+spec), users.service, admin-seed.service, users.module
  processor/                FastAPI
    app/main.py             GET /health
    tests/test_health.py
```

## 6. Environment
Ports on host: api 4700 (container 4000; host 4000 is blocked by a Windows reserved port range), db 5433, redis 6500 (6380 was blocked). Processor 8001 is NOT published (Docker network only, verified).
If a port fails after reboot: `netsh interface ipv4 show excludedportrange protocol=tcp`
Env vars (see .env.example): POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, DATABASE_URL, REDIS_URL, PORT, PROCESSOR_URL. Step 4A adds ADMIN_EMAIL, ADMIN_PASSWORD (min 12 chars).
IMPORTANT: `docker compose restart` does NOT reload .env. Use `docker compose up -d --force-recreate api`.

## 7. Database schema
IMPLEMENTED (Step 3, migration 1793232000000-InitialSchema): users, documents, document_pages, invoices, invoice_line_items, validation_issues, corrections, processing_events, document_chunks + typeorm_migrations. Verified: vector(384) column, HNSW (cosine) index, GIN full-text index, CHECK constraints reject bad values, migrate/revert/re-run works.
Run: `docker compose exec api npm run migration:run` (revert: `npm run migration:revert`).
Design rules: money as numeric(18,4) (never float); duplicate invoices are flagged, not blocked by a unique constraint (index on supplier_name + invoice_number); one document can contain many invoices; queue holds IDs only; events/audit log avoid storing document contents; synchronize is false, migrations are the schema owner. Later: app_settings (LLM config, Step 10). Never edit an applied migration, add a new one.

## 8. API plan (not implemented yet)
Auth (login, me), upload (multi-file), document list/status, extracted results, search (keyword + semantic), manual correction, reprocess failed, admin LLM settings, health. OpenAPI/Swagger docs at the end.
Step 4B plan: POST /auth/login, GET /auth/me, JWT guard, roles guard (admin/user), login rate limit (scrypt uses ~128MB RAM per hash), helmet, global ValidationPipe, CORS locked to the frontend, JWT secret from env.

## 9. Commands
- Start: `docker compose up -d --build`
- Status: `docker compose ps`
- Health: `curl.exe -i http://localhost:4700/health`
- API tests: `docker compose exec api npm test`
- Processor tests: `docker compose exec processor python -m pytest -q`
- Build: `docker compose exec api npm run build`
- Migrations: `docker compose exec api npm run migration:run`
- Logs: `docker compose logs <service> --tail 40`
- DB shell: `docker compose exec db psql -U docintel -d docintel`

## 10. Security rules
No secrets in git; validate uploads (magic bytes, size, limits); JWT + roles; AI output is untrusted until validated; queue payload IDs only; processor not exposed; free LLM tiers may send data to third parties, so only synthetic/public documents are used, and this is stated openly in the README; encrypted storage of LLM API keys; audit trail for corrections; npm audit currently reports 10 vulnerabilities (8 low, 2 high), to be reviewed in Step 22.

## 11. Decisions and research log
- Docker is used on purpose: the system needs Postgres with pgvector, Redis, and Python with Tesseract; Docker makes it reproducible for interviewers (`docker compose up`) and easier to deploy. Not required by the assignment. Trade-off: slower dev loop and Windows quirks (ports, bind mounts).
- 2026-10-28: Chose NestJS + Python split, Postgres+pgvector, BullMQ, TypeORM. Sources: BullMQ production guide, pgvector-node ORM support (mostly third-party pages).
- 2026-10-29: TypeORM 1.0 was released in 2026 and NestJS integration needs @nestjs/typeorm 11.0.1+ (typeorm.io release blog, InfoQ). The 0.3 line still gets releases (0.3.31, July 2026). Decision: pin 0.3.31 for stability; upgrade later via the official codemod if wanted.
- 2026-10-29: npm resolved ioredis 6 in Step 1, which conflicted with typeorm. Pinned ioredis 5.11.1. Check BullMQ's ioredis requirement before Step 6.
- 2026-10-29: Windows reserved port ranges blocked host ports 4000 and 6380 after a reboot; changed to 4700 and 6500.
- 2026-10-29: Password hashing uses built-in scrypt to avoid native build problems. Parameters not verified against current OWASP text.
- Groq/Gemini structured-output differences are the reason for the json_schema -> json_object fallback ladder.
- Vercel hosts only the Next.js frontend. API, worker, processor, Postgres, Redis need a Docker host (free options not verified; decide in Step 22-23).

## 12. Progress
| Step | Description | Status | Evidence |
|---|---|---|---|
| 1 | Docker infra + NestJS /health | DONE | All TC passed (2026-10-28) |
| 2 | Python processor + NestJS connection | DONE | All TC passed (2026-10-28): processor not reachable from host, 503 when processor stopped |
| 3 | DB schema + TypeORM migrations | DONE | All TC passed (2026-10-29): 10 tables, vector(384), hnsw+gin indexes, bad role rejected, migrate/revert/re-run works |
| 4A | TypeORM wiring, User entity, scrypt hashing, admin seed | IN PROGRESS | Code given to owner, NOT yet run. Expected after run: 8 API tests passing, admin row in users |
| 4B | JWT login, guards, roles, rate limit, helmet, validation | TODO | |
| 5 | Secure upload API | TODO | |
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

Current test status: API 3 tests passing, processor 1 passing (as of Step 3).

## 13. Known issues and todo
- Migrations are NOT run automatically. A fresh clone + `docker compose up` crashes once the API needs the users table. Must be automated before delivery (Step 22/23).
- Python packages unpinned (pin in Step 22). httpx deprecation warning in processor tests (harmless).
- npm install-scripts warning (@parcel/watcher, unrs-resolver) ignored for now.
- Free hosting will not handle a 1000-page OCR run; the live demo uses small samples (state in README).
- Tests must never use real confidential invoices.

## 14. Next action
Run Step 4A (install @nestjs/typeorm@11.0.3 --save-exact, add the users module files, add ADMIN_EMAIL/ADMIN_PASSWORD to .env and .env.example, `docker compose up -d --force-recreate api`, run TC1-TC8), then Step 4B.
