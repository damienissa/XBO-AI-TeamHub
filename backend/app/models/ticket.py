import uuid
import enum
from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy import CheckConstraint, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class StatusColumn(str, enum.Enum):
    Backlog = "Backlog"
    Discovery = "Discovery"
    InProgress = "In Progress"
    ReviewQA = "Review/QA"
    Done = "Done"


class Priority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class Ticket(Base):
    __tablename__ = "tickets"
    __table_args__ = (
        CheckConstraint("urgency >= 1 AND urgency <= 5", name="ck_tickets_urgency"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(sa.String(500), nullable=False)
    problem_statement: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    urgency: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    business_impact: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    success_criteria: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    due_date: Mapped[date | None] = mapped_column(sa.Date, nullable=True)
    effort_estimate: Mapped[float | None] = mapped_column(sa.Float, nullable=True)
    next_step: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    priority: Mapped[Priority | None] = mapped_column(
        sa.Enum(
            Priority,
            name="priority_enum",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=True,
    )
    status_column: Mapped[StatusColumn] = mapped_column(
        sa.Enum(
            StatusColumn,
            name="status_column_enum",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=StatusColumn.Backlog,
        server_default="Backlog",
        nullable=False,
    )
    department_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, ForeignKey("departments.id"), nullable=False
    )
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        default=func.now(),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        default=func.now(),
        onupdate=func.now(),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships — lazy="raise" prevents accidental N+1 queries
    owner = relationship("User", foreign_keys=[owner_id], lazy="raise")
    department = relationship("Department", foreign_keys=[department_id], lazy="raise")
