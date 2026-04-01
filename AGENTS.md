# AGENTS.md

## Purpose

This repo is a monorepo for a job search application with:

- `services/api`: FastAPI backend
- `apps/web`: Next.js frontend

The system stores companies, seeds them from index sources, discovers company career pages, scrapes job counts, and lets users filter and bulk-refresh companies.

## Run Commands

### Backend

```bash
cd services/api
uv sync
cp env.example .env
uv run python -m playwright install chromium
uv run uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd apps/web
npm install
npm run dev
```

URLs:

- frontend: `http://localhost:3000`
- backend: `http://localhost:8000`

## Important Env Vars

Backend config is in `services/api/app/core/config.py`.

Important variables:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `CORS_ORIGINS`
- `PLAYWRIGHT_HEADLESS`
- `PLAYWRIGHT_NAV_TIMEOUT_MS`
- `SCRAPE_MAX_RETRIES`
- `SCRAPE_DOMAIN_DELAY_MS`
- `BULK_SCRAPE_CONCURRENCY`
- `BULK_SCRAPE_MAX_COMPANIES`
- `BULK_SCRAPE_UNIVERSE_DEFAULT`

Frontend:

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`

## Where To Edit

### Filters and company listing

- backend repo logic: `services/api/app/repositories/company_repo.py`
- backend routes: `services/api/app/api/routes/companies.py`
- frontend API client: `apps/web/lib/api.ts`
- frontend page: `apps/web/pages/index.tsx`

### Scraping

- single-company scrape: `services/api/app/services/scrape_service.py`
- bulk scrape: `services/api/app/services/bulk_scrape_service.py`
- career discovery agent: `services/api/app/agents/career_discovery_agent.py`
- job count scraper: `services/api/app/scrapers/job_count_extractor.py`

### Seeding indexes

- seeding service: `services/api/app/services/seeding.py`
- sources: `services/api/app/sources/`
- admin routes: `services/api/app/api/routes/admin.py`
- frontend seed buttons: `apps/web/pages/index.tsx`

## Data Model Notes

Main model:

- `Company` in `services/api/app/models/company.py`

Important fields:

- `ticker`
- `name`
- `universe`
- `job_count`
- `last_scrape_status`
- `last_scrape_error`
- `last_scraped_at`
- `hq_city`
- `hq_state`

### Universe field

`Company.universe` is a comma-separated string, not a join table.

Examples:

- `sp500`
- `sp500,dow_jones`
- `sp500,nasdaq100`

Do not overwrite it for existing companies. Merge tokens.

Known universe tokens:

- `sp500`
- `dow_jones`
- `nasdaq100`
- `russell2000`
- `sample`

## Current Seed Sources

Supported admin seed endpoints:

- `POST /admin/seed/sp500`
- `POST /admin/seed/dow_jones`
- `POST /admin/seed/nasdaq100`
- `POST /admin/seed/russell2000`

Source modules:

- `sp500.py`
- `dow_jones.py`
- `nasdaq100.py`
- `russell2000.py`

## Scrape Semantics

Single scrape flow:

1. resolve company by ticker
2. discover career page with OpenAI
3. persist HQ city/state if returned
4. scrape job count with Playwright
5. persist `job_count`, `last_scrape_status`, `last_scrape_error`, `last_scraped_at`

Observed scrape statuses:

- `success`
- `failed`
- `blocked`
- `not_found`
- `null` = never scraped

UI filter uses `never` to represent null.

## Bulk Scrape Notes

Bulk scrape service:

- `services/api/app/services/bulk_scrape_service.py`

Important behavior:

- blocks concurrent runs
- serializes DB writes with a lock because SQLite allows one writer at a time
- supports normal universe refresh
- supports failed-only refresh

`POST /scrape/all` can take:

- `universe`
- `tickers`
- `failed_only`

## Current Filters

Backend/company list currently supports:

- `search`
- `sector`
- `universe`
- `last_scrape_status`
- `state`
- `city`
- `sort`
- `page`
- `page_size`

Filter option endpoints:

- `GET /sectors`
- `GET /universes`
- `GET /companies/filters/last-scrape-statuses`
- `GET /companies/filters/states`
- `GET /companies/filters/cities?state=CA`

### City dropdown behavior

- only show city filter after state is selected
- only list cities for the selected state
- show city counts in the label
- sort cities by company count descending, then city name ascending

## Important Constraints

### Route ordering

In `companies.py`, declare specific filter routes before:

- `/companies/{ticker}`

Otherwise paths like `/companies/filters/states` may be parsed as a ticker route.

### SQLite

- avoid careless concurrent writes
- bulk write lock is intentional

### Frontend/backend sync

When adding a filter or changing a response shape, update all of:

1. backend repository
2. backend route
3. frontend API client types
4. frontend page state and request wiring

## Quick Checks

Frontend lint:

```bash
cd apps/web
npm run lint
```

Backend currently has no dedicated lint/test command documented in repo metadata.

## Practical Guidance

- Prefer small, targeted edits.
- Preserve existing scrape-derived data unless the change explicitly requires overwriting it.
- When adding new index sources, merge universes for duplicate tickers.
- Be cautious with Wikipedia-based scrapers; page structure can change.
- Russell 2000 currently uses a public CSV source, not Wikipedia.
- Do not commit secrets from `.env` files.

