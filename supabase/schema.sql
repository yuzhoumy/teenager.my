create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  form integer not null check (form between 1 and 5),
  avatar_url text,
  streak_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles drop column if exists school;
alter table public.profiles add column if not exists id uuid;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists form integer;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists streak_count integer not null default 0;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles drop constraint if exists profiles_id_fkey;
update public.profiles set id = gen_random_uuid() where id is null;
update public.profiles set display_name = 'Student' where display_name is null or trim(display_name) = '';
update public.profiles set form = '1' where form is null;
alter table public.profiles
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column user_id set not null,
  alter column created_at set default now(),
  alter column streak_count set default 0,
  alter column display_name set not null,
  drop constraint if exists profiles_form_check,
  alter column form drop default,
  alter column form type integer using (
    case
      when coalesce(form::text, '') ~ '^[1-5]$' then form::integer
      else 1
    end
  ),
  alter column form set not null,
  add constraint profiles_form_check check (form between 1 and 5);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_user_id_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_user_id_key'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_user_id_key unique (user_id);
  end if;
end $$;

alter table public.profiles enable row level security;

drop policy if exists "Allow public selects on profiles" on public.profiles;
create policy "Allow public selects on profiles" on public.profiles
  for select
  using (true);

drop policy if exists "Allow users to insert own profile" on public.profiles;
create policy "Allow users to insert own profile" on public.profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Allow users to update own profile" on public.profiles;
create policy "Allow users to update own profile" on public.profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name, form, avatar_url)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'Student'),
    case
      when coalesce(new.raw_user_meta_data ->> 'form', '') ~ '^[1-5]$'
        then (new.raw_user_meta_data ->> 'form')::integer
      else 1
    end,
    nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), '')
  )
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        form = excluded.form,
        avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url);

  return new;
end;
$$;

drop trigger if exists create_profile_after_auth_signup on auth.users;
create trigger create_profile_after_auth_signup
  after insert on auth.users
  for each row execute function public.create_profile_for_auth_user();

update public.profiles as profiles
set display_name = coalesce(nullif(trim(users.raw_user_meta_data ->> 'display_name'), ''), profiles.display_name),
    form = case
      when coalesce(users.raw_user_meta_data ->> 'form', '') ~ '^[1-5]$'
        then (users.raw_user_meta_data ->> 'form')::integer
      else profiles.form
    end,
    avatar_url = coalesce(nullif(trim(users.raw_user_meta_data ->> 'avatar_url'), ''), profiles.avatar_url)
from auth.users as users
where profiles.user_id = users.id
  and (
    nullif(trim(users.raw_user_meta_data ->> 'display_name'), '') is not null
    or coalesce(users.raw_user_meta_data ->> 'form', '') ~ '^[1-5]$'
    or nullif(trim(users.raw_user_meta_data ->> 'avatar_url'), '') is not null
  );

insert into public.profiles (user_id, display_name, form, avatar_url)
select
  users.id,
  coalesce(nullif(trim(users.raw_user_meta_data ->> 'display_name'), ''), split_part(users.email, '@', 1), 'Student'),
  case
    when coalesce(users.raw_user_meta_data ->> 'form', '') ~ '^[1-5]$'
      then (users.raw_user_meta_data ->> 'form')::integer
    else 1
  end,
  nullif(trim(users.raw_user_meta_data ->> 'avatar_url'), '')
from auth.users
on conflict (user_id) do nothing;

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  core_type text not null check (core_type in ('exercise', 'note')),
  content_markdown text not null,
  grade text not null check (grade in ('f1', 'f2', 'f3', 'f4', 'f5')),
  subject text not null,
  category_tags text[] not null default '{}',
  year integer not null check (year between 2000 and 2100),
  origin text not null,
  author_name text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint materials_category_tags_allowed check (
    category_tags <@ array['past-year', 'trial-paper']::text[]
  )
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

create table if not exists public.user_forks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  source_url text not null,
  description text,
  markdown_content text not null,
  annotation_layers jsonb,
  is_pinned boolean not null default false,
  pinned_title text,
  pinned_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, material_id, source_url)
);

alter table public.user_forks enable row level security;

