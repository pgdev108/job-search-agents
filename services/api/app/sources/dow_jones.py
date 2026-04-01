"""Dow Jones Industrial Average (30 components) data source."""
import re
import html

import requests

from app.sources.base import CompanySeedRecord, CompanySource

WIKI_URL = "https://en.wikipedia.org/wiki/Dow_Jones_Industrial_Average"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
UNIVERSE = "dow_jones"


def _normalize_ticker(ticker: str) -> str:
    return (ticker or "").strip().upper()


def _clean_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\[\d+\]", "", text)
    text = html.unescape(text)
    return " ".join(text.split()).strip()


class DowJonesSource:
    """Source for Dow Jones Industrial Average components (30 companies)."""

    def fetch(self) -> list[CompanySeedRecord]:
        """Fetch Dow 30 from Wikipedia."""
        try:
            return self._fetch_from_wikipedia()
        except Exception as e:
            raise Exception(f"Failed to fetch Dow Jones data: {e}") from e

    def _fetch_from_wikipedia(self) -> list[CompanySeedRecord]:
        headers = {"User-Agent": USER_AGENT}
        response = requests.get(WIKI_URL, timeout=20, headers=headers)
        response.raise_for_status()
        html_content = response.text

        # Find the components table (class contains "wikitable", e.g. "wikitable sortable")
        for m in re.finditer(r'<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>(.*?)</table>', html_content, re.DOTALL):
            block = m.group(1)
            if "Symbol" in block and "Company" in block and "Industry" in block:
                table_html = m.group(0)
                break
        else:
            raise Exception("Could not find Dow Jones components table")
        row_pattern = r"<tr[^>]*>(.*?)</tr>"
        rows = re.findall(row_pattern, table_html, re.DOTALL)
        cell_pattern = r"<t[dh][^>]*>(.*?)</t[dh]>"
        companies = []

        for row in rows[1:]:
            cells = re.findall(cell_pattern, row, re.DOTALL)
            if len(cells) < 3:
                continue
            # First cell: company name (often a link). Third cell: symbol (link to exchange)
            company_raw = cells[0]
            symbol_raw = cells[2] if len(cells) > 2 else ""
            # Extract link text for company: <a href="...">Company Name</a>
            name_match = re.search(r"<a[^>]*>([^<]+)</a>", company_raw)
            name = _clean_html(name_match.group(1)) if name_match else _clean_html(company_raw)
            symbol_match = re.search(r"<a[^>]*>([A-Z]{1,5})</a>", symbol_raw)
            symbol = symbol_match.group(1) if symbol_match else _clean_html(symbol_raw)
            symbol = _normalize_ticker(symbol)
            if not symbol or not name:
                continue
            if symbol.upper() in ("SYMBOL", "TICKER", "EXCHANGE") or name.upper() in ("COMPANY", "COMPANIES"):
                continue
            sector = None
            if len(cells) > 3:
                sector = _clean_html(cells[3])
                if sector and sector.lower() in ("n/a", ""):
                    sector = None
            companies.append(
                CompanySeedRecord(
                    name=name,
                    ticker=symbol,
                    sector=sector,
                    industry=None,
                    country="USA",
                    hq_location=None,
                    universe=UNIVERSE,
                )
            )

        if len(companies) < 25:
            raise Exception(f"Expected ~30 Dow components, got {len(companies)}")
        return companies[:35]
