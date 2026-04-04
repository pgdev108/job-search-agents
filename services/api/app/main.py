from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import health, companies, admin, scrape, bulk_scrape
from app.api.routes import job_applications, bay_area_companies
from app.db.init_db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    # Startup: Initialize database
    await init_db()
    yield
    # Shutdown: (nothing needed for now)


app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description=settings.api_description,
    lifespan=lifespan,
)

# Configure CORS
cors_origins_list = settings.cors_origins
print(f"CORS allowed origins: {cors_origins_list}")  # Debug output
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["health"])
app.include_router(companies.router, tags=["companies"])
app.include_router(admin.router, tags=["admin"])
app.include_router(scrape.router)
app.include_router(bulk_scrape.router)
app.include_router(job_applications.router, tags=["applications"])
app.include_router(bay_area_companies.router)

