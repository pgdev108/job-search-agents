# CLAUDE.md

## Project Overview

This repository is a monorepo for a **Job Search Agent** application with:

- `services/api`: FastAPI backend
- `apps/web`: Next.js frontend

The app stores companies, seeds them from stock index sources, discovers career pages, scrapes job counts, and exposes filters for universe, sector, scrape status, state, and city.

## Monorepo Layout

```text
job-search-agents/
├── apps/
│   └── web/
│       ├── lib/api.ts
│       └── pages/
├── services/
│   └── api/
│       ├── app/
│       │   ├── agents/
│       │   ├── api/routes/
│       │   ├── core/
│       │   ├── db/
│       │   ├── models/
│       │   ├── repositories/
│       │   ├── schemas/
│       │   ├── scrapers/
│       │   ├── services/
│       │   └── sources/
│       ├── data/
│       ├── env.example
│       └── pyproject.toml
└── README.md
```

## How To Run

### Backend

```bash
cd services/api
uv sync
cp env.example .env
uv run python -m playwright install chromium
uv run uvicorn app.main:app --reload --port 8000
```

Backend default URL:

- `http://localhost:8000`

### Frontend

```bash
cd apps/web
npm install
npm run dev
```

Frontend default URL:

- `http://localhost:3000`

### Frontend Env

