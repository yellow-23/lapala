# 🪚 LaPala

> Encuentra tu pega en Chile — agregador de empleos tech, constructor de CV con IA y match inteligente.

Open source, gratis, sin fines de lucro.

## ¿Qué es?

**LaPala** (de "agarrar la pala" = agarrar pega) es una plataforma que:

1. **Agrega ofertas de empleo** desde Get on Board, ChileTrabajos y más (actualizado cada 6 horas vía GitHub Actions)
2. **Construye tu CV** con [rendercv](https://github.com/rendercv/rendercv) — formato YAML → PDF profesional
3. **Usa IA (Claude)** para generar/mejorar tu CV y hacer match CV ↔ oferta — con tu propia API key (BYOK)

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | [Astro](https://astro.build) + React islands + Tailwind |
| Backend (on-demand) | FastAPI + rendercv + Anthropic SDK |
| DB / Auth / Storage | [Supabase](https://supabase.com) (free tier) |
| Ingesta de empleos | GitHub Actions cron (cada 6h) |

## Estructura

```
lapala/
├── apps/
│   ├── web/                   # Astro frontend
│   │   └── src/features/
│   │       ├── jobs/          # listado, filtros, cards
│   │       ├── cv/            # builder, preview
│   │       └── ai/            # generador, match
│   └── api/                   # FastAPI backend
│       └── routers/
│           ├── cv.py          # POST /cv/render
│           └── ai.py          # POST /ai/generate-cv, /ai/match
├── packages/
│   └── scrapers/              # Python: GetOnBoardSource, ChiletrabajosSource
│       └── run_ingest.py      # script de ingesta (cron target)
├── supabase/
│   └── migrations/
│       └── 0001_init.sql      # schema inicial
└── .github/workflows/
    └── ingest.yml             # cron cada 6 horas
```

## Setup rápido

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com) (free)
2. Corre la migración: **SQL Editor** → pega el contenido de `supabase/migrations/0001_init.sql`
3. Copia las keys de **Settings > API**

### 2. Frontend

```bash
cp .env.example apps/web/.env
# Edita con tus keys de Supabase

pnpm install
pnpm dev
```

### 3. Ingesta local (prueba)

```bash
cd packages/scrapers
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp ../../.env.example .env  # edita con SUPABASE_URL y SUPABASE_SERVICE_KEY
python run_ingest.py getonbrd   # solo Get on Board
python run_ingest.py all        # todas las fuentes
```

### 4. GitHub Actions (ingesta automática)

En tu repo → **Settings > Secrets and variables > Actions**, agrega:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

El workflow `ingest.yml` corre cada 6 horas automáticamente.

### 5. Backend API (opcional, para CV builder e IA)

```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

uvicorn main:app --reload
```

## Fuentes de empleo

| Fuente | Método | Estado |
|---|---|---|
| [Get on Board](https://www.getonbrd.com) | API pública oficial | ✅ |
| [ChileTrabajos](https://www.chiletrabajos.cl) | Scraping (respeta robots.txt) | ✅ |
| Computrabajos | Scraping | Fase 4 |
| BNE (Gobierno) | Scraping | Futuro |

**LinkedIn no está incluido** — scrapear LinkedIn viola sus ToS y expone el proyecto a demandas legales. En cambio, puedes importar tu [export oficial de datos](https://www.linkedin.com/help/linkedin/answer/a1339364) para que la IA construya tu CV.

## Contribuir

PR bienvenidos. Cada nueva fuente de empleos va en `packages/scrapers/lapala_scrapers/sources/` implementando el protocolo `JobSource` (método `async def fetch() -> list[NormalizedJob]`).

## Licencia

[AGPL-3.0](LICENSE)
