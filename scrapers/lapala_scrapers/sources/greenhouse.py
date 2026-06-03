"""
Scraper for Greenhouse-hosted job boards of companies operating in Chile.
Public JSON API — no auth, no scraping.

To find a company's Greenhouse slug:
  1. Go to their careers page and look for greenhouse.io in the URL
  2. The slug is the path segment: boards.greenhouse.io/v1/boards/{SLUG}/jobs
  3. Test with: curl https://boards.greenhouse.io/v1/boards/{SLUG}/jobs

Add verified slugs to CHILE_COMPANIES below.
"""

import asyncio

import httpx

from ..models import NormalizedJob

BASE = "https://boards.greenhouse.io/v1/boards"
HEADERS = {
    "User-Agent": "LaPala/0.1 (https://github.com/yellow-23/lapala)",
    "Accept": "application/json",
}

# Verified Greenhouse board slugs for companies with Chile presence.
# Add slugs here after verifying them with the API (see module docstring).
CHILE_COMPANIES: list[str] = []


class GreenhouseSource:
    name = "greenhouse"

    async def fetch(self) -> list[NormalizedJob]:
        jobs: list[NormalizedJob] = []
        seen: set[str] = set()

        async with httpx.AsyncClient(headers=HEADERS, timeout=20) as client:
            for slug in CHILE_COMPANIES:
                items = await self._get_board(client, slug)
                for item in items:
                    sid = str(item.get("id", ""))
                    if not sid or sid in seen:
                        continue
                    seen.add(sid)
                    job = self._parse(item, slug)
                    if job:
                        jobs.append(job)
                await asyncio.sleep(0.3)

        return jobs

    async def _get_board(self, client: httpx.AsyncClient, slug: str) -> list[dict]:
        try:
            r = await client.get(f"{BASE}/{slug}/jobs", params={"content": "true"})
            if r.status_code == 404:
                return []
            r.raise_for_status()
            data = r.json()
            return data.get("jobs", [])
        except Exception as e:
            print(f"[greenhouse] {slug} error: {e}")
            return []

    def _parse(self, item: dict, company_slug: str) -> NormalizedJob | None:
        try:
            title = item.get("title", "").strip()
            if not title:
                return None

            location = item.get("location", {}).get("name", "") or "Chile"

            departments = item.get("departments") or []
            tags = [d["name"] for d in departments if d.get("name")]

            description = item.get("content") or item.get("description")

            return NormalizedJob(
                source=self.name,
                source_id=str(item["id"]),
                title=title,
                company=company_slug,
                location=location,
                remote="remote" in location.lower() or "remoto" in location.lower(),
                url=item.get("absolute_url", f"https://boards.greenhouse.io/{company_slug}/jobs/{item['id']}"),
                description=str(description)[:2000] if description else None,
                tags=tags,
                salary=None,
                posted_at=None,
                raw={k: v for k, v in item.items() if k != "content"},
            )
        except Exception as e:
            print(f"[greenhouse] parse error: {e}")
            return None
