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


class StatusBreakdownItemOut(BaseModel):
    status: str
    count: int


class OwnerTicketCountOut(BaseModel):
    user_id: str
    user_name: str
    ticket_count: int


class UpcomingReleaseOut(BaseModel):
    ticket_id: str
    title: str
    due_date: str  # ISO date string
    status: str
    owner_name: Optional[str] = None


class DashboardOut(BaseModel):
    open_ticket_count: int
    overdue_count: int
    throughput_last_week: int
    avg_cycle_time_hours: Optional[float] = None
    column_times: list[ColumnTimeOut]
    workload: list[WorkloadItemOut]
    dept_breakdown: list[DeptBreakdownItemOut]
    throughput_trend: list[ThroughputPointOut]
    status_breakdown: list[StatusBreakdownItemOut]
    tickets_by_owner: list[OwnerTicketCountOut]
    upcoming_releases: list[UpcomingReleaseOut]
