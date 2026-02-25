"""
backend/app/schemas/dashboard.py
Pydantic schemas for GET /api/dashboard aggregation endpoint.
"""
from typing import Optional

from pydantic import BaseModel


class ColumnTimeOut(BaseModel):
    column: str
    avg_hours: float


class WorkloadItemOut(BaseModel):
    user_id: str
    user_name: str
    total_hours: float


class DeptBreakdownItemOut(BaseModel):
    department_id: str
    department_name: str
    ticket_count: int
    avg_cycle_hours: Optional[float] = None


class ThroughputPointOut(BaseModel):
    week: str  # ISO date string — week start Monday
    count: int


class DashboardOut(BaseModel):
    open_ticket_count: int
    overdue_count: int
    throughput_last_week: int
    avg_cycle_time_hours: Optional[float] = None
    column_times: list[ColumnTimeOut]
    workload: list[WorkloadItemOut]
    dept_breakdown: list[DeptBreakdownItemOut]
    throughput_trend: list[ThroughputPointOut]
