"""ROI computation service.

Provides compute_roi_fields() which calculates all five derived ROI output
values from the inputs stored on a ticket. Called by the PATCH
/api/tickets/{id} handler whenever any ROI input field is included in an
update payload.
"""
from __future__ import annotations


def compute_roi_fields(
    current_time_cost_hours_per_week: float | None,
    employees_affected: float | None,
    avg_hourly_cost: float | None,
    effort_estimate: float | None,
    ai_team_hourly_rate: float,
) -> dict:
    """Compute all derived ROI fields from the given inputs.

    Returns a dict mapping each of the five output column names to their
    computed value (or None when inputs are insufficient).

    None-guard rules:
    - weekly_cost requires all three of hours/employees/avg_hourly_cost
    - yearly_cost requires weekly_cost
    - annual_savings equals yearly_cost (full cost savings assumed)
    - dev_cost requires effort_estimate
    - roi requires annual_savings, dev_cost != 0  (ROI-05 guard)
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

    # --- annual_savings (equals yearly_cost — full cost savings assumed) ---
    annual_savings: float | None = yearly_cost

    # --- dev_cost ---
    dev_cost: float | None = None
    if effort_estimate is not None:
        dev_cost = effort_estimate * ai_team_hourly_rate

    # --- roi (ROI-05: division-by-zero → NULL) ---
    roi: float | None = None
    if annual_savings is not None and dev_cost is not None and dev_cost != 0:
        roi = (annual_savings - dev_cost) / dev_cost

    return {
        "weekly_cost": weekly_cost,
        "yearly_cost": yearly_cost,
        "annual_savings": annual_savings,
        "dev_cost": dev_cost,
        "roi": roi,
    }
