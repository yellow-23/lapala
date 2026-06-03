"""
Scraper for BNE (Bolsa Nacional de Empleo) — Chilean government job board.
Uses the internal JSON API at /data/ofertas/buscarListas — public, no auth.
~6,000 active listings across all regions and sectors.
"""

import asyncio
import html

import httpx

from ..models import NormalizedJob

BASE = "https://www.bne.cl"
ENDPOINT = f"{BASE}/data/ofertas/buscarListas"
HEADERS = {
    "User-Agent": "LaPala/0.1 (https://github.com/yellow-23/lapala)",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": f"{BASE}/ofertas",
}
PAGE_SIZE = 50


class BNESource:
    name = "bne"

    async def fetch(self) -> list[NormalizedJob]:
        jobs: list[NormalizedJob] = []
        seen: set[str] = set()

        async with httpx.AsyncClient(headers=HEADERS, timeout=20, follow_redirects=True) as client:
            page = 1
            while True:
                params = {
                    "mostrar": "empleo",
                    "numPaginaRecuperar": page,
                    "numResultadosPorPagina": PAGE_SIZE,
                    "clasificarYPaginar": "true",
                }
                try:
                    r = await client.get(ENDPOINT, params=params)
                    r.raise_for_status()
                    data = r.json()
                except Exception as e:
                    print(f"[bne] page {page} error: {e}")
                    break

                pagina = data.get("paginaOfertas", {})
                resultados = pagina.get("resultados") or []
                if not resultados:
                    break

                for item in resultados:
                    sid = str(item.get("codigo") or item.get("id", ""))
                    if not sid or sid in seen:
                        continue
                    seen.add(sid)
                    job = self._parse(item, sid)
                    if job:
                        jobs.append(job)

                total_pages = pagina.get("numPaginasTotal", page)
                if page >= total_pages:
                    break
                page += 1
                await asyncio.sleep(0.5)

        return jobs

    def _parse(self, item: dict, sid: str) -> NormalizedJob | None:
        try:
            title = html.unescape(item.get("titulo", "")).strip()
            if not title:
                return None

            company = ""
            if item.get("mostrarEmpresa"):
                company = html.unescape(item.get("empresa", "")).strip()

            region = item.get("region", "")
            comuna = item.get("comuna", "")
            location = ", ".join(filter(None, [comuna, region])) or "Chile"

            raw_desc = item.get("descripcion", "")
            description = html.unescape(raw_desc).strip() if raw_desc else None

            return NormalizedJob(
                source=self.name,
                source_id=sid[:100],
                title=title,
                company=company,
                location=location,
                remote=False,
                url=f"{BASE}/oferta/{sid}",
                description=description,
                tags=[],
                salary=None,
                posted_at=None,
                raw=item,
            )
        except Exception as e:
            print(f"[bne] parse error: {e}")
            return None
