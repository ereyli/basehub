create table if not exists agent_profiles (
  wallet_address text primary key,
  objective text,
  current_intent text,
  planner_mode text,
  updated_at timestamptz default now()
);

create table if not exists agent_memories (
  id bigint generated always as identity primary key,
  wallet_address text not null,
  memory_type text not null,
  title text,
  body text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists agent_runs (
  id bigint generated always as identity primary key,
  wallet_address text not null,
  status text not null,
  summary text,
  planned_actions int default 0,
  executed_action text,
  created_at timestamptz default now()
);

create table if not exists agent_reflections (
  id bigint generated always as identity primary key,
  wallet_address text not null,
  reflection_type text not null,
  body text,
  score numeric,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists agent_memories_wallet_created_at_idx
  on agent_memories (wallet_address, created_at desc);

create index if not exists agent_runs_wallet_created_at_idx
  on agent_runs (wallet_address, created_at desc);

create index if not exists agent_reflections_wallet_created_at_idx
  on agent_reflections (wallet_address, created_at desc);

alter table agent_profiles enable row level security;
alter table agent_memories enable row level security;
alter table agent_runs enable row level security;
alter table agent_reflections enable row level security;

revoke all on agent_profiles from anon, authenticated;
revoke all on agent_memories from anon, authenticated;
revoke all on agent_runs from anon, authenticated;
revoke all on agent_reflections from anon, authenticated;

drop policy if exists "deny anon profiles" on agent_profiles;
create policy "deny anon profiles"
  on agent_profiles
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "deny anon memories" on agent_memories;
create policy "deny anon memories"
  on agent_memories
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "deny anon runs" on agent_runs;
create policy "deny anon runs"
  on agent_runs
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "deny anon reflections" on agent_reflections;
create policy "deny anon reflections"
  on agent_reflections
  for all
  to anon, authenticated
  using (false)
  with check (false);
