"""FastAPI application entry point."""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.api.routes import router as main_router
from app.api.auth_routes import router as auth_router
from app.core.database import Base, engine, SessionLocal
from app.core.middleware import register_middleware
from app.models import entities  # noqa: F401
from app.services.policy import bootstrap_policies
from app.services.agent_manager import ensure_default_agents

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        bootstrap_policies(db)
        ensure_default_agents(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Swarms Agentic Backend", version="2.0.0", lifespan=lifespan)
register_middleware(app)
app.include_router(main_router, prefix="/api")
app.include_router(auth_router, prefix="/api")


@app.get("/")
def root():
    return {
        "name": "Swarms Agentic Backend",
        "version": "2.0.0",
        "status": "running",
        "docs": "/docs",
        "health": "/api/health",
    }
