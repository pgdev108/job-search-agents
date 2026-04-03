# Claude Code Architecture Brief

## Goal

This app helps users maintain and scrape a universe of companies for job-search research. It combines:

- stock-index seeding
- career page discovery
- job count extraction
- bulk refresh workflows
- rich filtering in the UI

## Product Flow

### 1. Seed companies

Users can populate the company list from major stock indexes:

- S&P 500
- Dow Jones
- Nasdaq 100
- Russell 2000

Seeding inserts new companies and updates existing companies by ticker. If a company exists in multiple indexes, the `universe` field stores a merged comma-separated list.

### 2. View and filter companies

The main UI is the companies table on `apps/web/pages/index.tsx`.

Users can filter by:

- search
- sector
- universe
- last scrape status
- state
- city

The city filter is dependent on the state filter.

### 3. Refresh a company

A single-company refresh:

1. discovers the career page using an OpenAI-based agent
2. extracts HQ city/state if found
3. scrapes job count using Playwright
4. stores status and errors

### 4. Run bulk refresh

Users can:

- refresh all companies in a selected universe
- refresh only failed/non-success companies in a selected universe

Bulk runs are tracked and visible in dedicated run pages.

## Architecture

### Frontend

Next.js pages-router app in `apps/web`.

Important UI pages:

- `pages/index.tsx` -> main companies page
- `pages/company/[ticker].tsx` -> company detail
- `pages/runs/index.tsx` -> list of scrape runs
- `pages/runs/[runId].tsx` -> scrape run detail

API client:

- `apps/web/lib/api.ts`

The frontend is intentionally thin. Filtering and list semantics are implemented on the backend.

### Backend

FastAPI app in `services/api`.

Important backend areas:

- `app/api/routes` -> endpoints
- `app/repositories` -> query/filter logic
- `app/services` -> orchestration
- `app/models` -> DB models
- `app/schemas` -> API schemas
- `app/sources` -> seed sources
- `app/agents` -> AI career discovery
- `app/scrapers` -> job count extraction

## Key Domain Rules

### Universe

`Company.universe` is a comma-separated string.

Examples:

- `sp500`
- `sp500,dow_jones`
- `sp500,nasdaq100,russell2000`

This is important: universe is not normalized, so filters and updates must treat it as token-based comma-separated data.

### Scrape status

Known scrape statuses:

- `success`
- `failed`
- `blocked`
- `not_found`
- `null` => never scraped

In the UI, null status is represented as `never`.

### City/state filtering

- state filter uses `hq_state`
- city filter uses `hq_city`
- city dropdown only appears after state selection
- city list is limited to cities in the selected state
- city list shows company counts
- city list is ordered by count descending

## Important Technical Constraints

### SQLite

The app uses SQLite, so write concurrency is limited.

Bulk scrape deliberately serializes writes with a DB lock to avoid `database is locked` issues.

### Route ordering

In FastAPI, routes like:

- `/companies/filters/states`
- `/companies/filters/cities`

must be declared before:

- `/companies/{ticker}`

### External sources

Index scrapers can break if upstream HTML or CSV formats change.

Russell 2000 currently uses a public CSV source instead of Wikipedia.

## API Areas

### Company listing

- `GET /companies`

Supports:

- `search`
- `sector`
- `universe`
- `last_scrape_status`
- `state`
- `city`
- `sort`
- `page`
- `page_size`

### Filter option endpoints

- `GET /sectors`
- `GET /universes`
- `GET /companies/filters/last-scrape-statuses`
- `GET /companies/filters/states`
- `GET /companies/filters/cities?state=CA`

### Seed endpoints

- `POST /admin/seed/sp500`
- `POST /admin/seed/dow_jones`
- `POST /admin/seed/nasdaq100`
- `POST /admin/seed/russell2000`

### Scrape endpoints

- `POST /scrape/company/{ticker}`
- `POST /scrape/all`
- `GET /scrape/runs`
- `GET /scrape/runs/{run_id}`
- `GET /scrape/runs/{run_id}/companies`

## Suggested Screenshot/Section Hints

If documenting or explaining the UI visually, capture:

1. Main companies table
   - show top action bar with seed buttons, refresh buttons, and runs link

2. Filter row
   - show sector, universe, last scrape status, state, and city filters
   - show city dropdown only after state selection

3. Company detail page
   - show career page URL, HQ data, job count, and scrape status

4. Bulk run pages
   - run list
   - run detail with progress and per-company outcomes

5. Universe examples
   - show companies belonging to multiple indexes
   - show comma-separated universe display

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

## Editing Guidance

When modifying this project:

- keep frontend and backend filters in sync
- preserve universe merge behavior
- avoid broad refactors unless necessary
- be careful with SQLite write paths
- update UI and API client together when response shapes change
