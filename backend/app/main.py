from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import departments as departments_router
from app.routers.auth import router as auth_router
from app.routers.board import router as board_router
from app.routers.comments import router as comments_router
from app.routers.custom_fields import router as custom_fields_router
from app.routers.dashboard import router as dashboard_router
from app.routers.dependencies import router as dependencies_router
from app.routers.saved_filters import router as saved_filters_router
from app.routers.sprints import router as sprints_router
from app.routers.subtasks import router as subtasks_router
from app.routers.templates import router as templates_router
from app.routers.tickets import router as tickets_router
from app.routers.wiki import router as wiki_router

app = FastAPI(title="XBO TeamHub API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(departments_router.router)
app.include_router(tickets_router, prefix="/api/tickets", tags=["tickets"])
app.include_router(board_router, prefix="/api", tags=["board"])
app.include_router(dashboard_router, prefix="/api", tags=["dashboard"])
app.include_router(comments_router, prefix="/api")
app.include_router(subtasks_router, prefix="/api")
app.include_router(templates_router, prefix="/api")

# Phase 5: Advanced features routers
# dependencies router path: /api/tickets/{ticket_id}/dependencies (nested under /api/tickets prefix)
app.include_router(dependencies_router, prefix="/api/tickets", tags=["dependencies"])
app.include_router(sprints_router, prefix="/api/sprints", tags=["sprints"])
app.include_router(custom_fields_router, prefix="/api/custom-field-defs", tags=["custom_fields"])
app.include_router(saved_filters_router, prefix="/api/saved-filters", tags=["saved_filters"])
app.include_router(wiki_router, prefix="/api/wiki", tags=["wiki"])


@app.get("/health")
async def health_check() -> dict:
    return {"status": "ok"}


@app.get("/api/config")
async def get_config() -> dict:
    """Public config endpoint — returns AI team hourly rate for live ROI calculation."""
    return {"ai_team_hourly_rate": settings.AI_TEAM_HOURLY_RATE}
