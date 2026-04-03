# Claude Code Short Prompt

Use this repo as a monorepo with:

- `services/api` = FastAPI backend
- `apps/web` = Next.js frontend

The app manages companies, seeds them from stock indexes, discovers career pages, scrapes job counts, and supports bulk refresh workflows.

Important concepts:

- Main model is `Company`
- `Company.universe` is a comma-separated string, not a normalized relation
- Existing universes must be merged, not overwritten
- Known universe tokens: `sp500`, `dow_jones`, `nasdaq100`, `russell2000`, `sample`
- Scrape statuses include `success`, `failed`, `blocked`, `not_found`, and `null` for never scraped
- UI uses `never` as the filter token for null scrape status

Current capabilities:

- Seed indexes:
  - `POST /admin/seed/sp500`
  - `POST /admin/seed/dow_jones`
  - `POST /admin/seed/nasdaq100`
  - `POST /admin/seed/russell2000`
- Refresh a single company
- Bulk refresh all companies in a universe
- Bulk refresh only failed/non-success companies in a universe
- Filter companies by:
  - search
  - sector
  - universe
  - last scrape status
  - state
  - city

UI notes:

- Main page is `apps/web/pages/index.tsx`
- Frontend API client is `apps/web/lib/api.ts`
- City dropdown appears only when a state is selected
- City dropdown shows only cities in that state
- City labels include company counts, e.g. `Chicago (42)`
- Cities are sorted by company count descending

Backend notes:

- SQLite is used, so concurrent writes are constrained
- Bulk scrape uses a DB write lock intentionally
- FastAPI filter routes like `/companies/filters/...` must be declared before `/companies/{ticker}`

Files to edit for most changes:

- filters/listing:
  - `services/api/app/repositories/company_repo.py`
  - `services/api/app/api/routes/companies.py`
  - `apps/web/lib/api.ts`
  - `apps/web/pages/index.tsx`
- seeding:
  - `services/api/app/services/seeding.py`
  - `services/api/app/sources/*`
  - `services/api/app/api/routes/admin.py`
- scraping:
  - `services/api/app/services/scrape_service.py`
  - `services/api/app/services/bulk_scrape_service.py`
  - `services/api/app/agents/career_discovery_agent.py`
  - `services/api/app/scrapers/job_count_extractor.py`

Run locally:

```bash
cd services/api
uv sync
cp env.example .env
uv run python -m playwright install chromium
uv run uvicorn app.main:app --reload --port 8000
```

```bash
cd apps/web
npm install
npm run dev
```

Frontend:
- `http://localhost:3000`

Backend:
- `http://localhost:8000`
