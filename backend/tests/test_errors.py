"""Error handling tests: proper HTTP status codes and structured error responses."""


def test_approve_nonexistent_proposal(client, auth_headers):
    r = client.post("/api/proposals/nonexistent/approve", headers=auth_headers)
    assert r.status_code == 404
    data = r.json()
    assert data["error"]["code"] == "not_found"
    assert "request_id" in data["error"]


def test_execute_nonexistent_mission(client, auth_headers):
    r = client.post("/api/missions/nonexistent/execute", headers=auth_headers)
    assert r.status_code == 404
    data = r.json()
    assert data["error"]["code"] == "not_found"


def test_request_id_header(client):
    r = client.get("/api/health")
    assert "x-request-id" in r.headers
