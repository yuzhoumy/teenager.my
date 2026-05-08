create extension if not exists "pgcrypto";

begin;

-- 1. Ensure new columns exist
alter table public.materials add column if not exists slug text;
alter table public.materials add column if not exists core_type text;
alter table public.materials add column if not exists content_markdown text;
alter table public.materials add column if not exists author_name text;
alter table public.materials add column if not exists has_solution boolean not null default false;

alter table public.pending_materials add column if not exists slug text;
alter table public.pending_materials add column if not exists core_type text;
alter table public.pending_materials add column if not exists content_markdown text;
alter table public.pending_materials add column if not exists author_name text;
alter table public.pending_materials add column if not exists has_solution boolean not null default false;

alter table public.user_forks add column if not exists markdown_content text;
alter table public.user_forks add column if not exists description text;
alter table public.user_forks add column if not exists annotation_layers jsonb;
alter table public.user_forks add column if not exists is_pinned boolean not null default false;
alter table public.user_forks add column if not exists pinned_title text;
alter table public.user_forks add column if not exists pinned_order integer not null default 0;
update public.user_forks set markdown_content = '' where markdown_content is null;
alter table public.user_forks alter column markdown_content set not null;
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

drop policy if exists "Allow public to select forks" on public.user_forks;
drop policy if exists "Allow users to select own forks" on public.user_forks;
create policy "Allow public to select forks" on public.user_forks
  for select
  using (true);
drop policy if exists "Allow users to update own uploaded materials" on public.materials;
create policy "Allow users to update own uploaded materials" on public.materials
  for update
  using (auth.uid() = uploaded_by)
  with check (auth.uid() = uploaded_by);
drop policy if exists "Allow users to delete own uploaded materials" on public.materials;
create policy "Allow users to delete own uploaded materials" on public.materials
  for delete
  using (auth.uid() = uploaded_by);
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
create table if not exists public.material_stars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, material_id)
);
alter table public.material_stars enable row level security;
drop policy if exists "Allow public selects on material stars" on public.material_stars;
create policy "Allow public selects on material stars" on public.material_stars
  for select
  using (true);
drop policy if exists "Allow users to star material once" on public.material_stars;
create policy "Allow users to star material once" on public.material_stars
  for insert
  with check (auth.uid() = user_id);
drop policy if exists "Allow users to remove own material stars" on public.material_stars;
create policy "Allow users to remove own material stars" on public.material_stars
  for delete
  using (auth.uid() = user_id);
create index if not exists idx_material_stars_material_id on public.material_stars (material_id);
create index if not exists idx_material_stars_user_id on public.material_stars (user_id);
create index if not exists idx_user_forks_pinned on public.user_forks (material_id, is_pinned, pinned_order, created_at desc);

-- 2. Drop the restrictive constraint
alter table public.materials drop constraint if exists materials_category_tags_not_empty;
alter table public.pending_materials drop constraint if exists pending_materials_category_tags_not_empty;
alter table public.materials drop constraint if exists materials_category_tags_allowed;
alter table public.pending_materials drop constraint if exists pending_materials_category_tags_allowed;
update public.materials
set category_tags = array_replace(category_tags, 'past-year', 'past-year-paper')
where category_tags @> array['past-year']::text[];
update public.pending_materials
set category_tags = array_replace(category_tags, 'past-year', 'past-year-paper')
where category_tags @> array['past-year']::text[];
alter table public.materials
  add constraint materials_category_tags_allowed check (
    category_tags <@ array['exercise', 'note', 'textbook', 'trial-paper', 'past-year-paper', 'exam-paper']::text[]
  );
alter table public.pending_materials
  add constraint pending_materials_category_tags_allowed check (
    category_tags <@ array['exercise', 'note', 'textbook', 'trial-paper', 'past-year-paper', 'exam-paper']::text[]
  );

-- 3. Dynamic Update (The fix for "column does not exist")
do $$
begin
    -- Only run the update if the metadata column STILL EXISTS
    if exists (select 1 from information_schema.columns where table_name='materials' and column_name='metadata') then
        execute '
            update public.materials m
            set
              core_type = case
                when m.category_tags @> array[''exercise'']::text[] then ''exercise''
                when m.category_tags @> array[''past-year-paper'']::text[] then ''exercise''
                when m.category_tags @> array[''trial-paper'']::text[] then ''exercise''
                when m.category_tags @> array[''exam-paper'']::text[] then ''exercise''
                else ''note''
              end,
              author_name = coalesce((select display_name from public.profiles where user_id = m.uploaded_by), ''Unknown author''),
              content_markdown = trim(both E''\n'' from concat_ws(E''\n\n'',
                nullif(m.metadata ->> ''notes'', ''''),
                case when coalesce(m.file_url, '''') <> '''' then format(''## Attachment%s[Open attachment](%s)'', E''\n'', m.file_url) else null end
              ))
            where m.core_type is null';
    else
        -- Fallback: If metadata is already gone, just set defaults or process what's left
        update public.materials 
        set core_type = 'note', author_name = 'Unknown author', content_markdown = 'Resource content'
        where core_type is null;
    end if;

    -- Repeat similar logic for pending_materials if needed...
end $$;

-- 4. Final Cleanup (Safe to run multiple times)
update public.materials
set slug = lower(trim(both '-' from regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g'))) || '-' || left(id::text, 8)
where slug is null or slug = '';

-- 5. Drop columns only at the very end
alter table public.materials drop column if exists file_url;
alter table public.materials drop column if exists downloads;
alter table public.materials drop column if exists metadata;

commit;
