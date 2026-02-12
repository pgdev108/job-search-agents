from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator, computed_field, Field
from typing import Any


class Settings(BaseSettings):
    """Application settings using Pydantic Settings."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        env_ignore_empty=True,
        populate_by_name=True,  # Allow both field name and alias
    )
    
    # API settings
    api_title: str = "Job Search Agent API"
    api_version: str = "0.1.0"
    api_description: str = "API for Job Search Agent"
    
    # CORS settings - use string to avoid JSON parsing issues, convert to list via property
    cors_origins_str: str = Field(default="http://localhost:3000,http://localhost:3001", alias="CORS_ORIGINS")
    
    def _get_cors_origins(self) -> list[str]:
        """Get CORS origins as a list from comma-separated string."""
        if not self.cors_origins_str or not self.cors_origins_str.strip():
            return ["http://localhost:3000", "http://localhost:3001"]
        origins = [origin.strip() for origin in self.cors_origins_str.split(",") if origin.strip()]
        return origins if origins else ["http://localhost:3000", "http://localhost:3001"]
    
    @property
    def cors_origins(self) -> list[str]:
        """Get CORS origins as a list."""
        return self._get_cors_origins()
    
    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    
    # OpenAI (required for scrape/career discovery)
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4o", alias="OPENAI_MODEL")
    
    # Playwright
    playwright_headless: bool = Field(default=True, alias="PLAYWRIGHT_HEADLESS")
    playwright_nav_timeout_ms: int = Field(default=30000, alias="PLAYWRIGHT_NAV_TIMEOUT_MS")
    
    # Scrape behavior
    scrape_max_retries: int = Field(default=2, alias="SCRAPE_MAX_RETRIES")
    scrape_domain_delay_ms: int = Field(default=500, alias="SCRAPE_DOMAIN_DELAY_MS")
    
    # Bulk scrape
    bulk_scrape_concurrency: int = Field(default=4, alias="BULK_SCRAPE_CONCURRENCY")
    bulk_scrape_max_companies: int = Field(default=6000, alias="BULK_SCRAPE_MAX_COMPANIES")
    bulk_scrape_universe_default: str = Field(default="sp500", alias="BULK_SCRAPE_UNIVERSE_DEFAULT")
    bulk_scrape_request_timeout_sec: int = Field(default=3600, alias="BULK_SCRAPE_REQUEST_TIMEOUT_SEC")
    
    def require_openai_key(self) -> None:
        """Raise if OPENAI_API_KEY is not set (for scrape endpoints)."""
        if not self.openai_api_key or not self.openai_api_key.strip():
            raise ValueError("OPENAI_API_KEY not configured")


settings = Settings()
