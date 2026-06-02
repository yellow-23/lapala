import asyncio
from datetime import datetime, timezone

import httpx

from ..models import NormalizedJob

API_BASE = "https://www.getonbrd.com/api/v0"
HEADERS = {"User-Agent": "LaPala/0.1 (https://github.com/tamecl/lapala)", "Accept": "application/json"}


class GetOnBoardSource:
    name = "getonbrd"

    async def fetch(self, max_pages: int = 10) -> list[NormalizedJob]:
        jobs: list[NormalizedJob] = []
        async with httpx.AsyncClient(headers=HEADERS, timeout=20) as client:
            for page in range(1, max_pages + 1):
                data = await self._get_page(client, page)
                if not data:
                    break
                for item in data:
                    job = self._parse(item)
                    if job:
                        jobs.append(job)
                await asyncio.sleep(0.5)
        return jobs

    async def _get_page(self, client: httpx.AsyncClient, page: int) -> list[dict]:
        try:
            r = await client.get(
                f"{API_BASE}/jobs",
                params={"page": page, "per_page": 50, "country_id": "cl"},
            )
            r.raise_for_status()
            return r.json().get("data", [])
        except Exception as e:
            print(f"[getonbrd] page {page} error: {e}")
            return []

    def _parse(self, item: dict) -> NormalizedJob | None:
        try:
            attrs = item.get("attributes", {})
            rel = item.get("relationships", {})
            company_name = (
                rel.get("company", {}).get("data", {}).get("id", "")
                or attrs.get("company_name", "")
            )
            tags = [t.get("name", "") for t in attrs.get("tags", []) if t.get("name")]
            posted_raw = attrs.get("published_at") or attrs.get("created_at")
            posted_at = datetime.fromisoformat(posted_raw.replace("Z", "+00:00")) if posted_raw else None
            return NormalizedJob(
                source=self.name,
                source_id=str(item["id"]),
                title=attrs.get("title", ""),
                company=company_name,
                location=attrs.get("country", {}).get("data", {}).get("id", "CL"),
                remote=attrs.get("remote", False),
                url=attrs.get("url", f"https://www.getonbrd.com/jobs/{item['id']}"),
                description=(attrs.get("description") or "")[:2000],
                tags=tags,
                salary=attrs.get("salary_string") or None,
                posted_at=posted_at,
                raw=attrs,
            )
        except Exception as e:
            print(f"[getonbrd] parse error: {e}")
            return None
