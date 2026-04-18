-- Base App toplu bildirim geçmişi (/admin); yalnızca service role API ile yazar/okur.
-- Uygula: Supabase SQL Editor veya supabase db push

create table if not exists public.admin_notification_broadcasts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  message text not null,
  target_path text not null default '/',
  total_unique_wallets int,
  counts_by_url jsonb,
  app_urls jsonb,
  results jsonb
);

create index if not exists idx_admin_notification_broadcasts_created
  on public.admin_notification_broadcasts (created_at desc);

comment on table public.admin_notification_broadcasts is 'Admin panelinden gönderilen Base App push bildirimleri; api/admin-notifications.js service role ile insert/select.';

alter table public.admin_notification_broadcasts enable row level security;
