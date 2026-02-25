"""
Run with: python -m app.scripts.seed
Creates 7 departments and first admin user if they don't exist.
Reads SEED_ADMIN_PASSWORD from environment.
"""
import asyncio
import uuid

from pwdlib import PasswordHash
from sqlalchemy.dialects.postgresql import insert

from app.core.config import settings
from app.core.database import async_session_maker
from app.models.department import Department
from app.models.user import User, UserRole

DEPARTMENTS = [
    {"slug": "cashier", "name": "Cashier"},
    {"slug": "fintech360", "name": "Fintech360"},
    {"slug": "xbo_studio", "name": "XBO Studio"},
    {"slug": "xbo_marketing", "name": "XBO Marketing"},
    {"slug": "xbo_dev", "name": "XBO Dev"},
    {"slug": "xbo_legal", "name": "XBO Legal"},
    {"slug": "xbo_hr", "name": "XBO HR"},
]


async def seed() -> None:
    ph = PasswordHash.recommended()
    async with async_session_maker() as session:
        # Seed departments — idempotent
        for dept in DEPARTMENTS:
            stmt = (
                insert(Department)
                .values(id=uuid.uuid4(), slug=dept["slug"], name=dept["name"])
                .on_conflict_do_nothing(index_elements=["slug"])
            )
            await session.execute(stmt)

        # Seed admin user — idempotent (skip if admin@xbo.com exists)
        stmt = (
            insert(User)
            .values(
                id=uuid.uuid4(),
                email="admin@xbo.com",
                hashed_password=ph.hash(settings.SEED_ADMIN_PASSWORD),
                full_name="XBO Admin",
                role=UserRole.admin,
                is_active=True,
                token_version=0,
            )
            .on_conflict_do_nothing(index_elements=["email"])
        )
        await session.execute(stmt)
        await session.commit()
        print("Seed complete: 7 departments + admin@xbo.com")


if __name__ == "__main__":
    asyncio.run(seed())
