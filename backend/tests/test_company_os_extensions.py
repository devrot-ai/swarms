"""Tests for AI company OS extensions: user keys and dynamic agents."""


def test_user_key_lifecycle(client, auth_headers):
    upsert = client.post(
        "/api/users/me/keys",
        json={"provider": "openai", "api_key": "sk-test-123"},
        headers=auth_headers,
    )
    assert upsert.status_code == 200
    assert upsert.json()["ok"] is True

    listed = client.get("/api/users/me/keys", headers=auth_headers)
    assert listed.status_code == 200
    assert "openai" in listed.json()["providers"]

    deleted = client.request(
        "DELETE",
        "/api/users/me/keys",
        json={"provider": "openai"},
        headers=auth_headers,
    )
    assert deleted.status_code == 200
    assert deleted.json()["ok"] is True


def test_dynamic_agent_creation_and_listing(client, auth_headers):
    created = client.post(
        "/api/agents",
        json={
            "name": "Test Agent",
            "role": "qa",
            "skills": ["testing", "validation"],
            "model": "gpt-4.1-mini",
            "memory_scope": "project",
        },
        headers=auth_headers,
    )
    assert created.status_code == 200
    data = created.json()
    assert data["name"] == "Test Agent"
    assert data["role"] == "qa"
    assert "testing" in data["skills"]

    listed = client.get("/api/agents", headers=auth_headers)
    assert listed.status_code == 200
    names = [item["name"] for item in listed.json()]
    assert "Test Agent" in names
