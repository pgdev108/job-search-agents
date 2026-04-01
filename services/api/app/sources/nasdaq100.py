"""Nasdaq-100 components data source."""
import re
import html

import requests

from app.sources.base import CompanySeedRecord, CompanySource

WIKI_URL = "https://en.wikipedia.org/wiki/Nasdaq-100"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
UNIVERSE = "nasdaq100"


def _normalize_ticker(ticker: str) -> str:
    return (ticker or "").strip().upper()


def _clean_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\[\d+\]", "", text)
    text = html.unescape(text)
    return " ".join(text.split()).strip()


class Nasdaq100Source:
    """Source for Nasdaq-100 components (~100 companies)."""

    def fetch(self) -> list[CompanySeedRecord]:
        """Fetch Nasdaq-100 from Wikipedia."""
        try:
            return self._fetch_from_wikipedia()
        except Exception as e:
            raise Exception(f"Failed to fetch Nasdaq-100 data: {e}") from e

    def _fetch_from_wikipedia(self) -> list[CompanySeedRecord]:
        headers = {"User-Agent": USER_AGENT}
        response = requests.get(WIKI_URL, timeout=25, headers=headers)
        response.raise_for_status()
        html_content = response.text

        # Find components table: prefer id="constituents", else wikitable with Ticker and Company
        table_match = re.search(
            r'<table[^>]*id="constituents"[^>]*>(.*?)</table>',
            html_content,
            re.DOTALL,
        )
        if not table_match:
            for m in re.finditer(
                r'<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>(.*?)</table>',
                html_content,
                re.DOTALL,
            ):
                block = m.group(1)
                if "Ticker" in block and "Company" in block:
                    table_match = m
                    break
        if not table_match:
            raise Exception("Could not find Nasdaq-100 components table")

        table_html = table_match.group(0)
        row_pattern = r"<tr[^>]*>(.*?)</tr>"
        rows = re.findall(row_pattern, table_html, re.DOTALL)
        cell_pattern = r"<t[dh][^>]*>(.*?)</t[dh]>"
        companies = []

        for row in rows[1:]:
            cells = re.findall(cell_pattern, row, re.DOTALL)
            if len(cells) < 2:
                continue
            ticker_raw = cells[0]
            company_raw = cells[1]
            ticker_match = re.search(r"<a[^>]*>([A-Z0-9\.]{1,6})</a>", ticker_raw)
            ticker = ticker_match.group(1) if ticker_match else _clean_html(ticker_raw)
            ticker = _normalize_ticker(ticker)
            name_match = re.search(r"<a[^>]*>([^<]+)</a>", company_raw)
            name = _clean_html(name_match.group(1)) if name_match else _clean_html(company_raw)
            if not ticker or not name:
                continue
            if ticker.upper() in ("TICKER", "SYMBOL") or name.upper() in ("COMPANY", "COMPANIES"):
                continue
            sector = None
            if len(cells) > 2:
                sector = _clean_html(cells[2])
                if sector and sector.lower() in ("n/a", ""):
                    sector = None
            companies.append(
                CompanySeedRecord(
                    name=name,
                    ticker=ticker,
                    sector=sector,
                    industry=None,
                    country="USA",
                    hq_location=None,
                    universe=UNIVERSE,
                )
            )

        if len(companies) < 80:
            raise Exception(f"Expected ~100 Nasdaq-100 components, got {len(companies)}")
        return companies[:120]
