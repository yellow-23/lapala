"""
Scraper for chiletrabajos.cl — uses selectolax for speed.
Respects robots.txt: /encuentra-un-empleo is not disallowed.
Rate-limit: 1 req/s, User-Agent identifiable.
"""

import asyncio
import re
from datetime import datetime, timezone

import httpx
from selectolax.parser import HTMLParser

from ..models import NormalizedJob

BASE = "https://www.chiletrabajos.cl"
SEARCH = f"{BASE}/encuentra-un-empleo"
HEADERS = {
    "User-Agent": "LaPala/0.1 (https://github.com/tamecl/lapala)",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "es-CL,es;q=0.9",
}

CT_QUERIES = [
    {"13": "1022", "categoria": "2007", "f": "2"},
    {"13": "1022", "categoria": "2007", "f": "2", "q": "python"},
    {"13": "1022", "categoria": "2007", "f": "2", "q": "fullstack"},
    {"13": "1022", "categoria": "2007", "f": "2", "q": "react"},
    {"13": "1022", "categoria": "2007", "f": "2", "q": "práctica"},
]


class ChiletrabajosSource:
    name = "chiletrabajos"

    async def fetch(self, max_pages: int = 3) -> list[NormalizedJob]:
        seen: set[str] = set()
        jobs: list[NormalizedJob] = []

        async with httpx.AsyncClient(headers=HEADERS, timeout=20, follow_redirects=True) as client:
            for params in CT_QUERIES:
                for page in range(max_pages):
                    offset = page * 30
                    url = f"{SEARCH}/{offset}" if offset > 0 else SEARCH
                    items = await self._get_page(client, url, params)
                    if not items:
                        break

                    for item in items:
                        if item["url"] in seen:
                            continue
                        seen.add(item["url"])
                        detail = await self._get_detail(client, item["url"])
                        item.update(detail)
                        job = self._parse(item)
                        if job:
                            jobs.append(job)
                        await asyncio.sleep(0.8)

                    await asyncio.sleep(1.0)

        return jobs

    async def _get_page(self, client: httpx.AsyncClient, url: str, params: dict) -> list[dict]:
        try:
            r = await client.get(url, params=params)
            r.raise_for_status()
            tree = HTMLParser(r.text)
            items = []
            for a in tree.css("h2 a"):
                href = a.attributes.get("href", "")
                if "/trabajo/" not in href:
                    continue
                full_url = BASE + href if href.startswith("/") else href
                items.append({"titulo": a.text(strip=True), "url": full_url, "empresa": "", "fecha": ""})
            return items
        except Exception as e:
            print(f"[chiletrabajos] page error: {e}")
            return []

    async def _get_detail(self, client: httpx.AsyncClient, url: str) -> dict:
        try:
            r = await client.get(url)
            r.raise_for_status()
            tree = HTMLParser(r.text)

            desc = ""
            outer = tree.css_first("div.p-x-3")
            if outer:
                for child in outer.iter():
                    if child.tag == "div" and not child.attributes.get("class"):
                        text = child.text(separator=" ", strip=True)
                        if len(text) > 100:
                            desc = text[:2000]
                            break

            detalles: dict[str, str] = {}
            for tr in tree.css("table.table-sm tr"):
                tds = tr.css("td")
                if len(tds) >= 2:
                    detalles[tds[0].text(strip=True)] = tds[1].text(strip=True)

            renta_raw = detalles.get("Salario", "")
            renta = f"${int(renta_raw):,}".replace(",", ".") if renta_raw.isdigit() else renta_raw

            return {"descripcion": desc, "modalidad": detalles.get("Duración", ""), "renta": renta}
        except Exception as e:
            print(f"[chiletrabajos] detail error {url}: {e}")
            return {"descripcion": "", "modalidad": "", "renta": ""}

    def _slug_id(self, url: str) -> str:
        # Extract numeric ID from URL e.g. /trabajo/12345-...
        m = re.search(r"/trabajo/(\d+)", url)
        return m.group(1) if m else url.split("/")[-1][:50]

    def _parse(self, item: dict) -> NormalizedJob | None:
        try:
            tags: list[str] = []
            desc_lower = (item.get("descripcion") or "").lower()
            for kw in ["python", "react", "fastapi", "typescript", "javascript", "node", "fullstack", "sql", "postgresql"]:
                if kw in desc_lower:
                    tags.append(kw)
            return NormalizedJob(
                source=self.name,
                source_id=self._slug_id(item["url"]),
                title=item.get("titulo", ""),
                company=item.get("empresa", ""),
                location="Santiago, Chile",
                remote="remoto" in desc_lower or "remote" in desc_lower,
                url=item["url"],
                description=item.get("descripcion") or None,
                tags=tags,
                salary=item.get("renta") or None,
                posted_at=None,
                raw=item,
            )
        except Exception as e:
            print(f"[chiletrabajos] parse error: {e}")
            return None
