"""ROI computation service.

Provides compute_roi_fields() which calculates all six derived ROI output
values from the seven input values stored on a ticket. Called by the PATCH
/api/tickets/{id} handler whenever any ROI input field is included in an
update payload.
"""
from __future__ import annotations


def compute_roi_fields(
    current_time_cost_hours_per_week: float | None,
    employees_affected: float | None,
    avg_hourly_cost: float | None,
    expected_savings_rate: float | None,
    risk_probability: float | None,
    effort_estimate: float | None,
    ai_team_hourly_rate: float,
) -> dict:
    """Compute all derived ROI fields from the given inputs.

    Returns a dict mapping each of the six output column names to their
    computed value (or None when inputs are insufficient).

    None-guard rules:
    - weekly_cost requires all three of hours/employees/avg_hourly_cost
    - yearly_cost requires weekly_cost
    - annual_savings requires yearly_cost and expected_savings_rate
    - dev_cost requires effort_estimate
    - roi requires annual_savings, dev_cost != 0  (ROI-05 guard)
    - adjusted_roi requires roi and risk_probability
    """
    # --- weekly_cost ---
    weekly_cost: float | None = None
    if all(
        v is not None
        for v in [current_time_cost_hours_per_week, employees_affected, avg_hourly_cost]
    ):
        weekly_cost = (
            current_time_cost_hours_per_week  # type: ignore[operator]
            * employees_affected              # type: ignore[operator]
            * avg_hourly_cost                 # type: ignore[operator]
        )

    # --- yearly_cost ---
    yearly_cost: float | None = weekly_cost * 52 if weekly_cost is not None else None

    # --- annual_savings ---
    annual_savings: float | None = None
    if yearly_cost is not None and expected_savings_rate is not None:
        annual_savings = yearly_cost * expected_savings_rate

    # --- dev_cost ---
    dev_cost: float | None = None
    if effort_estimate is not None:
        dev_cost = effort_estimate * ai_team_hourly_rate

    # --- roi (ROI-05: division-by-zero → NULL) ---
    roi: float | None = None
    if annual_savings is not None and dev_cost is not None and dev_cost != 0:
        roi = (annual_savings - dev_cost) / dev_cost

    # --- adjusted_roi ---
    adjusted_roi: float | None = None
    if roi is not None and risk_probability is not None:
        adjusted_roi = roi * (1 - risk_probability)

    return {
        "weekly_cost": weekly_cost,
        "yearly_cost": yearly_cost,
        "annual_savings": annual_savings,
        "dev_cost": dev_cost,
        "roi": roi,
        "adjusted_roi": adjusted_roi,
    }
