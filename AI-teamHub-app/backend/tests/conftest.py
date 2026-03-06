import os
import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from typing import AsyncGenerator

from app.main import app
from app.core.database import get_db, Base
from app.models.department import Department
from app.models.user import User, UserRole

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://xbo:xbo_local_dev_2026@postgres:5432/xbo_test",
)

# Shared constants
ADMIN_EMAIL = "admin@xbo.com"
ADMIN_PASSWORD = "seedpassword"
VALID_TEST_PASSWORD = "TestPass123!"  # 12+ chars, upper, lower, digit

# Departments data — mirrors seed.py
DEPARTMENTS = [
    {"slug": "rnd", "name": "R&D"},
    {"slug": "back_office", "name": "Back office"},
    {"slug": "banking", "name": "Banking"},
    {"slug": "bi", "name": "BI"},
    {"slug": "bizdev_sales", "name": "Bizdev & Sales"},
    {"slug": "cashier", "name": "Cashier"},
    {"slug": "compliance", "name": "Compliance"},
    {"slug": "content", "name": "Content"},
    {"slug": "creative_studio", "name": "Creative Studio"},
    {"slug": "design", "name": "Design"},
    {"slug": "customer_support", "name": "Customer Support"},
    {"slug": "dealing", "name": "Dealing"},
    {"slug": "devops_it", "name": "DevOps & IT"},
    {"slug": "finance", "name": "Finance"},
    {"slug": "hr_recruitment_cy", "name": "HR&Recruitment (CY)"},
    {"slug": "hr_recruitment_ukr", "name": "HR&Recruitment (UKR)"},
    {"slug": "legal", "name": "Legal"},
    {"slug": "onboarding", "name": "Onboarding"},
    {"slug": "product_xbo", "name": "Product (XBO)"},
    {"slug": "success", "name": "Success"},
    {"slug": "technical_support", "name": "Technical Support"},
    {"slug": "technical_writers", "name": "Technical Writers"},
    {"slug": "ui_ux", "name": "UI/UX"},
]


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True, scope="session")
def disable_rate_limiter():
    """Prevent slowapi from returning 429 during tests."""
    app.state.limiter.enabled = False


@pytest.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create a fresh database schema per test function.

    NullPool is required so asyncpg does not try to reuse connections
    across event loop boundaries, which causes RuntimeError: Future attached
    to a different loop.
    The engine is created and disposed entirely within this fixture's lifetime.
    """
    engine = create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=NullPool)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(engine, expire_on_commit=False)

    session = session_maker()
    try:
        yield session
    finally:
        await session.close()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture(scope="function")
async def seeded_db(db_session: AsyncSession) -> AsyncGenerator[AsyncSession, None]:
    """Seed the test DB with all 23 departments and one admin user.

    Admin credentials: email=admin@xbo.com, password=seedpassword
    """
    ph = PasswordHash.recommended()

    for dept in DEPARTMENTS:
        await db_session.execute(
            insert(Department)
            .values(id=uuid.uuid4(), slug=dept["slug"], name=dept["name"])
            .on_conflict_do_nothing(index_elements=["slug"])
        )

    await db_session.execute(
        insert(User)
        .values(
            id=uuid.uuid4(),
            email="admin@xbo.com",
            hashed_password=ph.hash("seedpassword"),
            full_name="Admin",
            role=UserRole.admin,
            is_active=True,
            token_version=0,
        )
        .on_conflict_do_nothing(index_elements=["email"])
    )
    await db_session.commit()
    yield db_session


@pytest.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
async def auth_client(seeded_db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """AsyncClient authenticated as admin (carries session cookie)."""
    def override_get_db():
        yield seeded_db

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        resp = await ac.post("/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
        })
        assert resp.status_code == 200, f"Admin login failed: {resp.text}"
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
async def member_client(seeded_db: AsyncSession, auth_client: AsyncClient) -> AsyncGenerator[AsyncClient, None]:
    """AsyncClient authenticated as a member (non-admin) user."""
    resp = await auth_client.post("/api/auth/users", json={
        "email": "member@test.com",
        "password": VALID_TEST_PASSWORD,
        "full_name": "Test Member",
        "role": "member",
    })
    assert resp.status_code == 201, f"Member creation failed: {resp.text}"

    def override_get_db():
        yield seeded_db

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        login_resp = await ac.post("/api/auth/login", json={
            "email": "member@test.com",
            "password": VALID_TEST_PASSWORD,
        })
        assert login_resp.status_code == 200, f"Member login failed: {login_resp.text}"
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
async def dept_id(seeded_db: AsyncSession) -> uuid.UUID:
    """Return the UUID of the first seeded department (cashier)."""
    result = await seeded_db.execute(
        select(Department.id).where(Department.slug == "cashier")
    )
    return result.scalar_one()


@pytest.fixture(scope="function")
async def admin_user_id(seeded_db: AsyncSession) -> uuid.UUID:
    """Return the UUID of the seeded admin user."""
    result = await seeded_db.execute(
        select(User.id).where(User.email == ADMIN_EMAIL)
    )
    return result.scalar_one()


@pytest.fixture(scope="function")
async def created_ticket(auth_client: AsyncClient, dept_id: uuid.UUID) -> dict:
    """Create a ticket and return the response JSON."""
    resp = await auth_client.post("/api/tickets/", json={
        "title": "Test Ticket",
        "department_id": str(dept_id),
    })
    assert resp.status_code == 201, f"Ticket creation failed: {resp.text}"
    return resp.json()
