"""Playwright-based job count extraction from career pages (best-effort)."""
import asyncio
import re
from urllib.parse import urlparse

from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout

from app.schemas.scrape import JobCountResult


USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Provider URL patterns
GREENHOUSE_PATTERNS = ("greenhouse.io", "boards.greenhouse.io")
LEVER_PATTERNS = ("jobs.lever.co", "lever.co")
WORKDAY_PATTERNS = ("myworkdayjobs.com", "workday.com")
ICIMS_PATTERNS = ("icims.com",)

# Selectors by provider (best-effort)
GREENHOUSE_SELECTORS = [
    ".opening a",
    "a[href*='/jobs/']",
    ".job-post",
    "[data-department]",
]
LEVER_SELECTORS = [
    ".posting",
    ".posting-title",
    "a[href*='lever.co']",
    ".posting-list .posting",
]
WORKDAY_SELECTORS = [
    "[data-automation-id='compositeHeader'] li",
    "li[data-automation-id='jobPosting']",
    "a[href*='job']",
]
GENERIC_SELECTORS = [
    "a[href*='job']",
    "a[href*='career']",
    ".job-listing",
    ".job-item",
    "[data-job-id]",
    "article[class*='job']",
    ".position",
    ".opening",
]

# Text patterns for "X jobs" etc.
COUNT_PATTERNS = [
    re.compile(r"(\d+)\s*(?:open\s+)?(?:positions?|jobs?|roles?)", re.I),
    re.compile(r"(?:positions?|jobs?|roles?):\s*(\d+)", re.I),
    re.compile(r"showing\s+(\d+)", re.I),
    re.compile(r"(\d+)\s*results?", re.I),
]


def _provider_from_url(url: str) -> str:
    """Detect provider from URL for selector choice."""
    lower = url.lower()
    if any(p in lower for p in GREENHOUSE_PATTERNS):
        return "greenhouse"
    if any(p in lower for p in LEVER_PATTERNS):
        return "lever"
    if any(p in lower for p in WORKDAY_PATTERNS):
        return "workday"
    if any(p in lower for p in ICIMS_PATTERNS):
        return "icims"
    return "generic"


async def extract_job_count(
    career_page_url: str,
    company_name: str = "",
    ticker: str = "",
    *,
    headless: bool = True,
    nav_timeout_ms: int = 30000,
    domain_delay_ms: int = 500,
) -> JobCountResult:
    """
    Open career_page_url with Playwright, detect provider, and estimate job count.
    Returns JobCountResult with status success | failed | blocked | not_found.
    """
    url = career_page_url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    provider = _provider_from_url(url)
    if domain_delay_ms > 0:
        await asyncio.sleep(domain_delay_ms / 1000.0)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        try:
            context = await browser.new_context(user_agent=USER_AGENT)
            page = await context.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=nav_timeout_ms)
            await asyncio.sleep(1.5)

            body_text = await page.inner_text("body")
            if body_text:
                body_lower = body_text.lower()
                if any(x in body_lower for x in ("captcha", "unusual traffic", "access denied", "blocked", "robot")):
                    return JobCountResult(
                        job_count=None,
                        method="blocked",
                        evidence=body_text[:200],
                        status="blocked",
                        error="Page appears to block automated access",
                    )

            count: int | None = None
            method_used = "generic_dom"
            evidence_used = ""

            if provider == "greenhouse":
                for sel in GREENHOUSE_SELECTORS:
                    try:
                        els = await page.locator(sel).all()
                        if els and len(els) > 0:
                            count = len(els)
                            method_used = "greenhouse_dom"
                            evidence_used = sel
                            break
                    except Exception:
                        continue
            elif provider == "lever":
                for sel in LEVER_SELECTORS:
                    try:
                        els = await page.locator(sel).all()
                        if els and len(els) > 0:
                            count = len(els)
                            method_used = "lever_dom"
                            evidence_used = sel
                            break
                    except Exception:
                        continue
            elif provider == "workday" or provider == "icims":
                for sel in WORKDAY_SELECTORS + GENERIC_SELECTORS:
                    try:
                        els = await page.locator(sel).all()
                        if els and len(els) > 0:
                            count = len(els)
                            method_used = "workday_heuristic"
                            evidence_used = sel
                            break
                    except Exception:
                        continue

            if count is None:
                for sel in GENERIC_SELECTORS:
                    try:
                        els = await page.locator(sel).all()
                        if els and len(els) > 0 and (count is None or len(els) > count):
                            count = min(len(els), 500)
                            method_used = "generic_dom"
                            evidence_used = sel
                    except Exception:
                        continue

            if count is None and body_text:
                for pat in COUNT_PATTERNS:
                    m = pat.search(body_text)
                    if m:
                        count = min(int(m.group(1)), 2000)
                        method_used = "regex_text"
                        evidence_used = m.group(0)[:100]
                        break

            if count is not None:
                return JobCountResult(
                    job_count=count,
                    method=method_used,
                    evidence=evidence_used[:200],
                    status="success",
                    error="",
                )
            return JobCountResult(
                job_count=None,
                method=method_used,
                evidence=body_text[:200] if body_text else "",
                status="not_found",
                error="No job listings detected",
            )

        except PlaywrightTimeout as e:
            return JobCountResult(
                job_count=None,
                method="timeout",
                evidence="",
                status="failed",
                error=str(e)[:500],
            )
        except Exception as e:
            return JobCountResult(
                job_count=None,
                method="error",
                evidence="",
                status="failed",
                error=str(e)[:500],
            )
        finally:
            await browser.close()
