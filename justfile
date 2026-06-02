# LaPala task automation — https://just.systems
# Install: brew install just

default:
    @just --list

# ── Dev ─────────────────────────────────────────────────────────────────────

dev:
    pnpm dev

build:
    pnpm build

api:
    cd api && uvicorn main:app --reload --port 8000

# ── Ingesta ─────────────────────────────────────────────────────────────────

ingest:
    cd scrapers && python run_ingest.py all

ingest-source source:
    cd scrapers && python run_ingest.py {{source}}

# ── Setup ───────────────────────────────────────────────────────────────────

install:
    pnpm install
    cd api && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
    cd scrapers && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

env:
    cp .env.example web/.env
    @echo "Edit web/.env with your Supabase keys"

# ── DB ──────────────────────────────────────────────────────────────────────

db-migrate:
    cd api && .venv/bin/alembic upgrade head

db-revision msg:
    cd api && .venv/bin/alembic revision --autogenerate -m "{{msg}}"

db-downgrade:
    cd api && .venv/bin/alembic downgrade -1

# ── Scrapers ─────────────────────────────────────────────────────────────────

test-scrapers:
    cd scrapers && python -c "import asyncio; from lapala_scrapers import GetOnBoardSource; jobs = asyncio.run(GetOnBoardSource().fetch(max_pages=1)); print(f'GetOnBoard: {len(jobs)} jobs')"
