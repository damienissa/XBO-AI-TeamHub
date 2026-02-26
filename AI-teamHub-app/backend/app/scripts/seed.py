"""
Run with: python -m app.scripts.seed
Syncs departments to the canonical list and seeds the admin user.
Reads SEED_ADMIN_PASSWORD from environment.
"""
import asyncio
import uuid

from pwdlib import PasswordHash
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert

from app.core.config import settings
from app.core.database import async_session_maker
from app.models.department import Department
from app.models.user import User, UserRole

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


async def seed() -> None:
    ph = PasswordHash.recommended()
    canonical_slugs = [d["slug"] for d in DEPARTMENTS]
    async with async_session_maker() as session:
        # Remove any departments no longer in the canonical list
        await session.execute(
            delete(Department).where(Department.slug.not_in(canonical_slugs))
        )

        # Upsert all canonical departments (insert or update name)
        for dept in DEPARTMENTS:
            stmt = (
                insert(Department)
                .values(id=uuid.uuid4(), slug=dept["slug"], name=dept["name"])
                .on_conflict_do_update(
                    index_elements=["slug"],
                    set_={"name": dept["name"]},
                )
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
        print("Seed complete: 23 departments + admin@xbo.com")


if __name__ == "__main__":
    asyncio.run(seed())