drop policy if exists "Allow public to select forks" on public.user_forks;
drop policy if exists "Allow users to select own forks" on public.user_forks;
create policy "Allow public to select forks" on public.user_forks
  for select
  using (true);

drop policy if exists "Allow users to insert own forks" on public.user_forks;
create policy "Allow users to insert own forks" on public.user_forks
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Allow users to update own forks" on public.user_forks;
create policy "Allow users to update own forks" on public.user_forks
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.fork_stars (
  id uuid primary key default gen_random_uuid(),
  fork_id uuid not null references public.user_forks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (fork_id, user_id)
);

alter table public.fork_stars enable row level security;

drop policy if exists "Allow public selects on fork stars" on public.fork_stars;
create policy "Allow public selects on fork stars" on public.fork_stars
  for select
  using (true);

drop policy if exists "Allow users to star once" on public.fork_stars;
create policy "Allow users to star once" on public.fork_stars
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Allow users to remove own fork stars" on public.fork_stars;
create policy "Allow users to remove own fork stars" on public.fork_stars
  for delete
  using (auth.uid() = user_id);

create table if not exists public.annotations (
  id uuid primary key default gen_random_uuid(),
  fork_id uuid not null references public.user_forks(id) on delete cascade,
  page_number integer not null check (page_number > 0),
  bounding_rect jsonb not null,
  comment text not null,
  quote text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.annotations enable row level security;

drop policy if exists "Allow fork owners to view annotations" on public.annotations;
create policy "Allow fork owners to view annotations" on public.annotations
  for select
  using (
    exists (
      select 1
      from public.user_forks
      where public.user_forks.id = annotations.fork_id
        and public.user_forks.user_id = auth.uid()
    )
  );

drop policy if exists "Allow fork owners to insert annotations" on public.annotations;
create policy "Allow fork owners to insert annotations" on public.annotations
  for insert
  with check (
    auth.uid() = created_by
    and exists (
      select 1
      from public.user_forks
      where public.user_forks.id = annotations.fork_id
        and public.user_forks.user_id = auth.uid()
    )
  );

create table if not exists public.material_discussions (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.material_discussions enable row level security;

drop policy if exists "Allow public selects on material discussions" on public.material_discussions;
create policy "Allow public selects on material discussions" on public.material_discussions
  for select
  using (true);

drop policy if exists "Allow authenticated inserts on material discussions" on public.material_discussions;
create policy "Allow authenticated inserts on material discussions" on public.material_discussions
  for insert
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

create table if not exists public.pending_materials (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  core_type text not null check (core_type in ('exercise', 'note')),
  content_markdown text not null,
  grade text not null check (grade in ('f1', 'f2', 'f3', 'f4', 'f5')),
  subject text not null,
  category_tags text[] not null default '{}',
  year integer not null check (year between 2000 and 2100),
  origin text not null,
  author_name text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint pending_materials_category_tags_allowed check (
    category_tags <@ array['past-year', 'trial-paper']::text[]
  )
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
create index if not exists idx_materials_core_type on public.materials (core_type);
create index if not exists idx_materials_subject on public.materials (subject);
create index if not exists idx_materials_origin on public.materials (origin);
create index if not exists idx_materials_year on public.materials (year desc);
create index if not exists idx_materials_created_at on public.materials (created_at desc);
create index if not exists idx_materials_slug on public.materials (slug);
create index if not exists idx_materials_category_tags on public.materials using gin (category_tags);
create index if not exists idx_user_forks_material_id on public.user_forks (material_id);
create index if not exists idx_user_forks_user_id on public.user_forks (user_id);
create index if not exists idx_user_forks_pinned on public.user_forks (material_id, is_pinned, pinned_order, created_at desc);
create index if not exists idx_fork_stars_fork_id on public.fork_stars (fork_id);
create index if not exists idx_fork_stars_user_id on public.fork_stars (user_id);
create index if not exists idx_annotations_fork_id on public.annotations (fork_id);
create index if not exists idx_material_discussions_material_id on public.material_discussions (material_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'resource-attachments') THEN
    PERFORM storage.create_bucket('resource-attachments', true);
  END IF;
END$$;
