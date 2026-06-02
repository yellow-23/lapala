from __future__ import annotations

import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Match(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Claude-scored match between a CV and a job posting."""

    __tablename__ = "matches"

    cv_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("cvs.id", ondelete="CASCADE"),
        nullable=False,
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
    )
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)

    cv: Mapped["CV"] = relationship("CV", back_populates="matches")  # noqa: F821
    job: Mapped["Job"] = relationship("Job")  # noqa: F821

    __table_args__ = (
        CheckConstraint("score between 1 and 10", name="matches_score_range"),
    )
