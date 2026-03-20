"""Agent run and streaming tests."""


def test_agent_run_full_loop(client, auth_headers):
    r = client.post(
        "/api/agent/run",
        json={"input": "Create a customer support workflow", "mode": "workflow"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["approved"] is True
    assert data["status"] in ("done", "done_with_issues", "escalated")
    assert data["proposal_id"].startswith("prop_")
    assert data["mission_id"].startswith("miss_")
    assert len(data["steps"]) > 0
    assert data["response"]


def test_agent_run_email_workflow(client, auth_headers):
    r = client.post(
        "/api/agent/run",
        json={"input": "Send a follow up email to the client", "mode": "workflow"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    tools_used = [s["tool"] for s in data["steps"]]
    assert "draft_message" in tools_used


def test_agent_run_report_workflow(client, auth_headers):
    r = client.post(
        "/api/agent/run",
        json={"input": "Generate a quarterly analysis report", "mode": "workflow"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    tools_used = [s["tool"] for s in data["steps"]]
    assert "analyze" in tools_used


def test_agent_stream(client, auth_headers):
    r = client.post(
        "/api/agent/stream",
        json={"input": "Create a support workflow", "mode": "workflow"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert "text/event-stream" in r.headers["content-type"]
    # Check we get multiple SSE events
    lines = r.text.strip().split("\n")
    data_lines = [l for l in lines if l.startswith("data: ")]
    assert len(data_lines) >= 4  # proposal, approval, mission, done at minimum


def test_state_after_run(client, auth_headers):
    r = client.post(
        "/api/agent/run",
        json={"input": "test workflow", "mode": "workflow"},
        headers=auth_headers,
    )
    data = r.json()
    proposal_id = data["proposal_id"]

    r2 = client.get(f"/api/state?proposal_id={proposal_id}", headers=auth_headers)
    assert r2.status_code == 200
    state = r2.json()
    assert state["proposal"] is not None
    assert state["mission"] is not None
    assert len(state["steps"]) > 0
