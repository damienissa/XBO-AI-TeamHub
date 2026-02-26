"""drop_roi_adjustment_fields

Revision ID: 13444529af83
Revises: f9e6148f9818
Create Date: 2026-02-25 13:15:26.146706

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '13444529af83'
down_revision: Union[str, None] = 'f9e6148f9818'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('tickets', 'expected_savings_rate')
    op.drop_column('tickets', 'risk_probability')
    op.drop_column('tickets', 'strategic_value')
    op.drop_column('tickets', 'adjusted_roi')


def downgrade() -> None:
    op.add_column('tickets', sa.Column('adjusted_roi', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('strategic_value', sa.Integer(), nullable=True))
    op.add_column('tickets', sa.Column('risk_probability', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('expected_savings_rate', sa.Float(), nullable=True))
