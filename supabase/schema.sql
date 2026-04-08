create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'resource_category') then
    create type resource_category as enum ('trial_paper', 'past_year_paper', 'notes');
  end if;
end$$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  school text not null,
  form integer not null check (form between 1 and 5),
  avatar_url text,
  streak_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  category resource_category not null,
  form_level integer not null check (form_level between 1 and 5),
  year integer not null check (year between 2000 and 2100),
  file_url text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  downloads integer not null default 0
);

create table if not exists public.resource_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, resource_id)
);
