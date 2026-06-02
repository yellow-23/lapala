from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Profile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    prefs: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    cvs: Mapped[list["CV"]] = relationship("CV", back_populates="profile", cascade="all, delete-orphan")  # noqa: F821
