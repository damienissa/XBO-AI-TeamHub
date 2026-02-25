from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import departments as departments_router
from app.routers.auth import router as auth_router
from app.routers.board import router as board_router
from app.routers.tickets import router as tickets_router

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


@app.get("/health")
async def health_check() -> dict:
    return {"status": "ok"}
