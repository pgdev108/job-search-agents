from datetime import datetime
from sqlalchemy import Column, Integer, String, Index, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Company(Base):
    """Company model for storing company information."""
    
    __tablename__ = "companies"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    ticker: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    sector: Mapped[str | None] = mapped_column(String, nullable=True)
    industry: Mapped[str | None] = mapped_column(String, nullable=True)
    hq_location: Mapped[str | None] = mapped_column(String, nullable=True)
    country: Mapped[str | None] = mapped_column(String, nullable=True, default="USA")
    career_page_url: Mapped[str | None] = mapped_column(String, nullable=True)
    job_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_scraped_at: Mapped[str | None] = mapped_column(String, nullable=True)  # ISO datetime string
    last_scrape_status: Mapped[str | None] = mapped_column(String, nullable=True)
    last_scrape_error: Mapped[str | None] = mapped_column(String, nullable=True)
    universe: Mapped[str] = mapped_column(String, nullable=False, default="sample")
    created_at: Mapped[str] = mapped_column(String, nullable=False)  # ISO datetime string
    updated_at: Mapped[str] = mapped_column(String, nullable=False)  # ISO datetime string
    
    # Indexes
    __table_args__ = (
        Index("idx_company_sector", "sector"),
        Index("idx_company_name", "name"),
        Index("idx_company_universe", "universe"),
    )

