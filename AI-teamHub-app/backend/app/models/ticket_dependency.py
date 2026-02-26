import sqlalchemy as sa
from app.models.base import Base

# Pure association table — no ORM class needed (no extra columns)
# blocker_id: the ticket that blocks
# blocked_id: the ticket being blocked
ticket_dependencies = sa.Table(
    "ticket_dependencies",
    Base.metadata,
    sa.Column("blocker_id", sa.Uuid, sa.ForeignKey("tickets.id", ondelete="CASCADE"), primary_key=True),
    sa.Column("blocked_id", sa.Uuid, sa.ForeignKey("tickets.id", ondelete="CASCADE"), primary_key=True),
)
