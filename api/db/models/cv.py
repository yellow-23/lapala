from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class CV(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "cvs"

    # FK to auth.users is enforced by Supabase RLS, not SQLAlchemy (auth schema is external)
    user_id: Mapped[uuid.UUID] = mapped_column(
        nullable=False,
    )
    yaml: Mapped[str] = mapped_column(Text, nullable=False)
    pdf_path: Mapped[str | None] = mapped_column(Text, nullable=True)

    profile: Mapped["Profile"] = relationship("Profile", back_populates="cvs")  # noqa: F821
    matches: Mapped[list["Match"]] = relationship("Match", back_populates="cv", cascade="all, delete-orphan")  # noqa: F821
