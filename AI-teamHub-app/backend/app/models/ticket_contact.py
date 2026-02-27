import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class TicketContact(Base):
    __tablename__ = "ticket_contacts"
    __table_args__ = (
        CheckConstraint(
            "(user_id IS NOT NULL) OR (user_id IS NULL AND external_name IS NOT NULL)",
            name="ck_ticket_contacts_internal_or_external",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid,
        sa.ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # NULL → external contact (name stored in external_name)
    # NOT NULL → internal contact (name/email resolved from User record)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid,
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    # Populated only for external contacts
    external_name: Mapped[str | None] = mapped_column(sa.String(200), nullable=True)
    external_email: Mapped[str | None] = mapped_column(sa.String(254), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        default=sa.func.now(),
        server_default=sa.func.now(),
        nullable=False,
    )

    # Relationships
    ticket = relationship("Ticket", back_populates="contacts", lazy="raise")
    user = relationship("User", lazy="raise")
