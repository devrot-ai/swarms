This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Mission Control API

This project now includes a Mission Control orchestration backend for multi-tenant agent swarms.

### 1) Start Mission Session

- Endpoint: `POST /api/mission-control/session`
- Purpose: Converts project input into mission plan, creates agents + queues, stores plan artifact, emits initial thought events.

Example payload:

```json
{
  "mission": {
    "projectName": "Customer Support Copilot",
    "objective": "Reduce ticket resolution time with agentic automation",
    "timeline": {
      "startDate": "2026-02-28",
      "targetDate": "2026-03-14",
      "milestones": ["Intake", "Prototype", "Validation", "Launch"]
    },
    "requiredDepartments": [
      "Program Management",
      "Security & Compliance",
      "Agent Runtime",
      "Data & Audit"
    ],
    "kpis": [
      { "name": "Ticket SLA", "target": "< 4h" },
      { "name": "Automation Rate", "target": ">= 40%" }
    ],
    "computeBudget": {
      "tokenLimitTotal": 250000,
      "maxTokensPerTask": 8000,
      "costGuardrailUsd": 20
    },
    "uncertainty": 0.35
  },
  "userModelOverride": {
    "provider": "openai",
    "model": "gpt-5.3-codex",
    "apiKey": "sk-..."
  }
}
```

### 2) Stream Realtime Thought Events

- Endpoint: `GET /api/mission-control/events/:sessionId`
- Protocol: Server-Sent Events (SSE)
- Includes explicit timestamp, confidence, uncertainty, and status per event.

### 3) Record Human Approval

- Endpoint: `POST /api/mission-control/approval`
- Required before destructive or external actions can execute.

### 4) Execute Action with Permission Gate

- Endpoint: `POST /api/mission-control/action`
- Sensitive actions are blocked until approved and recorded in audit.

### 5) Verification Stores

- Artifacts: `GET /api/mission-control/artifacts/:sessionId`
- Audit log: `GET /api/mission-control/audit/:sessionId`

### 6) CEO-Agent Planning

- Endpoint: `POST /api/mission-control/ceo`
- Purpose: Generates CEO-level mission statement, KPIs, token budget, and departmental work breakdown with approve/reject/escalate decisions.

Example payload:

```json
{
  "userBrief": "Launch a secure multi-tenant mission control for enterprise teams with approval gates and real-time events.",
  "companyMemory": "Past launches missed KPI specificity and had weak escalation ownership.",
  "riskPolicy": "High risk: require strict approvals for external and destructive actions."
}
```

Response format:

```json
{
  "mission": "...",
  "KPIs": [{ "name": "...", "target": "..." }],
  "budget_tokens": {
    "total": 900000,
    "max_per_task": 10000,
    "review_reserve": 220000,
    "compute_profile": {
      "max_parallel_agents": 10,
      "expected_monthly_calls": 3200
    }
  },
  "departments": [
    {
      "name": "Program Management",
      "tasks_estimate": {
        "priority": "P0",
        "count": 5,
        "plan_status": "APPROVED"
      }
    }
  ]
}
```

### 7) COO-Agent Task Decomposition

- Endpoint: `POST /api/mission-control/coo`
- Purpose: Decompose mission into ordered tasks, assign departments/workers, set deadlines, attach skills (`scrape`, `codegen`, `design`, `deploy`), and emit `task.created` events to internal task queue.

Example payload:

```json
{
  "mission": "Ship a secure multi-tenant orchestration platform with realtime events and approval gates.",
  "sessionId": "sess_demo_01",
  "startDateUtc": "2026-02-28T00:00:00.000Z",
  "timelineDays": 10
}
```

Response format:

```json
[
  {
    "id": "task_xxxx",
    "sessionId": "sess_demo_01",
    "title": "Mission decomposition and acceptance criteria",
    "order": 1,
    "priority": "P0",
    "estimatedRuntimeMin": 45,
    "deadlineUtc": "2026-03-01T00:00:00.000Z",
    "department": "Program Management",
    "assignedAgentId": "wrk_codegen_01",
    "requiredSkills": ["codegen"],
    "status": "PENDING",
    "blockedIterations": 0
  }
]
```

### 8) Marketing-Dept-Agent Campaign Builder

- Endpoint: `POST /api/mission-control/marketing`
- Purpose: Produces a 3-step campaign plan, one sample deliverable, one validation test, research citations with raw snapshots as artifacts, and reasoning trace items.

Example payload:

```json
{
  "brief": "Launch mission-control product narrative for enterprise AI teams.",
  "sessionId": "sess_marketing_01",
  "researchUrls": ["https://nextjs.org/docs", "https://openai.com"],
  "companyMemory": [
    "Last campaign underperformed due to vague CTA.",
    "Technical credibility messaging improved engagement."
  ]
}
```

Response includes:

- `campaignPlan` (exactly 3 ordered steps)
- `sampleDeliverable` (channel-ready content)
- `validationTest` (name/method/pass criteria)
- `citations` with `snapshotArtifactId`
- `reasoningTrace` (timestamped thought items)
- `handoff` artifact IDs for Engineering/Publishing

### 9) Worker-Agent-[TYPE] Single Task Runner

- Endpoint: `POST /api/mission-control/worker`
- Purpose: Execute one constrained task with strict `allowed_tool_uris` policy. External side effects are dry-run by default.

Example payload:

```json
{
  "workerType": "scrape",
  "task": "Collect top 5 product pricing signals from approved sources.",
  "allowed_tool_uris": ["web_browser://read", "vector_search://company_memory"],
  "requestedTools": ["web_browser://read", "web_browser://write"]
}
```

Response contains:

- `plan`
- `stepByStepExecutionTrace`
- `finalArtifactUrl`

### Security Notes

- BYOK keys are validated and encrypted immediately.
- Plaintext API keys are never persisted.
- If mission uncertainty exceeds 40%, a review subtask is spawned and status is set to `REVIEW`.

## Distributed Control Plane Stack

This repo now also includes a separate backend control-plane scaffold at `services/control-plane` that covers the full component list:

- Frontend: Next.js app (`/`) with workspace + realtime client-ready flow.
- API Server: Express service with REST + WebSocket support.
- Agent Runtime: pluggable worker runtime (default local pool, replaceable with Antigravity SDK).
- Queue: BullMQ on Redis.
- Realtime: Socket.io event server.
- Vector DB: provider abstraction with Chroma default; Pinecone/Weaviate pluggable.
- Audit & Artifacts: Postgres metadata + S3-compatible object storage (MinIO).
- Secrets: encrypted-at-rest store with provider abstraction (`env`, `vault`, `kms`).

### Start Infra Services

```bash
cd infra
docker compose up -d
```

Infra endpoints:

- Redis: `localhost:6379`
- Postgres: `localhost:5432`
- MinIO API: `localhost:9000`
- MinIO Console: `localhost:9001`
- Chroma: `localhost:8000`

### Start Control Plane Service

```bash
cd services/control-plane
cp .env.example .env
npm install
npm run dev
```

Control plane runs on `http://localhost:8081` by default.

Core endpoints:

- `GET /health`
- `POST /api/tasks`
- `GET /api/audit/:sessionId`
- `GET /api/artifacts/:sessionId`
- `POST /api/secrets`
- `GET /api/secrets/:key`
- `POST /api/vector/query`
