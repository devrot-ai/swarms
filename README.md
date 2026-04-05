# SWARMS

Frontend experience and mission backend for a multi-agent company simulator.

## Mission Backend (MVP)

This repository now includes a Supabase-backed deterministic mission engine with:

- Mission creation and planning
- Step orchestration with dependencies
- Agent outputs stored in database
- Event timeline logging
- Retry endpoint for failed/review steps
- Mission workspace page for live inspection

## Environment

Create .env.local with:

NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

OPENAI_API_KEY=optional
GEMINI_API_KEY=optional
OLLAMA_BASE_URL=http://127.0.0.1:11434
WORKER_SECRET=optional

## Database

Run migration:

- supabase/migrations/20260405_mission_engine.sql

## API

- POST /api/mission/create
- POST /api/mission/[id]/run
- GET /api/mission/[id]
- GET /api/mission/[id]/steps
- POST /api/mission/[id]/steps
- GET /api/mission/[id]/events
- POST /api/mission/[id]/step/[stepId]/retry

Worker trigger webhook:

- POST /api/webhook/worker

## Workspace

Open mission workspace:

- /mission/[id]

Create and launch mission from UI:

- /mission

