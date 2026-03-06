# backend/tests/test_services_roi.py
# Pure unit tests for app.services.roi.compute_roi_fields()

from app.services.roi import compute_roi_fields

RATE = 75.0  # ai_team_hourly_rate


def test_roi_all_inputs_provided():
    result = compute_roi_fields(
        current_time_cost_hours_per_week=10,
        employees_affected=5,
        avg_hourly_cost=50,
        effort_estimate=100,
        ai_team_hourly_rate=RATE,
    )
    assert result["weekly_cost"] == 10 * 5 * 50  # 2500
    assert result["yearly_cost"] == 2500 * 52     # 130000
    assert result["annual_savings"] == 130000
    assert result["dev_cost"] == 100 * RATE       # 7500
    assert result["roi"] == (130000 - 7500) / 7500


def test_roi_missing_hours():
    result = compute_roi_fields(None, 5, 50, 100, RATE)
    assert result["weekly_cost"] is None
    assert result["yearly_cost"] is None
    assert result["annual_savings"] is None
    assert result["roi"] is None
    assert result["dev_cost"] == 100 * RATE


def test_roi_missing_employees():
    result = compute_roi_fields(10, None, 50, 100, RATE)
    assert result["weekly_cost"] is None
    assert result["yearly_cost"] is None
    assert result["annual_savings"] is None
    assert result["roi"] is None


def test_roi_missing_avg_hourly_cost():
    result = compute_roi_fields(10, 5, None, 100, RATE)
    assert result["weekly_cost"] is None
    assert result["yearly_cost"] is None
    assert result["annual_savings"] is None
    assert result["roi"] is None


def test_roi_missing_effort_estimate():
    result = compute_roi_fields(10, 5, 50, None, RATE)
    assert result["weekly_cost"] == 2500
    assert result["yearly_cost"] == 130000
    assert result["annual_savings"] == 130000
    assert result["dev_cost"] is None
    assert result["roi"] is None


def test_roi_all_none():
    result = compute_roi_fields(None, None, None, None, RATE)
    assert all(v is None for v in result.values())


def test_roi_zero_effort_divbyzero():
    result = compute_roi_fields(10, 5, 50, 0, RATE)
    assert result["dev_cost"] == 0
    assert result["roi"] is None  # Division by zero guard


def test_roi_high_savings_low_cost():
    result = compute_roi_fields(20, 10, 100, 10, RATE)
    weekly = 20 * 10 * 100  # 20000
    yearly = weekly * 52     # 1040000
    dev = 10 * RATE          # 750
    assert result["roi"] == (yearly - dev) / dev


def test_roi_negative_roi():
    result = compute_roi_fields(1, 1, 1, 1000, RATE)
    weekly = 1
    yearly = 52
    dev = 1000 * RATE  # 75000
    assert result["roi"] == (yearly - dev) / dev
    assert result["roi"] < 0
