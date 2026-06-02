from __future__ import annotations

import os
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

def _engine():
    return create_async_engine(os.environ["DATABASE_URL"], pool_pre_ping=True)


engine = None
SessionLocal: async_sessionmaker | None = None


def init_db() -> None:
    global engine, SessionLocal
    engine = _engine()
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
