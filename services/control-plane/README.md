# Control Plane Service

This service adds the backend stack components you asked for:

- API server: Express endpoints
- Realtime: Socket.io WebSocket server
- Queue: BullMQ + Redis worker
- Agent runtime: local worker-pool runtime adapter (replaceable with Antigravity SDK)
- Vector DB abstraction: Chroma default, pluggable for Pinecone/Weaviate
- Audit + Artifacts: Postgres metadata + S3-compatible object storage (MinIO)
- Secrets: encrypted-at-rest in service memory with provider abstraction (`env`, `vault`, `kms`)

## Run

1. Start infra:

```bash
cd infra
docker compose up -d
```

2. Create MinIO bucket `swarms-artifacts` from MinIO Console (`http://localhost:9001`).

3. Start service:

```bash
cd services/control-plane
cp .env.example .env
npm install
npm run dev
```

Server default URL: `http://localhost:8081`

## Core endpoints

- `GET /health`
- `POST /api/tasks`
- `GET /api/audit/:sessionId`
- `GET /api/artifacts/:sessionId`
- `POST /api/secrets`
- `GET /api/secrets/:key`
- `POST /api/vector/query`

## WebSocket

- Connect with Socket.io client
- Subscribe to a session room: emit `session:subscribe` with `sessionId`
- Receive events on `agent:event`
