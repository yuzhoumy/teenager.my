create table if not exists public.profile_reports (
  id uuid primary key default gen_random_uuid(),
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 10 and 1000),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  constraint profile_reports_no_self_report check (reporter_id <> reported_user_id)
);

alter table public.profile_reports enable row level security;

drop policy if exists "Allow users to report profiles as themselves" on public.profile_reports;
create policy "Allow users to report profiles as themselves" on public.profile_reports
  for insert
  with check (
    auth.role() = 'authenticated'
    and auth.uid() = reporter_id
    and reporter_id <> reported_user_id
  );

create index if not exists idx_profile_reports_reported_user_id on public.profile_reports (reported_user_id, created_at desc);
create index if not exists idx_profile_reports_reporter_id on public.profile_reports (reporter_id, created_at desc);