Set in `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Backend Notes

### Stack

- FastAPI
- SQLAlchemy 2.x + SQLite
- Pydantic / pydantic-settings
- Playwright
- OpenAI + openai-agents
- Requests / BeautifulSoup / lxml

### Startup Behavior

- FastAPI app is created in `services/api/app/main.py`
- DB initialization runs in the app lifespan via `init_db()`
- CORS origins come from `CORS_ORIGINS`
- SQLite DB lives under `services/api/data/app.db`

### Key Config

Defined in `services/api/app/core/config.py`.

Important env vars:

- `OPENAI_API_KEY`: required for scrape endpoints
- `OPENAI_MODEL`: defaults to `gpt-4o`
- `CORS_ORIGINS`
- `PLAYWRIGHT_HEADLESS`
- `PLAYWRIGHT_NAV_TIMEOUT_MS`
- `SCRAPE_MAX_RETRIES`
- `SCRAPE_DOMAIN_DELAY_MS`
- `BULK_SCRAPE_CONCURRENCY`
- `BULK_SCRAPE_MAX_COMPANIES`
- `BULK_SCRAPE_UNIVERSE_DEFAULT`
- `BULK_SCRAPE_REQUEST_TIMEOUT_SEC`

## Frontend Notes

### Stack

- Next.js 14 pages router
- React 18
- TypeScript

### Main UI

Primary page:

- `apps/web/pages/index.tsx`

API client:

- `apps/web/lib/api.ts`

The web app is thin and relies on backend filtering. When adding filters, update both:

1. backend route + repository
2. `CompanyListParams` and `getCompanies()` in `apps/web/lib/api.ts`
3. `apps/web/pages/index.tsx`

## Core Domain Model

Primary model:

- `Company` in `services/api/app/models/company.py`

Important fields:

- `ticker`
- `name`
- `sector`
- `industry`
- `universe`
- `career_page_url`
- `job_count`
- `last_scrape_status`
- `last_scrape_error`
- `last_scraped_at`
- `hq_city`
- `hq_state`

### Universe Semantics

`Company.universe` is a **comma-separated string**, not a normalized join table.

Examples:

- `sp500`
- `sp500,dow_jones`
- `nasdaq100,sp500`

Do not overwrite universe blindly for existing companies. Merge tokens.

Current known universe tokens:

- `sp500`
- `dow_jones`
- `nasdaq100`
- `russell2000`
- `sample`

## Seeding / Index Sources

Seeding is handled in:

- `services/api/app/services/seeding.py`

Existing source modules:

- `services/api/app/sources/sp500.py`
- `services/api/app/sources/dow_jones.py`
- `services/api/app/sources/nasdaq100.py`
- `services/api/app/sources/russell2000.py`

Admin seed routes:

- `POST /admin/seed/sp500`
- `POST /admin/seed/dow_jones`
- `POST /admin/seed/nasdaq100`
- `POST /admin/seed/russell2000`

### Important Seeding Rule

Companies are matched by `ticker`.

If a company already exists:

- update basic metadata
- merge `universe`
- do **not** destroy scrape-derived fields unnecessarily

## Scraping Flow

Single-company scrape is orchestrated in:

- `services/api/app/services/scrape_service.py`

High-level flow:

1. Find company by ticker
2. Discover career page using the OpenAI agent
3. Persist discovered URL / HQ city / HQ state
4. Run Playwright-based job count extraction
5. Store `job_count`, `last_scrape_status`, `last_scrape_error`, `last_scraped_at`
6. Log events in `CompanyScrapeEvent`

### Scrape Status Values

Observed statuses:

- `success`
- `failed`
- `blocked`
- `not_found`
- `null` meaning never scraped

UI uses `never` as the filter token for null scrape status.

## Bulk Scrape

Bulk orchestration lives in:

- `services/api/app/services/bulk_scrape_service.py`

Important behavior:

- prevents concurrent bulk runs
- uses a DB write lock because SQLite only allows one writer at a time
- supports full-universe runs
- supports `failed_only=True` runs

Routes:

- `POST /scrape/all`
- `GET /scrape/runs`
- `GET /scrape/runs/{run_id}`
- `GET /scrape/runs/{run_id}/companies`

Request body for `POST /scrape/all` can include:

- `universe`
- `tickers`
- `failed_only`

## Company Filters

The backend currently supports:

- `search`
- `sector`
- `universe`
- `last_scrape_status`
- `state`
- `city`
- `sort`
- `page`
- `page_size`

Routes for filter dropdowns:

- `GET /sectors`
- `GET /universes`
- `GET /companies/filters/last-scrape-statuses`
- `GET /companies/filters/states`
- `GET /companies/filters/cities?state=IL`

### City Filter Behavior

- city dropdown only makes sense after a state is selected
- city options are returned for the selected state only
- response includes company counts per city
- cities are sorted by company count descending, then city name ascending

## Current UI Features

Main page currently includes:

- companies table
- search
- sector filter
- universe filter
- last scrape status filter
- state filter
- conditional city filter
- sort + pagination
- seed buttons
- refresh single company
- refresh all for selected universe
- refresh failed/non-success for selected universe
- recent scrape runs and progress banner

## Important Implementation Details

### Route Ordering

In FastAPI, more specific routes like:

- `/companies/filters/states`
- `/companies/filters/cities`

must be declared before:

- `/companies/{ticker}`

Otherwise the filter route may be captured as a ticker.

### SQLite Constraints

- Be careful with concurrent writes
- bulk scraping serializes DB writes with a lock
- avoid introducing write-heavy parallel DB patterns without considering SQLite locking

### LIKE / Universe Filtering

Universe filtering is implemented against a comma-separated string and must match full tokens, not substrings.

If editing universe logic, do not regress support for:

- exact token match
- start token
- middle token
- end token

### External Data Sources

Wikipedia parsing can break if markup changes.

Russell 2000 currently uses a public CSV source rather than Wikipedia. If that source changes format or disappears, the source module will need updating.

## Recommended Commands

### Backend

```bash
cd services/api
uv sync
uv run uvicorn app.main:app --reload --port 8000
uv run python -m playwright install chromium
```

### Frontend

```bash
cd apps/web
npm install
npm run dev
```

### Useful Local Checks

```bash
cd apps/web
npm run lint
```

For backend there is currently no dedicated lint/test command documented in repo metadata.

## Files To Check First For Common Tasks

### Add/change filters

- `services/api/app/repositories/company_repo.py`
- `services/api/app/api/routes/companies.py`
- `apps/web/lib/api.ts`
- `apps/web/pages/index.tsx`

### Add seed source / index

- `services/api/app/sources/`
- `services/api/app/services/seeding.py`
- `services/api/app/api/routes/admin.py`
- `apps/web/lib/api.ts`
- `apps/web/pages/index.tsx`

### Change scraping behavior

- `services/api/app/services/scrape_service.py`
- `services/api/app/services/bulk_scrape_service.py`
- `services/api/app/agents/career_discovery_agent.py`
- `services/api/app/scrapers/job_count_extractor.py`

### Change models / response shapes

- `services/api/app/models/`
- `services/api/app/schemas/`
- `apps/web/lib/api.ts`

## Guidance For Future Edits

- Prefer preserving current data semantics over broad refactors.
- Keep frontend and backend filter params in sync.
- When adding new dropdowns, also add dedicated backend endpoints if the UI needs distinct option lists.
- When changing scrape status handling, check:
  - company list filtering
  - refresh failed behavior
  - run counters in bulk scrape
- When adding new index seeders, merge universes instead of overwriting.
- Avoid storing secrets in committed files.

