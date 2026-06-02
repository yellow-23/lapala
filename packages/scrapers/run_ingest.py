#!/usr/bin/env python3
"""
Ingest script — runs all scrapers and upserts to Supabase.
Used by GitHub Actions cron. Run locally: python run_ingest.py [getonbrd|chiletrabajos|all]
"""

import asyncio
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv
from supabase import create_client

from lapala_scrapers import GetOnBoardSource, ChiletrabajosSource, NormalizedJob

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]


def to_row(job: NormalizedJob) -> dict:
    return {
        "source": job.source,
        "source_id": job.source_id,
        "title": job.title,
        "company": job.company,
        "location": job.location,
        "remote": job.remote,
        "url": job.url,
        "description": job.description,
        "tags": job.tags,
        "salary": job.salary,
        "posted_at": job.posted_at.isoformat() if job.posted_at else None,
        "raw": job.raw,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


async def run(sources: list[str]) -> None:
    db = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    all_jobs: list[NormalizedJob] = []

    if "getonbrd" in sources or "all" in sources:
        print("[getonbrd] fetching...")
        jobs = await GetOnBoardSource().fetch()
        print(f"[getonbrd] {len(jobs)} jobs")
        all_jobs.extend(jobs)

    if "chiletrabajos" in sources or "all" in sources:
        print("[chiletrabajos] fetching...")
        jobs = await ChiletrabajosSource().fetch()
        print(f"[chiletrabajos] {len(jobs)} jobs")
        all_jobs.extend(jobs)

    if not all_jobs:
        print("No jobs fetched.")
        return

    rows = [to_row(j) for j in all_jobs]
    # Upsert in chunks of 100
    chunk_size = 100
    total_upserted = 0
    for i in range(0, len(rows), chunk_size):
        chunk = rows[i : i + chunk_size]
        db.table("jobs").upsert(chunk, on_conflict="source,source_id").execute()
        total_upserted += len(chunk)

    print(f"Upserted {total_upserted} rows to Supabase.")


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "all"
    asyncio.run(run([target]))
