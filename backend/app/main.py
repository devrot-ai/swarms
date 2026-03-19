from fastapi import FastAPI
from app.api.routes import router
from app.core.database import Base, engine, SessionLocal
from app.models import entities  # noqa: F401
from app.services.policy import bootstrap_policies

app = FastAPI(title="Swarms Agentic Backend", version="1.0.0")
app.include_router(router, prefix="/api")

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        bootstrap_policies(db)
    finally:
        db.close()

@app.get("/")
def root():
    return {
        "name": "Swarms Agentic Backend",
        "status": "running",
        "docs": "/docs",
        "health": "/api/health"
    }
