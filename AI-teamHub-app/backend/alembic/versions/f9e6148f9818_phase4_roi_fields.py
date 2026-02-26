"""phase4_roi_fields

Drops Phase 3 stub ROI columns (hours_saved_per_month, cost_savings_per_month,
revenue_impact) and replaces them with the full ROI-01 field set: 8 input
columns and 6 computed/persisted output columns.

Revision ID: f9e6148f9818
Revises: 93dab7e5b92c
Create Date: 2026-02-25 12:15:55.014992

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f9e6148f9818'
down_revision: Union[str, None] = '93dab7e5b92c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop Phase 3 stub ROI columns
    op.drop_column('tickets', 'hours_saved_per_month')
    op.drop_column('tickets', 'cost_savings_per_month')
    op.drop_column('tickets', 'revenue_impact')

    # Add full ROI input fields (ROI-01)
    op.add_column('tickets', sa.Column('current_time_cost_hours_per_week', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('employees_affected', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('avg_hourly_cost', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('current_error_rate', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('revenue_blocked', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('strategic_value', sa.Integer(), nullable=True))
    op.add_column('tickets', sa.Column('expected_savings_rate', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('risk_probability', sa.Float(), nullable=True))

    # Add computed/persisted ROI output fields (ROI-02)
    op.add_column('tickets', sa.Column('weekly_cost', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('yearly_cost', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('annual_savings', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('dev_cost', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('roi', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('adjusted_roi', sa.Float(), nullable=True))


def downgrade() -> None:
    # Remove computed output fields
    op.drop_column('tickets', 'adjusted_roi')
    op.drop_column('tickets', 'roi')
    op.drop_column('tickets', 'dev_cost')
    op.drop_column('tickets', 'annual_savings')
    op.drop_column('tickets', 'yearly_cost')
    op.drop_column('tickets', 'weekly_cost')

    # Remove ROI input fields
    op.drop_column('tickets', 'risk_probability')
    op.drop_column('tickets', 'expected_savings_rate')
    op.drop_column('tickets', 'strategic_value')
    op.drop_column('tickets', 'revenue_blocked')
    op.drop_column('tickets', 'current_error_rate')
    op.drop_column('tickets', 'avg_hourly_cost')
    op.drop_column('tickets', 'employees_affected')
    op.drop_column('tickets', 'current_time_cost_hours_per_week')

    # Restore Phase 3 stub ROI columns
    op.add_column('tickets', sa.Column('revenue_impact', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('cost_savings_per_month', sa.Float(), nullable=True))
    op.add_column('tickets', sa.Column('hours_saved_per_month', sa.Float(), nullable=True))
