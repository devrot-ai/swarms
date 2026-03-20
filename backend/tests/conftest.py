"""Shared test fixtures: in-memory DB, test client, and auth helpers."""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Override env before importing app
os.environ["DATABASE_URL"] = "sqlite:///./test_swarms.db"
os.environ["JWT_SECRET"] = "test-secret"
os.environ["ENABLE_LLM"] = "false"
os.environ["AUTO_APPROVE"] = "true"

from app.main import app  # noqa: E402
from app.core.database import Base, get_db  # noqa: E402
from app.services.auth import create_access_token  # noqa: E402

TEST_DB_URL = "sqlite:///./test_swarms.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    """Create tables before each test, drop after."""
    Base.metadata.create_all(bind=test_engine)
    from app.services.policy import bootstrap_policies
    db = TestSession()
    bootstrap_policies(db)
    db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers():
    """Return headers with a valid admin JWT."""
    token = create_access_token("admin", "admin")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def user_headers():
    """Return headers with a valid user JWT."""
    token = create_access_token("user", "user")
    return {"Authorization": f"Bearer {token}"}
