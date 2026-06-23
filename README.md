# LaPala

> Encuentra tu pega en Chile — agregador de empleos, constructor de CV con IA y match inteligente.

Open source, gratis, sin fines de lucro.

## Que es

**LaPala** (de "agarrar la pala" = agarrar pega) es una plataforma que:

1. **Agrega ofertas de empleo** desde Get on Board, ChileTrabajos, Computrabajo y BNE (actualizado cada 6 horas via GitHub Actions)
2. **Construye tu CV** con [rendercv](https://github.com/rendercv/rendercv) — formulario guiado → YAML → PDF profesional
3. **Usa IA (Claude)** para generar tu CV desde texto libre y hacer match CV ↔ oferta

## Stack

| Capa | Tecnologia |
|---|---|
| Frontend | Astro 5 + React islands + Tailwind v4 |
| Backend | FastAPI + rendercv + Anthropic SDK |
| DB | Supabase (free tier) |
| Ingesta | GitHub Actions cron (cada 6h) |
| Deploy | Cloudflare Pages (frontend) + Render (backend) |

## Estructura

```
lapala/
├── frontend/               # Astro + React + Tailwind
│   └── src/
│       ├── features/
│       │   ├── jobs/       # listado, filtros, cards
│       │   ├── cv/         # builder, yamlBuilder
│       │   └── ai/         # AIPanel, useAiLimit
│       ├── layouts/
│       ├── lib/            # supabase client
│       └── pages/          # index, /cv, /ai
├── backend/                # FastAPI
│   └── routers/
│       ├── cv.py           # POST /cv/render
│       └── ai.py           # POST /ai/analyze-cv, /ai/generate-cv, /ai/match, /ai/rank-jobs
├── scrapers/               # Python scrapers
│   ├── lapala_scrapers/sources/
│   │   ├── getonbrd.py
│   │   ├── chiletrabajos.py
│   │   ├── computrabajo.py
│   │   ├── bne.py
│   │   └── greenhouse.py
│   └── run_ingest.py       # target del cron de GitHub Actions
├── examples/               # CVs YAML de ejemplo (formato rendercv)
└── .github/workflows/
    └── ingest.yml          # cron cada 6 horas
```

## Setup rapido

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com) (free)
2. Crea la tabla `jobs` via SQL Editor (ver schema en `examples/`)
3. Copia las keys de **Settings > API**

### 2. Frontend

```bash
cd frontend
cp ../.env.example .env       # edita con tus keys de Supabase
pnpm install
pnpm dev                      # localhost:4321
```

### 3. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### 4. Scrapers (prueba local)

```bash
cd scrapers
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python run_ingest.py all           # todas las fuentes
python run_ingest.py getonbrd      # solo Get on Board
```

### 5. GitHub Actions (ingesta automatica)

En tu repo → **Settings > Secrets and variables > Actions**, agrega:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

El workflow `ingest.yml` corre cada 6 horas automaticamente.

## Fuentes de empleo

| Fuente | Metodo | Estado |
|---|---|---|
| [Get on Board](https://www.getonbrd.com) | API publica oficial | activo |
| [ChileTrabajos](https://www.chiletrabajos.cl) | Scraping | activo |
| [Computrabajo](https://www.computrabajo.cl) | Scraping | activo |
| [BNE](https://www.bne.cl) | Scraping | activo |
| Greenhouse | API publica | en desarrollo |

**LinkedIn no esta incluido** — scrapear LinkedIn viola sus ToS. En cambio, puedes importar tu [export oficial de datos](https://www.linkedin.com/help/linkedin/answer/a1339364) para que la IA construya tu CV.

## Contribuir

PR bienvenidos. Cada nueva fuente va en `scrapers/lapala_scrapers/sources/` implementando `async def fetch() -> list[NormalizedJob]`.

## Licencia

[AGPL-3.0](LICENSE)
