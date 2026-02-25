"""
backend/app/routers/dashboard.py
GET /api/dashboard — single aggregation endpoint.
Returns all executive dashboard KPIs, column times, workload, dept breakdown,
and throughput trend in one response (DASH-06).
"""
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.column_history import ColumnHistory
from app.models.department import Department
from app.models.ticket import StatusColumn, Ticket
from app.models.user import User
from app.schemas.dashboard import (
    ColumnTimeOut,
    DashboardOut,
    DeptBreakdownItemOut,
    OwnerTicketCountOut,
    StatusBreakdownItemOut,
    ThroughputPointOut,
    UpcomingReleaseOut,
    WorkloadItemOut,
)

router = APIRouter()


@router.get("/dashboard", response_model=DashboardOut)
async def get_dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> DashboardOut:
    """Return all dashboard KPIs, charts data, and breakdowns in one round trip.

    All aggregation happens server-side in PostgreSQL — no N+1 queries.
    """
    today = date.today()
    now_utc = datetime.now(timezone.utc)

    # ------------------------------------------------------------------ #
    # 1. KPI: open ticket count — all tickets NOT in Done                 #
    # ------------------------------------------------------------------ #
    open_ticket_count: int = await db.scalar(
        select(func.count(Ticket.id)).where(Ticket.status_column != StatusColumn.Done)
    ) or 0

    # ------------------------------------------------------------------ #
    # 2. KPI: overdue count — due_date < today AND not Done               #
    # ------------------------------------------------------------------ #
    overdue_count: int = await db.scalar(
        select(func.count(Ticket.id)).where(
            Ticket.due_date < today,
            Ticket.status_column != StatusColumn.Done,
        )
    ) or 0

    # ------------------------------------------------------------------ #
    # 3. KPI: throughput last week — tickets that entered Done in 7 days  #
    # ------------------------------------------------------------------ #
    seven_days_ago = now_utc - timedelta(days=7)
    throughput_last_week: int = await db.scalar(
        select(func.count(ColumnHistory.ticket_id)).where(
            ColumnHistory.column == "Done",
            ColumnHistory.entered_at >= seven_days_ago,
        )
    ) or 0

    # ------------------------------------------------------------------ #
    # 4. KPI: avg cycle time — entered Done minus ticket.created_at       #
    # Pitfall 3: use column_history entered_at for Done, not updated_at   #
    # ------------------------------------------------------------------ #
    done_ch = aliased(ColumnHistory)
    cycle_time_result = await db.scalar(
        select(
            func.avg(
                func.extract("epoch", done_ch.entered_at - Ticket.created_at)
            )
        )
        .select_from(Ticket)
        .join(done_ch, (done_ch.ticket_id == Ticket.id) & (done_ch.column == "Done"))
        .where(Ticket.status_column == StatusColumn.Done)
    )
    avg_cycle_time_hours = (float(cycle_time_result) / 3600.0) if cycle_time_result else None

    # ------------------------------------------------------------------ #
    # 5. Avg time per column — DASH-02                                    #
    # Only completed column spans (exited_at IS NOT NULL)                 #
    # ------------------------------------------------------------------ #
    col_time_rows = (
        await db.execute(
            select(
                ColumnHistory.column,
                func.avg(
                    func.extract(
                        "epoch",
                        ColumnHistory.exited_at - ColumnHistory.entered_at,
                    )
                ).label("avg_seconds"),
            )
            .where(ColumnHistory.exited_at.is_not(None))
            .group_by(ColumnHistory.column)
        )
    ).all()

    column_times = [
        ColumnTimeOut(column=row.column, avg_hours=float(row.avg_seconds) / 3600.0)
        for row in col_time_rows
        if row.avg_seconds is not None
    ]

    # ------------------------------------------------------------------ #
    # 6. Throughput trend — last 8 weeks bucketed by week                 #
    # ------------------------------------------------------------------ #
    eight_weeks_ago = now_utc - timedelta(weeks=8)
    week_trunc = func.date_trunc(text("'week'"), ColumnHistory.entered_at)
    throughput_rows = (
        await db.execute(
            select(
                week_trunc.label("week_start"),
                func.count(ColumnHistory.ticket_id).label("count"),
            )
            .where(
                ColumnHistory.column == "Done",
                ColumnHistory.entered_at >= eight_weeks_ago,
            )
            .group_by(week_trunc)
            .order_by(week_trunc)
        )
    ).all()

    throughput_trend = [
        ThroughputPointOut(
            week=row.week_start.isoformat(),
            count=row.count,
        )
        for row in throughput_rows
    ]

    # ------------------------------------------------------------------ #
    # 7. Workload per user — DASH-04                                      #
    # Active tickets only: NOT Backlog AND NOT Done; effort NOT NULL      #
    # NULL effort_estimate tickets are naturally excluded by SUM           #
    # ------------------------------------------------------------------ #
    workload_rows = (
        await db.execute(
            select(
                Ticket.owner_id,
                func.sum(Ticket.effort_estimate).label("total_hours"),
            )
            .where(
                Ticket.owner_id.is_not(None),
                Ticket.effort_estimate.is_not(None),
                Ticket.status_column.not_in([StatusColumn.Backlog, StatusColumn.Done]),
            )
            .group_by(Ticket.owner_id)
        )
    ).all()

    workload: list[WorkloadItemOut] = []
    if workload_rows:
        owner_ids = [row.owner_id for row in workload_rows]
        user_rows = (
            await db.execute(
                select(User.id, User.full_name).where(User.id.in_(owner_ids))
            )
        ).all()
        user_name_by_id = {str(u.id): u.full_name for u in user_rows}

        for row in workload_rows:
            user_id_str = str(row.owner_id)
            workload.append(
                WorkloadItemOut(
                    user_id=user_id_str,
                    user_name=user_name_by_id.get(user_id_str, "Unknown"),
                    total_hours=float(row.total_hours),
                )
            )

    # ------------------------------------------------------------------ #
    # 8. Department breakdown — DASH-05                                   #
    # Ticket counts and avg cycle time per department                     #
    # ------------------------------------------------------------------ #
    dept_done_ch = aliased(ColumnHistory)

    dept_rows = (
        await db.execute(
            select(
                Ticket.department_id,
                func.count(Ticket.id).label("ticket_count"),
                func.avg(
                    func.extract("epoch", dept_done_ch.entered_at - Ticket.created_at)
                ).label("avg_cycle_seconds"),
            )
            .select_from(Ticket)
            .outerjoin(
                dept_done_ch,
                (dept_done_ch.ticket_id == Ticket.id) & (dept_done_ch.column == "Done"),
            )
            .group_by(Ticket.department_id)
        )
    ).all()

    dept_breakdown: list[DeptBreakdownItemOut] = []
    if dept_rows:
        dept_ids = [row.department_id for row in dept_rows]
        department_rows = (
            await db.execute(
                select(Department.id, Department.name).where(Department.id.in_(dept_ids))
            )
        ).all()
        dept_name_by_id = {str(d.id): d.name for d in department_rows}

        for row in dept_rows:
            dept_id_str = str(row.department_id)
            avg_cycle_hours = (
                float(row.avg_cycle_seconds) / 3600.0
                if row.avg_cycle_seconds is not None
                else None
            )
            dept_breakdown.append(
                DeptBreakdownItemOut(
                    department_id=dept_id_str,
                    department_name=dept_name_by_id.get(dept_id_str, "Unknown"),
                    ticket_count=row.ticket_count,
                    avg_cycle_hours=avg_cycle_hours,
                )
            )

    # ------------------------------------------------------------------ #
    # 9. Ticket count per status column                                   #
    # ------------------------------------------------------------------ #
    status_rows = (
        await db.execute(
            select(Ticket.status_column, func.count(Ticket.id).label("count"))
            .group_by(Ticket.status_column)
        )
    ).all()

    status_breakdown = [
        StatusBreakdownItemOut(status=row.status_column, count=row.count)
        for row in status_rows
    ]

    # ------------------------------------------------------------------ #
    # 10. Ticket count per owner (all non-unassigned tickets)             #
    # ------------------------------------------------------------------ #
    owner_count_rows = (
        await db.execute(
            select(Ticket.owner_id, func.count(Ticket.id).label("count"))
            .where(Ticket.owner_id.is_not(None))
            .group_by(Ticket.owner_id)
            .order_by(func.count(Ticket.id).desc())
        )
    ).all()

    tickets_by_owner: list[OwnerTicketCountOut] = []
    if owner_count_rows:
        oid_list = [row.owner_id for row in owner_count_rows]
        owner_user_rows = (
            await db.execute(
                select(User.id, User.full_name).where(User.id.in_(oid_list))
            )
        ).all()
        uname_by_id = {str(u.id): u.full_name for u in owner_user_rows}
        tickets_by_owner = [
            OwnerTicketCountOut(
                user_id=str(row.owner_id),
                user_name=uname_by_id.get(str(row.owner_id), "Unknown"),
                ticket_count=row.count,
            )
            for row in owner_count_rows
        ]

    # ------------------------------------------------------------------ #
    # 11. Upcoming releases — tickets with due_date, not Done, asc order  #
    # ------------------------------------------------------------------ #
    release_rows = (
        await db.execute(
            select(
                Ticket.id,
                Ticket.title,
                Ticket.due_date,
                Ticket.status_column,
                Ticket.owner_id,
            )
            .where(
                Ticket.due_date.is_not(None),
                Ticket.status_column != StatusColumn.Done,
            )
            .order_by(Ticket.due_date.asc())
            .limit(20)
        )
    ).all()

    upcoming_releases: list[UpcomingReleaseOut] = []
    if release_rows:
        rel_owner_ids = list({row.owner_id for row in release_rows if row.owner_id})
        rel_uname: dict[str, str] = {}
        if rel_owner_ids:
            rel_user_rows = (
                await db.execute(
                    select(User.id, User.full_name).where(User.id.in_(rel_owner_ids))
                )
            ).all()
            rel_uname = {str(u.id): u.full_name for u in rel_user_rows}
        upcoming_releases = [
            UpcomingReleaseOut(
                ticket_id=str(row.id),
                title=row.title,
                due_date=row.due_date.isoformat(),
                status=row.status_column,
                owner_name=rel_uname.get(str(row.owner_id)) if row.owner_id else None,
            )
            for row in release_rows
        ]

    return DashboardOut(
        open_ticket_count=open_ticket_count,
        overdue_count=overdue_count,
        throughput_last_week=throughput_last_week,
        avg_cycle_time_hours=avg_cycle_time_hours,
        column_times=column_times,
        workload=workload,
        dept_breakdown=dept_breakdown,
        throughput_trend=throughput_trend,
        status_breakdown=status_breakdown,
        tickets_by_owner=tickets_by_owner,
        upcoming_releases=upcoming_releases,
    )
