import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class TicketComment(Base):
    __tablename__ = "ticket_comments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, ForeignKey("users.id"), nullable=False
    )
    body: Mapped[str] = mapped_column(sa.Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        default=func.now(),
        server_default=func.now(),
        nullable=False,
    )

    ticket = relationship("Ticket", back_populates="comments", lazy="raise")
    author = relationship("User", foreign_keys=[author_id], lazy="raise")
