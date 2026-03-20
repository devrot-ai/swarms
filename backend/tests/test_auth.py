"""Authentication tests: login, token validation, protected routes."""


def test_login_success(client):
    r = client.post("/api/auth/token", json={"username": "admin", "password": "admin"})
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_failure(client):
    r = client.post("/api/auth/token", json={"username": "admin", "password": "wrong"})
    assert r.status_code == 401


def test_me_endpoint(client, auth_headers):
    r = client.get("/api/auth/me", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["user_id"] == "admin"
    assert r.json()["role"] == "admin"


def test_protected_route_no_token(client):
    r = client.post("/api/agent/run", json={"input": "test", "mode": "workflow"})
    assert r.status_code == 401


def test_protected_route_invalid_token(client):
    r = client.post(
        "/api/agent/run",
        json={"input": "test", "mode": "workflow"},
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert r.status_code == 401
