"""
Scraper for chiletrabajos.cl — all job categories via /trabajos/{slug}.
33,000+ offers across 21 categories.
Rate-limit: 1 req/s, identifiable User-Agent.
"""

import asyncio
import re

import httpx
from selectolax.parser import HTMLParser

from ..models import NormalizedJob

BASE = "https://www.chiletrabajos.cl"
HEADERS = {
    "User-Agent": "LaPala/0.1 (https://github.com/yellow-23/lapala)",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "es-CL,es;q=0.9",
}

CATEGORY_SLUGS = [
    "ventas",
    "operarios",
    "logistica",
    "medicina",
    "ingenieria",
    "hoteleria",
    "administracion",
    "informatica",
    "economia",
    "seguridad",
    "educacion",
    "rrhh",
    "marketing",
    "secretariasrecepcionistas",
    "practicas",
    "arte",
    "asistenteadministrativo",
    "esteticacuidadopersonal",
    "serviciosdomesticos",
    "universitarios",
    "Otros",
]


class ChiletrabajosSource:
    name = "chiletrabajos"

    async def fetch(self, max_pages: int = 10) -> list[NormalizedJob]:
        seen: set[str] = set()
        jobs: list[NormalizedJob] = []

        async with httpx.AsyncClient(headers=HEADERS, timeout=20, follow_redirects=True) as client:
            for slug in CATEGORY_SLUGS:
                for page in range(max_pages):
                    offset = page * 30
                    url = f"{BASE}/trabajos/{slug}/{offset}" if offset > 0 else f"{BASE}/trabajos/{slug}"
                    items = await self._get_page(client, url, slug)
                    if not items:
                        break

                    for item in items:
                        if item["url"] in seen:
                            continue
                        seen.add(item["url"])
                        job = self._parse(item)
                        if job:
                            jobs.append(job)

                    await asyncio.sleep(1.0)

        return jobs

    async def _get_page(self, client: httpx.AsyncClient, url: str, slug: str) -> list[dict]:
        try:
            r = await client.get(url)
            r.raise_for_status()
            return self._parse_listing(r.text, slug)
        except Exception as e:
            print(f"[chiletrabajos] page error {url}: {e}")
            return []

    def _parse_listing(self, html: str, category: str) -> list[dict]:
        tree = HTMLParser(html)
        items = []

        for a in tree.css("a[href*='/trabajo/']"):
            href = a.attributes.get("href", "")
            if not href or "/trabajo/" not in href:
                continue
            full_url = BASE + href if href.startswith("/") else href

            title = " ".join(a.text(strip=True).split())  # collapse whitespace
            if not title or len(title) < 5:
                continue
            lower = title.lower()
            # skip dates ("02 de junio de 2026") and UI labels
            if any(w in lower for w in ["ver más", "ver mas", " de enero", " de febrero",
                                         " de marzo", " de abril", " de mayo", " de junio",
                                         " de julio", " de agosto", " de septiembre",
                                         " de octubre", " de noviembre", " de diciembre"]):
                continue

            # Go up 2 levels: a → h2/span → div.col-sm-12
            container = a.parent
            if container:
                container = container.parent

            company = ""
            location = ""

            if container:
                # h3 format: "Empresa,Ciudad"
                h3 = container.css_first("h3")
                if h3:
                    raw = h3.text(strip=True)
                    if "," in raw:
                        parts = raw.split(",", 1)
                        company = parts[0].strip()
                        location = parts[1].strip()
                    else:
                        company = raw

                # city link fallback
                if not location:
                    city_a = container.css_first("a[href*='/ciudad/']")
                    if city_a:
                        location = city_a.text(strip=True)

            items.append({
                "url": full_url,
                "titulo": title,
                "empresa": company,
                "ubicacion": location,
                "categoria": category,
            })

        return items

    def _slug_id(self, url: str) -> str:
        m = re.search(r"/trabajo/([^/?]+)", url)
        return m.group(1)[:100] if m else url.split("/")[-1][:50]

    def _parse(self, item: dict) -> NormalizedJob | None:
        try:
            title = item.get("titulo", "").strip()
            if not title:
                return None

            return NormalizedJob(
                source=self.name,
                source_id=self._slug_id(item["url"]),
                title=title,
                company=item.get("empresa", ""),
                location=item.get("ubicacion") or "Chile",
                remote=False,
                url=item["url"],
                description=None,
                tags=[item.get("categoria", "")],
                salary=None,
                posted_at=None,
                raw=item,
            )
        except Exception as e:
            print(f"[chiletrabajos] parse error: {e}")
            return None
