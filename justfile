# LaPala task automation — https://just.systems
# Install: brew install just

# List available commands
default:
    @just --list

# ── Dev ─────────────────────────────────────────────────────────────────────

# Start Astro dev server
dev:
    pnpm dev

# Build Astro for production
build:
    pnpm build

# Start FastAPI in dev mode
api:
    cd src/api && uvicorn main:app --reload --port 8000

# ── Ingesta ─────────────────────────────────────────────────────────────────

# Run full ingestion (all sources)
ingest:
    cd src/scrapers && python run_ingest.py all

# Run a specific source: just ingest-source getonbrd
ingest-source source:
    cd src/scrapers && python run_ingest.py {{source}}

# ── Setup ───────────────────────────────────────────────────────────────────

# Install all dependencies (Node + Python)
install:
    pnpm install
    cd src/api && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
    cd src/scrapers && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

# Copy .env.example to src/web/.env
env:
    cp .env.example src/web/.env
    @echo "Edit src/web/.env with your Supabase keys"

# ── DB ──────────────────────────────────────────────────────────────────────

# Apply the initial migration (requires supabase CLI)
db-migrate:
    supabase db push --file supabase/migrations/0001_init.sql

# ── Tests ───────────────────────────────────────────────────────────────────

# Run Python tests
test:
    python -m pytest tests/ -v

# Run a quick smoke test for each scraper source
test-scrapers:
    cd src/scrapers && python -c "import asyncio; from lapala_scrapers import GetOnBoardSource; jobs = asyncio.run(GetOnBoardSource().fetch(max_pages=1)); print(f'GetOnBoard: {len(jobs)} jobs')"
