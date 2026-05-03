create extension if not exists "pgcrypto";

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

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_url text not null,
  grade text not null check (grade in ('f1', 'f2', 'f3', 'f4', 'f5')),
  subject text not null,
  category_tags text[] not null default '{}',
  year integer not null check (year between 2000 and 2100),
  origin text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  downloads integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  constraint materials_category_tags_not_empty check (cardinality(category_tags) > 0)
);

alter table public.materials enable row level security;

drop policy if exists "Allow public selects on materials" on public.materials;
create policy "Allow public selects on materials" on public.materials
  for select
  using (true);

create table if not exists public.material_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, material_id)
);

alter table public.material_bookmarks enable row level security;

drop policy if exists "Allow users to select own material bookmarks" on public.material_bookmarks;
create policy "Allow users to select own material bookmarks" on public.material_bookmarks
  for select
  using (auth.uid() = user_id);

drop policy if exists "Allow users to insert own material bookmarks" on public.material_bookmarks;
create policy "Allow users to insert own material bookmarks" on public.material_bookmarks
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Allow users to delete own material bookmarks" on public.material_bookmarks;
create policy "Allow users to delete own material bookmarks" on public.material_bookmarks
  for delete
  using (auth.uid() = user_id);

create table if not exists public.pending_materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_url text not null,
  grade text not null check (grade in ('f1', 'f2', 'f3', 'f4', 'f5')),
  subject text not null,
  category_tags text[] not null default '{}',
  year integer not null check (year between 2000 and 2100),
  origin text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  downloads integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  constraint pending_materials_category_tags_not_empty check (cardinality(category_tags) > 0)
);

alter table public.pending_materials enable row level security;

drop policy if exists "Allow authenticated inserts on pending_materials" on public.pending_materials;
create policy "Allow authenticated inserts on pending_materials" on public.pending_materials
  for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Allow authenticated selects on pending_materials" on public.pending_materials;
create policy "Allow authenticated selects on pending_materials" on public.pending_materials
  for select
  using (auth.role() = 'authenticated');

create index if not exists idx_materials_grade on public.materials (grade);
create index if not exists idx_materials_subject on public.materials (subject);
create index if not exists idx_materials_origin on public.materials (origin);
create index if not exists idx_materials_year on public.materials (year desc);
create index if not exists idx_materials_created_at on public.materials (created_at desc);
create index if not exists idx_materials_category_tags on public.materials using gin (category_tags);
create index if not exists idx_materials_metadata on public.materials using gin (metadata);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'resource-attachments') THEN
    PERFORM storage.create_bucket('resource-attachments', true);
  END IF;
END$$;
