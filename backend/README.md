# Swarms Agentic Backend

An enterprise-grade FastAPI backend for an autonomous workflow system with Planner → Executor → Critic agent architecture.

## Features
- **Agent loop**: Proposal → auto-approve → mission → plan → execute → validate → finalize
- **Real-time streaming**: SSE endpoint emits per-step progress events
- **Tool schema validation**: Pydantic input models + JSON-Schema manifest endpoint
- **JWT authentication**: Bearer-token auth on all protected routes
- **Critic validation**: Rule-based + LLM quality checks on mission outcomes
- **Structured errors**: Proper HTTP status codes, error codes, request-ID tracing
- **Policy engine**: Runtime-configurable approval and worker policies
- **Stale recovery**: Auto-recover hung missions

## Quick Start

```bash
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Visit [http://localhost:8000/docs](http://localhost:8000/docs) for interactive Swagger docs.

## Authentication

Get a JWT token first:

```bash
curl -X POST http://localhost:8000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin"}'
```

Then use the token in all requests:

```bash
curl -X POST http://localhost:8000/api/agent/run \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"input": "Create a customer support workflow", "mode": "workflow"}'
```

## Core Endpoints

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/tools` | Tool manifest with JSON schemas |
| POST | `/api/auth/token` | Get JWT token |

### Protected (requires `Authorization: Bearer <token>`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/agent/run` | Run full agent loop |
| POST | `/api/agent/stream` | Run with real-time SSE events |
| POST | `/api/proposals` | Create a proposal |
| POST | `/api/proposals/{id}/approve` | Approve a proposal |
| POST | `/api/missions/{id}/execute` | Execute a mission |
| POST | `/api/events/ingest` | Ingest an event |
| PATCH | `/api/policies/{key}` | Update a policy |
| GET | `/api/state` | Get state snapshot |
| POST | `/api/workers/recover-stale` | Recover stale missions |
| GET | `/api/auth/me` | Current user info |

## SSE Stream Events

The `/api/agent/stream` endpoint emits these SSE events in order:

1. `proposal_created` — proposal ID and prompt
2. `approval` — approval status
3. `mission_created` — mission ID, title, plan
4. `step_started` — step number, tool, input
5. `step_completed` / `step_failed` — step result
6. `critic_verdict` — pass / retry / escalate
7. `mission_done` — final response and status

## Frontend Contract

```json
{
  "user_id": "123",
  "input": "Create a customer support follow up workflow",
  "mode": "workflow",
  "stream": true
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./swarms.db` | Database connection URL |
| `OPENAI_API_KEY` | — | OpenAI API key (optional) |
| `OPENAI_MODEL` | `gpt-5.4` | OpenAI model to use |
| `ENABLE_LLM` | `false` | Enable LLM planner/critic |
| `AUTO_APPROVE` | `true` | Auto-approve proposals |
| `WORKER_POLICY` | `allow_all` | Worker policy |
| `JWT_SECRET` | `change-me-in-production` | JWT signing secret |
| `JWT_ALGORITHM` | `HS256` | JWT algorithm |
| `JWT_EXPIRE_MINUTES` | `60` | Token expiry in minutes |

## Architecture

```
Request → Auth (JWT) → Routes → Orchestrator
                                    ├── Planner (LLM or keyword)
                                    ├── Executor (tools + retry)
                                    └── Critic (validation)
```

## Running Tests

```bash
cd backend
pytest tests/ -v
```
