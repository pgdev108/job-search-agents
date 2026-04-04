"""Bay Area private companies sourced from CSV."""
from sqlalchemy import Column, Integer, String, Float, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BayAreaCompany(Base):
    """Bay Area company model — sourced from Bay-Area-Companies-List.csv."""

    __tablename__ = "bay_area_companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    tags: Mapped[str | None] = mapped_column(String, nullable=True)           # comma-separated e.g. "B2B Software and Services,AI"
    location: Mapped[str | None] = mapped_column(String, nullable=True)       # coarse area: "San Francisco", "East Bay", etc.
    investors: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    website: Mapped[str | None] = mapped_column(String, nullable=True)
    domain: Mapped[str | None] = mapped_column(String, nullable=True, unique=True, index=True)
    founded_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    address: Mapped[str | None] = mapped_column(String, nullable=True)
    hq_city: Mapped[str | None] = mapped_column(String, nullable=True)
    hq_state: Mapped[str | None] = mapped_column(String, nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    long: Mapped[float | None] = mapped_column(Float, nullable=True)
    company_size: Mapped[str | None] = mapped_column(String, nullable=True)   # e.g. "61-150"
    tech_stack: Mapped[str | None] = mapped_column(String, nullable=True)
    marketing_stack: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)

    __table_args__ = (
        Index("idx_bay_area_company_location", "location"),
        Index("idx_bay_area_company_tags", "tags"),
    )
