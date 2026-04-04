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
    hq_location: Mapped[str | None] = mapped_column(String, nullable=True)  # combined display e.g. "Northbrook, IL"
    hq_city: Mapped[str | None] = mapped_column(String, nullable=True)
    hq_state: Mapped[str | None] = mapped_column(String, nullable=True)  # state/province code or name
    country: Mapped[str | None] = mapped_column(String, nullable=True, default="USA")
    career_page_url: Mapped[str | None] = mapped_column(String, nullable=True)
    career_page_source: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g. openai_agent
    job_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    job_count_extraction_method: Mapped[str | None] = mapped_column(String, nullable=True)
    last_scraped_at: Mapped[str | None] = mapped_column(String, nullable=True)  # ISO datetime string
    last_scrape_status: Mapped[str | None] = mapped_column(String, nullable=True)
    last_scrape_error: Mapped[str | None] = mapped_column(String, nullable=True)
    last_run_id: Mapped[int | None] = mapped_column(Integer, nullable=True)  # most recent bulk run that touched this company
    not_interested: Mapped[bool] = mapped_column(Integer, nullable=False, default=False)  # if True, excluded from all scrape runs
    universe: Mapped[str] = mapped_column(String, nullable=False, default="sample")
    created_at: Mapped[str] = mapped_column(String, nullable=False)  # ISO datetime string
    updated_at: Mapped[str] = mapped_column(String, nullable=False)  # ISO datetime string
    
    # Indexes
    __table_args__ = (
        Index("idx_company_sector", "sector"),
        Index("idx_company_name", "name"),
        Index("idx_company_universe", "universe"),
    )

