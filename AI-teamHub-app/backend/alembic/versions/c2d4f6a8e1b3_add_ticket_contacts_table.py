"""add_ticket_contacts_table

Revision ID: c2d4f6a8e1b3
Revises: b7e3f2c1d4a5
Create Date: 2026-02-27 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c2d4f6a8e1b3"
down_revision: Union[str, None] = "b7e3f2c1d4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ticket_contacts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("ticket_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("external_name", sa.String(length=200), nullable=True),
        sa.Column("external_email", sa.String(length=254), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "(user_id IS NOT NULL) OR (user_id IS NULL AND external_name IS NOT NULL)",
            name="ck_ticket_contacts_internal_or_external",
        ),
        sa.ForeignKeyConstraint(
            ["ticket_id"],
            ["tickets.id"],
            name=op.f("fk_ticket_contacts_ticket_id_tickets"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_ticket_contacts_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ticket_contacts")),
    )
    op.create_index(
        op.f("ix_ticket_contacts_ticket_id"),
        "ticket_contacts",
        ["ticket_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_ticket_contacts_user_id"),
        "ticket_contacts",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_ticket_contacts_user_id"), table_name="ticket_contacts")
    op.drop_index(op.f("ix_ticket_contacts_ticket_id"), table_name="ticket_contacts")
    op.drop_table("ticket_contacts")
