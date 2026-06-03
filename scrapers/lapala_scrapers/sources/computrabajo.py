"""
Scraper for cl.computrabajo.com — general job board, all categories.
Allowed: base search pages without filter combos (per robots.txt).
Rate-limit: 1 req/s, identifiable User-Agent.
"""

import asyncio
import re

import httpx
from selectolax.parser import HTMLParser

from ..models import NormalizedJob

BASE = "https://cl.computrabajo.com"
HEADERS = {
    "User-Agent": "LaPala/0.1 (https://github.com/yellow-23/lapala)",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "es-CL,es;q=0.9",
}

# Broad queries covering all job types in Chile
CT_QUERIES = [
    "",
    "vendedor",
    "administrativo",
    "construccion",
    "conductor",
    "gastronomia",
    "enfermero",
    "cajero",
    "recepcionista",
    "bodeguero",
    "limpieza",
    "seguridad",
    "desarrollador",
    "contador",
]


class ComputrabajoSource:
    name = "computrabajo"

    async def fetch(self, max_pages: int = 2) -> list[NormalizedJob]:
        seen: set[str] = set()
        jobs: list[NormalizedJob] = []

        async with httpx.AsyncClient(headers=HEADERS, timeout=25, follow_redirects=True) as client:
            for query in CT_QUERIES:
                for page in range(1, max_pages + 1):
                    items = await self._get_page(client, query, page)
                    if not items:
                        break
                    new = 0
                    for item in items:
                        if item["url"] in seen:
                            continue
                        seen.add(item["url"])
                        job = self._parse(item)
                        if job:
                            jobs.append(job)
                            new += 1
                    if new == 0:
                        break
                    await asyncio.sleep(1.0)

        return jobs

    async def _get_page(self, client: httpx.AsyncClient, query: str, page: int) -> list[dict]:
        try:
            params: dict = {}
            if query:
                params["q"] = query
            if page > 1:
                params["p"] = page

            r = await client.get(f"{BASE}/ofertas-de-trabajo/", params=params)
            r.raise_for_status()
            return self._parse_listing(r.text)
        except Exception as e:
            print(f"[computrabajo] page error q={query!r} p={page}: {e}")
            return []

    def _parse_listing(self, html: str) -> list[dict]:
        tree = HTMLParser(html)
        items = []

        # Computrabajo uses article[data-href] or div with data-href
        for node in tree.css("article[data-href], div[data-href]"):
            href = node.attributes.get("data-href", "")
            if not href:
                continue
            url = BASE + href if href.startswith("/") else href

            title_node = node.css_first("h2 a") or node.css_first("h2")
            title = title_node.text(strip=True) if title_node else ""
            if not title:
                continue

            company_node = node.css_first("p.dFlex a") or node.css_first("p.dFlex")
            company = company_node.text(strip=True) if company_node else ""

            loc_node = node.css_first("p.fs13") or node.css_first("span.location")
            location = loc_node.text(strip=True) if loc_node else ""

            items.append({
                "url": url,
                "titulo": title,
                "empresa": company,
                "ubicacion": location,
            })

        # Fallback: any h2 a inside main content
        if not items:
            for a in tree.css("main h2 a, #main_content h2 a, .offerList h2 a"):
                href = a.attributes.get("href", "")
                if not href or "/oferta" not in href:
                    continue
                url = BASE + href if href.startswith("/") else href
                items.append({
                    "url": url,
                    "titulo": a.text(strip=True),
                    "empresa": "",
                    "ubicacion": "",
                })

        return items

    def _slug_id(self, url: str) -> str:
        m = re.search(r"/([^/]+)$", url)
        return m.group(1)[:80] if m else url[-50:]

    def _parse(self, item: dict) -> NormalizedJob | None:
        try:
            desc_lower = (item.get("descripcion") or "").lower()
            return NormalizedJob(
                source=self.name,
                source_id=self._slug_id(item["url"]),
                title=item.get("titulo", ""),
                company=item.get("empresa", ""),
                location=item.get("ubicacion") or "Chile",
                remote="remoto" in desc_lower,
                url=item["url"],
                description=None,
                tags=[],
                salary=None,
                posted_at=None,
                raw=item,
            )
        except Exception as e:
            print(f"[computrabajo] parse error: {e}")
            return None
