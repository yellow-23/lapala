# LaPala — instrucciones para Claude

## Qué es este proyecto

Agregador de empleos chilenos + constructor de CV con IA. Open source, sin fines de lucro, todo gratis.
Tres partes: scraping de ofertas → Supabase, builder de CV con rendercv (YAML → PDF), matching CV ↔ oferta con Claude (BYOK).

## Estructura

```
src/
  web/          Astro + React + Tailwind (frontend)
  api/          FastAPI (renderizar CV, orquestar IA — on-demand)
  scrapers/     Python: GetOnBoardSource, ChiletrabajosSource
supabase/
  migrations/   SQL schema
.github/
  workflows/    ingest.yml: cron cada 6h → upsert jobs en Supabase
examples/       CVs YAML de ejemplo (formato rendercv)
tests/          pytest
justfile        task runner
```

## Comandos clave

```bash
just dev              # Astro en localhost:4321
just api              # FastAPI en localhost:8000
just ingest           # corre todos los scrapers y sube a Supabase
just ingest-source getonbrd   # solo una fuente
just test             # pytest
just test-scrapers    # smoke test rápido de scrapers
```

Sin `just` instalado:
```bash
cd src/web && pnpm dev
cd src/api && uvicorn main:app --reload
cd src/scrapers && python run_ingest.py all
```

## Stack

- **Frontend:** Astro 5, React (islas con `client:load`), Tailwind v4, `@supabase/supabase-js`
- **Backend:** FastAPI, rendercv, anthropic SDK, supabase-py
- **Scrapers:** httpx (async), selectolax, pydantic v2
- **DB:** Supabase free tier — tablas: `jobs`, `profiles`, `cvs`, `matches`
- **Infra:** GitHub Actions (ingesta), Cloudflare Pages o Netlify (web), Render free (api)

## Reglas de arquitectura

- **No LinkedIn.** Riesgo legal confirmado (Proxycurl cerrado jul-2026). Usar solo export oficial del usuario.
- **Scrapers aislados.** Cada fuente implementa `async def fetch() -> list[NormalizedJob]`. Un scraper roto no afecta el resto.
- **BYOK para IA.** El usuario provee su `ANTHROPIC_API_KEY`. El proyecto no paga tokens.
- **Supabase client lazy** en el frontend: usar `getSupabase()` de `src/web/src/lib/supabase.ts`, nunca instanciar directamente en el módulo (rompe el build estático de Astro).
- **RLS activo.** `jobs` es lectura pública. `cvs`, `profiles`, `matches` solo el dueño via `auth.uid()`.

## Variables de entorno

```
# src/web/.env (expuestas al browser, prefijo PUBLIC_)
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=

# src/api/.env y src/scrapers/.env (solo backend)
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
```

## Fases del roadmap

- **F0** ✅ Scaffolding monorepo
- **F1** Ingesta Get on Board + listado Astro (primer valor real)
- **F2** CV builder: form → YAML → `/cv/render` → PDF
- **F3** IA: generar CV, match CV ↔ oferta (BYOK)
- **F4** Scrapers adicionales: computrabajo, BNE
- **F5** Auth Supabase, perfiles, deploy
