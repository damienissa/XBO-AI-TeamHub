import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ColumnHistory(Base):
    __tablename__ = "column_history"
    __table_args__ = (
        # Fast lookup for "find open row" queries — (ticket_id, exited_at IS NULL)
        Index("ix_column_history_ticket_exited", "ticket_id", "exited_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid,
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
    )
    column: Mapped[str] = mapped_column(sa.String(100), nullable=False)
    entered_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
    )
    exited_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=True,
    )
