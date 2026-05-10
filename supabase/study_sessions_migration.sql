create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  title text not null default 'Study session',
  description text,
  subject text,
  location_name text not null,
  address text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  max_participants integer not null default 8 check (max_participants between 1 and 200),
  starts_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.study_sessions add column if not exists address text;
alter table public.study_sessions add column if not exists max_participants integer not null default 8;

alter table public.study_sessions enable row level security;

drop policy if exists "Allow public selects on study sessions" on public.study_sessions;
create policy "Allow public selects on study sessions" on public.study_sessions
  for select
  using (true);

drop policy if exists "Allow users to insert own study sessions" on public.study_sessions;
create policy "Allow users to insert own study sessions" on public.study_sessions
  for insert
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

drop policy if exists "Allow users to update own study sessions" on public.study_sessions;
create policy "Allow users to update own study sessions" on public.study_sessions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Allow users to delete own study sessions" on public.study_sessions;
create policy "Allow users to delete own study sessions" on public.study_sessions
  for delete
  using (auth.uid() = user_id);

create table if not exists public.study_session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.study_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (session_id, user_id)
);

alter table public.study_session_participants enable row level security;

drop policy if exists "Allow public selects on study session participants" on public.study_session_participants;
create policy "Allow public selects on study session participants" on public.study_session_participants
  for select
  using (true);

drop policy if exists "Allow users to join study sessions" on public.study_session_participants;
create policy "Allow users to join study sessions" on public.study_session_participants
  for insert
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

drop policy if exists "Allow users to leave study sessions" on public.study_session_participants;
create policy "Allow users to leave study sessions" on public.study_session_participants
  for delete
  using (auth.uid() = user_id);

create or replace function public.enforce_study_session_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  participant_limit integer;
  participant_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(new.session_id::text));

  select max_participants
  into participant_limit
  from public.study_sessions
  where id = new.session_id;

  if participant_limit is null then
    raise exception 'Study session not found.';
  end if;

  select count(*)
  into participant_count
  from public.study_session_participants
  where session_id = new.session_id;

  if participant_count >= participant_limit then
    raise exception 'Study session is full.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_study_session_capacity_before_join on public.study_session_participants;
create trigger enforce_study_session_capacity_before_join
  before insert on public.study_session_participants
  for each row execute function public.enforce_study_session_capacity();

create table if not exists public.study_session_comments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.study_sessions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.study_session_comments enable row level security;

drop policy if exists "Allow public selects on study session comments" on public.study_session_comments;
create policy "Allow public selects on study session comments" on public.study_session_comments
  for select
  using (true);

drop policy if exists "Allow authenticated inserts on study session comments" on public.study_session_comments;
create policy "Allow authenticated inserts on study session comments" on public.study_session_comments
  for insert
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

create index if not exists idx_study_sessions_lat_lng on public.study_sessions (lat, lng);
create index if not exists idx_study_sessions_created_at on public.study_sessions (created_at desc);
create index if not exists idx_study_session_participants_session_id on public.study_session_participants (session_id);
create index if not exists idx_study_session_participants_user_id on public.study_session_participants (user_id);
create index if not exists idx_study_session_comments_session_id on public.study_session_comments (session_id, created_at asc);
