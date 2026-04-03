# Claude Code Project Context

This project is a monorepo for a Job Search Agent application with a FastAPI backend and a Next.js frontend.

## High-level purpose

The app helps manage a universe of companies, discover their careers pages, scrape job counts, and iteratively refine scraping results. It supports seeding companies from major stock indexes, filtering companies in the UI, and running bulk refresh workflows.

## Tech stack

### Backend
- FastAPI
- SQLAlchemy 2.x
- SQLite
- Pydantic / pydantic-settings
- Playwright for job count scraping
- OpenAI + openai-agents for career page discovery

### Frontend
- Next.js 14 (pages router)
- React 18
- TypeScript

## Monorepo layout

- `services/api` -> FastAPI backend
- `apps/web` -> Next.js frontend

Important backend folders:
- `app/api/routes` -> HTTP routes
- `app/repositories` -> DB query/filter logic
- `app/services` -> orchestration logic
- `app/models` -> SQLAlchemy models
- `app/schemas` -> response/request schemas
- `app/sources` -> stock-index company seeders
- `app/agents` -> AI-powered career page discovery
- `app/scrapers` -> Playwright-based scraping logic

Important frontend files:
- `apps/web/pages/index.tsx` -> main companies page
- `apps/web/pages/company/[ticker].tsx` -> company detail page
- `apps/web/pages/runs/index.tsx` -> scrape run list
- `apps/web/pages/runs/[runId].tsx` -> scrape run detail
- `apps/web/lib/api.ts` -> frontend API client

## Core data model

The main entity is `Company`.

Important fields:
- `ticker`
- `name`
- `sector`
- `industry`
- `universe`
- `career_page_url`
- `career_page_source`
- `job_count`
- `job_count_extraction_method`
- `last_scraped_at`
- `last_scrape_status`
- `last_scrape_error`
- `hq_city`
- `hq_state`
- `hq_location`

## Universe behavior

`Company.universe` is stored as a comma-separated string, not a normalized join table.

Examples:
- `sp500`
- `sp500,dow_jones`
- `sp500,nasdaq100`
- `dow_jones,nasdaq100,sp500`

When a company already exists and is seeded again from another index, the universe must be merged, not overwritten.

Current known universe tokens:
- `sp500`
- `dow_jones`
- `nasdaq100`
- `russell2000`
- `sample`

## Current seed capabilities

The app can seed companies from these indexes:
- S&P 500
- Dow Jones
- Nasdaq 100
- Russell 2000

Admin endpoints:
- `POST /admin/seed/sp500`
- `POST /admin/seed/dow_jones`
- `POST /admin/seed/nasdaq100`
- `POST /admin/seed/russell2000`

Notes:
- S&P 500, Dow Jones, and Nasdaq 100 use public web sources.
- Russell 2000 currently uses a public CSV source.
- Duplicate companies are matched by ticker.
- Existing companies are updated and their `universe` is merged.

## Scraping flow

There are two main scraping workflows:

### 1. Single company refresh
For a specific company:
1. Find the company by ticker
2. Use an OpenAI-powered agent to discover its careers page
3. Persist the discovered career page URL
4. Persist HQ city/state if discovered
5. Use Playwright to scrape the job count from the careers page
6. Store job count and scrape status fields

Possible scrape statuses:
- `success`
- `failed`
- `blocked`
- `not_found`
- `null` meaning never scraped

### 2. Bulk refresh
Bulk refresh creates a scrape run and processes many companies.

Supported modes:
- Refresh all companies in a selected universe
- Refresh only failed/non-success companies in a selected universe

Important behavior:
- Only one bulk run should be active at a time
- SQLite write access is serialized with a lock during bulk runs
- Bulk runs track counts for:
  - success
  - failed
  - blocked
  - not_found

Relevant routes:
- `POST /scrape/all`
- `GET /scrape/runs`
- `GET /scrape/runs/{run_id}`
- `GET /scrape/runs/{run_id}/companies`

`POST /scrape/all` supports:
- `universe`
- `tickers`
- `failed_only`

## UI layout and main user flow

The main UI is the companies table on `apps/web/pages/index.tsx`.

### Top actions
The page includes:
- Seed buttons for:
  - S&P 500
  - Dow Jones
  - Nasdaq 100
  - Russell 2000
- `Refresh All (Universe)` button
- `Refresh Failed` button
- link to scrape runs

### Main companies table
The user can browse companies and see fields like:
- name
- ticker
- universe
- job count
- last scrape status
- HQ location
- last scraped date

### Filters currently supported in the UI
- Search by company name or ticker
- Sector dropdown
- Universe dropdown
- Last Scrape Status dropdown
- State dropdown
- City dropdown
- Sort dropdown
- Pagination

### Filter behavior details
- `Universe` filters companies whose comma-separated universe contains the selected token
- `Last Scrape Status` supports:
  - all
  - never
  - success
  - failed
  - blocked
  - not_found
- `State` filters by `hq_state`
- `City` is only shown after a state is selected
- City dropdown only lists cities in the selected state
- City labels show company counts, e.g. `Chicago (42)`
- Cities are sorted by company count descending, then city name ascending

### Refresh flow
- `Refresh All (Universe)` runs a bulk scrape for the selected universe or default universe
- `Refresh Failed` runs a bulk scrape only for companies whose last scrape status is not `success`
- The UI shows bulk run progress and links to run details

## API/filter architecture

The frontend is thin and relies on backend filtering. When changing filters, keep backend and frontend in sync.

Backend company list route:
- `GET /companies`

Supported query params currently include:
- `search`
- `sector`
- `universe`
- `last_scrape_status`
- `state`
- `city`
- `sort`
- `page`
- `page_size`

Filter option routes:
- `GET /sectors`
- `GET /universes`
- `GET /companies/filters/last-scrape-statuses`
- `GET /companies/filters/states`
- `GET /companies/filters/cities?state=CA`

Important implementation detail:
specific filter routes like `/companies/filters/...` must be declared before `/companies/{ticker}` in FastAPI route registration.

## Important backend implementation details

- SQLite is the main DB
- Bulk writes are serialized because SQLite allows one writer at a time
- Universe filtering is token-based against a comma-separated string
- The frontend and backend filter params must stay aligned
- Scrape-derived data should not be accidentally overwritten during seeding
- External source scrapers can break if source HTML/CSV format changes

## How to run locally

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

Frontend URL:
- `http://localhost:3000`

Backend URL:
- `http://localhost:8000`

Frontend env:
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`

## Guidance for future edits

When making changes:
- preserve the comma-separated universe semantics
- merge universes instead of overwriting them
- keep backend filters, frontend API params, and UI dropdowns synchronized
- be careful with FastAPI route ordering
- be careful with SQLite write concurrency
- prefer small targeted changes over large refactors
