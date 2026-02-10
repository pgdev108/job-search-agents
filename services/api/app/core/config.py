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
    # Map CORS_ORIGINS env var to this field
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


settings = Settings()
