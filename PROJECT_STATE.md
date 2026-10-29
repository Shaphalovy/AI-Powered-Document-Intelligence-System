# PROJECT_STATE (handoff document)

Last updated: 2026-10-29. Update this file at the end of every step.

## 0. How to use this file (for any AI assistant or person)
1. Read this file fully, then the assignment summary in section 2.
2. Run the commands in section 9 and confirm the current state before changing anything.
3. Work ONE step at a time. After each step give the owner test cases (TC) with exact copy-paste commands and expected output, then wait for the real output.
4. Never claim something is verified unless it was actually run or checked in a reliable source. Separate "verified" from "assumed".
5. Before recommending any tool/library/version, check current official docs and known issues, and cite them with the date checked.
6. Owner preferences: reply in short Banglish (Bengali in English letters), plain step-by-step, commands as copyable text, one command per block, always include a "harsh truth" when giving suggestions, ask a question first if in doubt, double-check answers.
7. Never put secrets in git. Never send real confidential invoices to any external service (use synthetic or public samples).

## 1. Project
AI-Powered Document Intelligence System (Senior AI Engineer take-home assignment).
Owner: Sabbir. Location: E:\Projects\docintel (Windows, Docker Desktop, Node installed on PC).
Constraints: 100% free (no paid APIs or tools). Quality over speed; the 5-day deadline is relaxed by the owner (may finish later and use it in a portfolio).
Extra goal: a live online demo so interviewers can test without installing anything, plus `docker compose up` for local run.

## 2. Assignment requirements (source of truth: senior-ai-enginner.pdf)
Business problem: thousands of invoices/receipts/scanned PDFs/images/Excel/CSV per day (PDFs up to ~1000 pages). Needs extraction, validation, PDF-PDF and PDF-Excel cross verification, search.

| Task | Requirement | Planned step | Status |
|---|---|---|---|
| 1 | Accept PDF, JPG, PNG, TIFF, XLSX, XLS, CSV. Text from digital PDFs, OCR for scans/images, parse spreadsheets. Multi-page, multi-sheet, poor quality, corrupted files | 5, 7, 8, 9 | Not started |
| 2 | Extract invoice no, date, supplier, customer, subtotal, tax, total, currency, line items as JSON. Never invent missing values | 10, 11 | Not started |
| 3 | Validation: missing fields, bad numbers, duplicates, subtotal/tax/line-item/total mismatch. Flag for manual review | 12, 13 | Not started |
| 4 | REST APIs: upload, status, results, search, manual corrections, failed-job reprocess. Background processing | 4, 5, 6, 15 | Not started |
| 5 | DB for metadata, text, structured results, validation errors, history. Keyword filter + semantic search | 3, 14 | Step 3 in progress |
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
| Queue | BullMQ on Redis 7 (noeviction + AOF verified) | Assignment suggests it. Queue payload = document ID only (job data is plain text in Redis) |
| ORM / migrations | TypeORM 0.3.31 (pinned) | See section 11. TypeORM 1.0 exists but was not chosen for now |
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
  api/                      NestJS 11
    src/main.ts, app.module.ts
    src/config/env.ts       requireEnv()
    src/health/             health controller/service/spec (db, redis, processor)
    src/database/           data-source.ts + migrations/ (Step 3)
  processor/                FastAPI
    app/main.py             GET /health
    tests/test_health.py
```

## 6. Environment
Ports on host: api 4700 (4000 is blocked by a Windows reserved port range), db 5433, redis 6500 (6380 was blocked). Processor 8001 is NOT published. If a port fails after reboot: netsh interface ipv4 show excludedportrange protocol=tcp

## 7. Database schema (planned in Step 3; update when implemented)
users, documents, document_pages, invoices, invoice_line_items, validation_issues, corrections, processing_events, document_chunks (embedding vector(384) + full-text column). Later: app_settings (LLM config, Step 10).
Design rules: money as numeric (never float); duplicate invoices are flagged, not blocked by a unique constraint; queue holds IDs only; events/audit log avoid storing document contents.

## 8. API plan (not implemented yet)
Auth (login), upload (multi-file), document list/status, extracted results, search (keyword + semantic), manual correction, reprocess failed, admin LLM settings, health. OpenAPI/Swagger docs at the end.

## 9. Commands
- Start: `docker compose up -d --build`
- Status: `docker compose ps`
- Health: `curl.exe -i http://localhost:4700/health`
- API tests: `docker compose exec api npm test`
- Processor tests: `docker compose exec processor python -m pytest -q`
- Build: `docker compose exec api npm run build`
- Logs: `docker compose logs <service> --tail 40`
- Windows note: if code changes are not picked up, `docker compose restart api`

## 10. Security rules
No secrets in git; validate uploads (magic bytes, size, limits); JWT + roles; AI output is untrusted until validated; queue payload IDs only; processor not exposed; free LLM tiers may send data to third parties, so only synthetic/public documents are used, and this is stated openly in the README; encrypted storage of LLM API keys; audit trail for corrections.

## 11. Decisions and research log
- 2026-10-28: Chose NestJS + Python split, Postgres+pgvector, BullMQ, TypeORM. Sources used: BullMQ production guide, pgvector-node ORM support (mostly third-party pages).
- 2026-10-29: TypeORM 1.0 was released in 2026 and NestJS integration needs @nestjs/typeorm 11.0.1+ (typeorm.io release blog, InfoQ). The 0.3 line also still gets releases (0.3.31, July 2026). Decision: pin 0.3.31 for stability; upgrade later via the official codemod if wanted.
- Groq/Gemini structured-output differences are the reason for the json_schema -> json_object fallback ladder.

## 12. Progress
| Step | Description | Status | Evidence |
|---|---|---|---|
| 1 | Docker infra + NestJS /health | DONE | All TC passed (2026-10-28) |
| 2 | Python processor + NestJS connection | DONE | All TC passed (2026-10-28): 3 API tests, 1 processor test, processor not reachable from host, 503 when processor stopped |
| 3 | DB schema + TypeORM migrations | IN PROGRESS | - |
| 4 | Auth (JWT, roles), security basics | TODO | |
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
| 22 | Security + performance pass, pin all package versions, deployment | TODO | |
| 23 | README, diagram, schema, prompts, AI disclosure, video | TODO | |

## 13. Known issues and todo
- Python packages unpinned (pin in Step 22). httpx deprecation warning in processor tests (harmless).
- Deployment: Vercel hosts only the Next.js frontend. API, worker, processor, Postgres, Redis need a Docker host (free options not verified; decide in Step 22-23). Free hosting will not handle a 1000-page OCR run; the live demo uses small samples (state in README).
- Tests must never use real confidential invoices.

## 14. Next action
Finish Step 3: install typeorm 0.3.31, add data-source + initial migration, run it, verify tables.