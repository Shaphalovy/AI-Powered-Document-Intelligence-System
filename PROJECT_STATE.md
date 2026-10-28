# PROJECT_STATE

Project: AI-Powered Document Intelligence System (Senior AI Engineer assignment)
Location: E:\Projects\docintel
Rule: everything free, no paid API/tools. Quality over speed. No real confidential invoices in tests.

## Stack
- api: NestJS 11 (Node 24 in Docker)
- processor: Python 3.12 FastAPI (internal only, no public port)
- db: pgvector/pgvector:pg17 (pgvector 0.8.7 verified)
- redis: redis:7-alpine (noeviction + appendonly verified)
- Planned: TypeORM, BullMQ, Tesseract/OpenCV, pandas/openpyxl, OpenAI-compatible LLM (admin-configurable), Next.js

## Ports (host)
api 4000, db 5433, redis 6380. processor 8001 is Docker-network only.

## Done
- Step 1: infra + NestJS /health. All TC passed.
- Step 2: processor service + NestJS checks it in /health. All TC passed.

## Next
- Step 3: DB schema + TypeORM migrations

## Commands
- Start: docker compose up -d --build
- API tests: docker compose exec api npm test
- Processor tests: docker compose exec processor python -m pytest -q
- Build: docker compose exec api npm run build

## Known issues / todo
- Package versions unpinned (pin in Step 22)
- httpx deprecation warning in processor tests (harmless)
- Deployment plan: Vercel for frontend only, backend needs a Docker host (decide at Step 22-23)

## Roadmap
1 Infra, 2 Processor, 3 DB schema, 4 Auth, 5 Upload, 6 BullMQ, 7 PDF+OCR, 8 Image/TIFF, 9 Excel/CSV, 10 LLM layer, 11 Extraction, 12 Validation, 13 Cross-document check, 14 Search, 15 Correction/audit/reprocess APIs, 16-19 Next.js, 20 Dataset, 21 Tests+evaluation, 22 Security+performance, 23 README/diagram/disclosure/video