create table if not exists agent_cloud_runs (
  id bigint generated always as identity primary key,
  owner_address text not null,
  sub_account_address text not null,
  status text not null default 'active',
  current_plan jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  logs jsonb not null default '[]'::jsonb,
  spend_permission jsonb not null default '{}'::jsonb,
  sub_account jsonb not null default '{}'::jsonb,
  interval_minutes int not null default 4,
  next_run_at timestamptz not null default now(),
  locked_until timestamptz,
  lock_id text,
  last_error text,
  started_at timestamptz default now(),
  stopped_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint agent_cloud_runs_owner_format
    check (owner_address ~ '^0x[a-fA-F0-9]{40}$'),
  constraint agent_cloud_runs_sub_account_format
    check (sub_account_address ~ '^0x[a-fA-F0-9]{40}$')
);

create index if not exists agent_cloud_runs_status_next_run_idx
  on agent_cloud_runs (status, next_run_at asc);

create index if not exists agent_cloud_runs_owner_created_idx
  on agent_cloud_runs (owner_address, created_at desc);

alter table agent_cloud_runs enable row level security;

revoke all on agent_cloud_runs from anon, authenticated;

drop policy if exists "deny anon cloud runs" on agent_cloud_runs;
create policy "deny anon cloud runs"
  on agent_cloud_runs
  for all
  to anon, authenticated
  using (false)
  with check (false);
