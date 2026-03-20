"""Tool manifest and schema validation tests."""
import json


def test_tools_manifest(client):
    r = client.get("/api/tools")
    assert r.status_code == 200
    tools = r.json()
    assert isinstance(tools, list)
    assert len(tools) >= 7
    names = [t["name"] for t in tools]
    assert "retrieve_context" in names
    assert "approval_gate" in names
    # Each tool should have an input schema
    for tool in tools:
        assert "input_schema" in tool
        assert "description" in tool


def test_tool_schema_has_properties(client):
    r = client.get("/api/tools")
    tools = r.json()
    for tool in tools:
        schema = tool["input_schema"]
        assert "properties" in schema or "type" in schema
