create table if not exists agent_cloud_sessions (
  id bigint generated always as identity primary key,
  owner_address text not null unique,
  sub_account_address text not null,
  spender_address text,
  status text not null default 'ready',
  spend_permission jsonb not null default '{}'::jsonb,
  allowance_eth text,
  period_days int default 1,
  policy jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint agent_cloud_sessions_owner_format
    check (owner_address ~* '^0x[a-f0-9]{40}$'),
  constraint agent_cloud_sessions_sub_account_format
    check (sub_account_address ~* '^0x[a-f0-9]{40}$'),
  constraint agent_cloud_sessions_spender_format
    check (spender_address is null or spender_address ~* '^0x[a-f0-9]{40}$')
);

create index if not exists agent_cloud_sessions_status_updated_idx
  on agent_cloud_sessions (status, updated_at desc);

alter table agent_cloud_sessions enable row level security;

revoke all on agent_cloud_sessions from anon, authenticated;

drop policy if exists "deny anon cloud sessions" on agent_cloud_sessions;
create policy "deny anon cloud sessions"
  on agent_cloud_sessions
  for all
  to anon, authenticated
  using (false)
  with check (false);

