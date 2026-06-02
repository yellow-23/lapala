from datetime import datetime
from pydantic import BaseModel


class NormalizedJob(BaseModel):
    source: str
    source_id: str
    title: str
    company: str
    location: str | None = None
    remote: bool = False
    url: str
    description: str | None = None
    tags: list[str] = []
    salary: str | None = None
    posted_at: datetime | None = None
    raw: dict = {}
