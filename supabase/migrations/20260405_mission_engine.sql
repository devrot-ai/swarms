create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz default now()
);

create table if not exists missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  title text not null,
  original_prompt text not null,
  status text not null default 'draft',
  company_mode boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists mission_steps (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references missions(id) on delete cascade,
  agent_key text not null,
  title text not null,
  description text not null,
  status text not null default 'pending',
  step_order int not null,
  input_json jsonb default '{}'::jsonb,
  output_json jsonb default '{}'::jsonb,
  depends_on uuid[] default '{}',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists agent_outputs (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references missions(id) on delete cascade,
  step_id uuid references mission_steps(id) on delete cascade,
  agent_key text not null,
  kind text not null,
  content_md text,
  content_json jsonb default '{}'::jsonb,
  version int default 1,
  created_at timestamptz default now()
);

create table if not exists mission_events (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references missions(id) on delete cascade,
  step_id uuid references mission_steps(id) on delete set null,
  event_type text not null,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists ops_policy (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists agent_memory (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references missions(id) on delete cascade,
  agent_key text not null,
  memory_type text not null,
  content text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_mission_steps_mission_order
  on mission_steps (mission_id, step_order);

create index if not exists idx_agent_outputs_mission_step
  on agent_outputs (mission_id, step_id, created_at desc);

create index if not exists idx_mission_events_mission_created
  on mission_events (mission_id, created_at);
