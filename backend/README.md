# Swarms Agentic Backend

A working FastAPI backend for an autonomous enterprise workflow system.

## Features
- Proposal -> auto-approve -> mission -> steps -> events -> triggers
- Persistent state with SQLAlchemy
- Optional OpenAI planner
- Streaming SSE endpoint
- Policy-driven approvals
- Stale mission recovery

## Run

```bash
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Core endpoints

* `POST /api/agent/run`
* `POST /api/agent/stream`
* `POST /api/proposals`
* `POST /api/proposals/{proposal_id}/approve`
* `POST /api/missions/{mission_id}/execute`
* `POST /api/events/ingest`
* `PATCH /api/policies/{key}`
* `GET /api/state`
* `POST /api/workers/recover-stale`

## Frontend contract

Send JSON like:

```json
{
  "user_id": "123",
  "input": "Create a customer support follow up workflow",
  "mode": "workflow",
  "stream": true
}
```
