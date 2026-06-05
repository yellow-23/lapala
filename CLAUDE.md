# LaPala — instrucciones para Claude

## Qué es este proyecto

Agregador de empleos chilenos + constructor de CV con IA. Open source, sin fines de lucro, todo gratis.
Tres partes: scraping de ofertas → Supabase, builder de CV con rendercv (YAML → PDF), matching CV ↔ oferta con Claude.

## Estructura

```
web/            Astro + React + Tailwind (frontend, standalone)
  src/features/
    jobs/       listado, filtros, cards
    cv/         builder, preview (Fase 2)
    ai/         generador, match (Fase 3)
api/            FastAPI — /cv/render, /ai/generate-cv, /ai/match
scrapers/       Python: ChiletrabajosSource, ComputrabajoSource
examples/       CVs YAML de ejemplo (formato rendercv)
.github/
  workflows/    ingest.yml: cron cada 6h → upsert jobs en Supabase
```

## Comandos clave

```bash
# Frontend (desde web/)
cd web && pnpm dev              # localhost:4321

# API (desde api/, con venv activo)
cd api && source .venv/bin/activate && uvicorn main:app --reload

# Scrapers
cd scrapers && python run_ingest.py all
cd scrapers && python run_ingest.py chiletrabajos
```

## Stack

- **Frontend:** Astro 5, React (islas `client:load`), Tailwind v4, `@supabase/supabase-js`
- **Backend:** FastAPI, rendercv, anthropic SDK, supabase-py
- **Scrapers:** httpx (async), selectolax, pydantic v2
- **DB:** Supabase free tier — tablas: `jobs`, `profiles`, `cvs`, `matches`
- **Infra:** GitHub Actions (ingesta), Cloudflare Pages (web — lapala.pages.dev), Render free (api — lapala.onrender.com)

## Reglas de arquitectura

- **No LinkedIn.** Riesgo legal confirmado (Proxycurl cerrado jul-2026). Solo export oficial del usuario.
- **Scrapers aislados.** Cada fuente implementa `async def fetch() -> list[NormalizedJob]`. Un scraper roto no rompe los demás.
- **IA:** Key del proyecto durante fase de prueba (para que la gente la conozca sin fricción). Plan definitivo: BYOK — el usuario provee su `ANTHROPIC_API_KEY`.
- **Supabase client lazy** en el frontend: usar `getSupabase()` de `web/src/lib/supabase.ts`, nunca instanciar en el módulo (rompe build estático de Astro).
- **RLS activo.** `jobs` lectura pública. `cvs`, `profiles`, `matches` solo el dueño via `auth.uid()`.

## Variables de entorno

```
# web/.env (expuestas al browser, prefijo PUBLIC_)
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=

# api/.env y scrapers/.env (solo backend)
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
```

## Fases del roadmap

- **F0** ✅ Scaffolding
- **F1** ✅ Ingesta + listado (Chiletrabajos + Computrabajo, ~6k pegas)
- **F2** ✅ CV builder: form → YAML → `/cv/render` → PDF
- **F5** ✅ Deploy: Cloudflare Pages + Render
- **F4** Scrapers adicionales: BNE (API pública), Greenhouse, Trabajando.com
- **F3** IA: generar CV, match CV ↔ oferta (key del proyecto en pruebas → BYOK en producción)
