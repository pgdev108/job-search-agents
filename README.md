# Job Search Agent

A monorepo for a job search agent application with a Next.js frontend and FastAPI backend.

## Project Structure

```
job-search-agents/
├── apps/
│   └── web/              # Next.js frontend
│       ├── lib/          # API client utilities
│       └── pages/        # Next.js pages
├── services/
│   └── api/              # FastAPI backend
│       ├── app/
│       │   ├── db/       # Database setup and session
│       │   ├── models/   # SQLAlchemy models
│       │   ├── schemas/  # Pydantic schemas
│       │   ├── repositories/  # Data access layer
│       │   └── api/routes/    # API routes
│       └── data/         # SQLite database (created on first run)
└── README.md
```

## Prerequisites

- **macOS** (tested on macOS)
- **Python 3.13+**
- **Node.js 18+** and npm
- **uv** - Python package manager

## Installation

### 1. Install uv

If you don't have `uv` installed, install it using:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Or using Homebrew:

```bash
brew install uv
```

### 2. Setup Backend

Navigate to the backend directory:

```bash
cd services/api
```

Create a virtual environment and install dependencies:

```bash
uv venv
source .venv/bin/activate  # On macOS/Linux
uv pip install -e .
```

Or use uv's run command directly (which handles the venv automatically):

```bash
uv sync
```

Install Playwright browsers (required for job count extraction). From `services/api`, use the project’s Python via uv (or `python3` if you’re not using uv):

```bash
uv run python -m playwright install chromium
```

If `python` isn’t on your PATH, use:

```bash
python3 -m playwright install chromium
```

Copy the environment example file:

```bash
cp env.example .env
```

Run the backend server:

```bash
uv run uvicorn app.main:app --reload --port 8000
```

**Note:** On first run, the backend will:
- Create the `data/` directory if it doesn't exist
- Create the SQLite database at `services/api/data/app.db`
- Automatically seed the database with 20 sample companies (if the table is empty)

The API will be available at `http://localhost:8000`

### 3. Setup Frontend

Open a new terminal and navigate to the frontend directory:

```bash
cd apps/web
```

Install dependencies:

```bash
npm install
```

Copy the environment example file:

```bash
cp env.example .env.local
```

Edit `.env.local` and set:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Run the frontend development server:

```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Verification

1. Open `http://localhost:3000` in your browser
2. You should see the companies table with 20 seeded companies
3. The database is automatically created and seeded on first backend startup

## API Endpoints

### Health Check

- **GET** `/health`
- **Response**: `{ "status": "ok" }`

### Companies

- **GET** `/companies`
  - Query parameters:
    - `search` (optional): Search by company name or ticker (case-insensitive)
    - `sector` (optional): Filter by exact sector match
    - `sort` (optional): Sort order - `name_asc` (default), `job_count_desc`, `last_scraped_at_desc`
    - `page` (optional): Page number (default: 1)
    - `page_size` (optional): Items per page (default: 25, max: 100)
  - **Response**: 
    ```json
    {
      "items": [...],
      "page": 1,
      "page_size": 25,
      "total": 20,
      "total_pages": 1
    }
    ```

- **GET** `/sectors`
  - **Response**: `["Technology", "Financial Services", ...]`

## Development

### Backend

The backend uses:
- **FastAPI** for the web framework
- **SQLAlchemy 2.0** for database ORM
- **SQLite** for database (located at `services/api/data/app.db`)
- **Pydantic Settings** for configuration management
- **uv** for package management

The database is automatically initialized on first startup with sample companies.

### Frontend

The frontend uses:
- **Next.js 14** with TypeScript
- **React 18**
- Reads API base URL from `NEXT_PUBLIC_API_BASE_URL` environment variable
- Features:
  - Company listing table with search, filtering, and pagination
  - Sector filter dropdown
  - Sort options (name, job count, last scraped)
  - Debounced search (300ms delay)

## Environment Variables

### Backend (`services/api/.env`)

See `services/api/env.example` for available configuration options.

### Frontend (`apps/web/.env.local`)

- `NEXT_PUBLIC_API_BASE_URL` - Base URL for the API (default: `http://localhost:8000`)

## Troubleshooting

### Backend won't start

- Ensure Python 3.13+ is installed: `python3 --version`
- Ensure uv is installed: `uv --version`
- Check that dependencies are installed: `uv pip list`
- If database errors occur, delete `services/api/data/app.db` and restart (will recreate and reseed)

### Frontend can't reach backend

- Ensure the backend is running on port 8000
- Check that `NEXT_PUBLIC_API_BASE_URL` in `.env.local` matches the backend URL
- Check CORS settings in the backend if you see CORS errors

### Port already in use

- Backend: Change the port in the uvicorn command or in `services/api/.env`
- Frontend: Change the port by running `npm run dev -- -p 3001` or setting `PORT=3001`

