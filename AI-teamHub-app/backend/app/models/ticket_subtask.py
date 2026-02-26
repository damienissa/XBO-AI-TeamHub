import uuid

import sqlalchemy as sa
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class TicketSubtask(Base):
    __tablename__ = "ticket_subtasks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(sa.String(500), nullable=False)
    done: Mapped[bool] = mapped_column(
        sa.Boolean, default=False, server_default="false", nullable=False
    )
    position: Mapped[int] = mapped_column(sa.Integer, nullable=False)

    ticket = relationship("Ticket", back_populates="subtasks", lazy="raise")
