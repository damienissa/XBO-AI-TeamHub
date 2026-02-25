import os
import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from pwdlib import PasswordHash
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
    "postgresql+asyncpg://xbo:xbo@localhost:5432/xbo_test",
)

# Departments data — mirrors seed.py
DEPARTMENTS = [
    {"slug": "cashier", "name": "Cashier"},
    {"slug": "fintech360", "name": "Fintech360"},
    {"slug": "xbo_studio", "name": "XBO Studio"},
    {"slug": "xbo_marketing", "name": "XBO Marketing"},
    {"slug": "xbo_dev", "name": "XBO Dev"},
    {"slug": "xbo_legal", "name": "XBO Legal"},
    {"slug": "xbo_hr", "name": "XBO HR"},
]


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


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
    """Seed the test DB with all 7 departments and one admin user.

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
