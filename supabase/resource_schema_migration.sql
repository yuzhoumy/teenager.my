begin;

alter table public.materials add column if not exists slug text;
alter table public.materials add column if not exists core_type text;
alter table public.materials add column if not exists content_markdown text;
alter table public.materials add column if not exists author_name text;

alter table public.pending_materials add column if not exists slug text;
alter table public.pending_materials add column if not exists core_type text;
alter table public.pending_materials add column if not exists content_markdown text;
alter table public.pending_materials add column if not exists author_name text;

update public.materials m
set
  core_type = case
    when m.category_tags @> array['exercise']::text[] then 'exercise'
    when m.category_tags @> array['past-year']::text[] then 'exercise'
    when m.category_tags @> array['trial-paper']::text[] then 'exercise'
    else 'note'
  end,
  author_name = coalesce(p.display_name, 'Unknown author'),
  content_markdown = trim(
    both E'\n' from concat_ws(
      E'\n\n',
      nullif(m.metadata ->> 'notes', ''),
      case
        when coalesce(m.file_url, '') <> '' then format('## Attachment%s[Open attachment](%s)', E'\n', m.file_url)
        else null
      end
    )
  )
from public.profiles p
where m.uploaded_by = p.user_id
  and (m.core_type is null or m.author_name is null or m.content_markdown is null);

update public.materials
set
  core_type = coalesce(core_type, case
    when category_tags @> array['past-year']::text[] then 'exercise'
    when category_tags @> array['trial-paper']::text[] then 'exercise'
    else 'note'
  end),
  author_name = coalesce(nullif(author_name, ''), 'Unknown author'),
  content_markdown = coalesce(
    nullif(content_markdown, ''),
    case
      when coalesce(file_url, '') <> '' then format('## Attachment%s[Open attachment](%s)', E'\n', file_url)
      else 'Resource content coming soon.'
    end
  );

update public.pending_materials pm
set
  core_type = case
    when pm.category_tags @> array['exercise']::text[] then 'exercise'
    when pm.category_tags @> array['past-year']::text[] then 'exercise'
    when pm.category_tags @> array['trial-paper']::text[] then 'exercise'
    else 'note'
  end,
  author_name = coalesce(p.display_name, 'Unknown author'),
  content_markdown = trim(
    both E'\n' from concat_ws(
      E'\n\n',
      nullif(pm.metadata ->> 'notes', ''),
      case
        when coalesce(pm.file_url, '') <> '' then format('## Attachment%s[Open attachment](%s)', E'\n', pm.file_url)
        else null
      end
    )
  )
from public.profiles p
where pm.uploaded_by = p.user_id
  and (pm.core_type is null or pm.author_name is null or pm.content_markdown is null);

update public.pending_materials
set
  core_type = coalesce(core_type, case
    when category_tags @> array['past-year']::text[] then 'exercise'
    when category_tags @> array['trial-paper']::text[] then 'exercise'
    else 'note'
  end),
  author_name = coalesce(nullif(author_name, ''), 'Unknown author'),
  content_markdown = coalesce(
    nullif(content_markdown, ''),
    case
      when coalesce(file_url, '') <> '' then format('## Attachment%s[Open attachment](%s)', E'\n', file_url)
      else 'Resource content coming soon.'
    end
  );

update public.materials
set
  slug = lower(
    trim(both '-' from regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g'))
  ) || '-' || left(id::text, 8)
where slug is null or slug = '';

update public.pending_materials
set
  slug = lower(
    trim(both '-' from regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g'))
  ) || '-' || left(id::text, 8)
where slug is null or slug = '';

update public.materials
set category_tags = coalesce(
  (
    select array_agg(tag order by tag)
    from (
      select distinct unnest(category_tags) as tag
    ) normalized
    where tag in ('past-year', 'trial-paper')
  ),
  array[]::text[]
);

update public.pending_materials
set category_tags = coalesce(
  (
    select array_agg(tag order by tag)
    from (
      select distinct unnest(category_tags) as tag
    ) normalized
    where tag in ('past-year', 'trial-paper')
  ),
  array[]::text[]
);

alter table public.materials
  alter column slug set not null,
  alter column core_type set not null,
  alter column content_markdown set not null,
  alter column author_name set not null;

alter table public.pending_materials
  alter column slug set not null,
  alter column core_type set not null,
  alter column content_markdown set not null,
  alter column author_name set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'materials_core_type_check'
  ) then
    alter table public.materials
      add constraint materials_core_type_check
      check (core_type in ('exercise', 'note'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'pending_materials_core_type_check'
  ) then
    alter table public.pending_materials
      add constraint pending_materials_core_type_check
      check (core_type in ('exercise', 'note'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'materials_category_tags_allowed'
  ) then
    alter table public.materials
      add constraint materials_category_tags_allowed
      check (category_tags <@ array['past-year', 'trial-paper']::text[]);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'pending_materials_category_tags_allowed'
  ) then
    alter table public.pending_materials
      add constraint pending_materials_category_tags_allowed
      check (category_tags <@ array['past-year', 'trial-paper']::text[]);
  end if;
end $$;

create unique index if not exists idx_materials_slug_unique on public.materials (slug);
create unique index if not exists idx_pending_materials_slug_unique on public.pending_materials (slug);
create index if not exists idx_materials_core_type on public.materials (core_type);
create index if not exists idx_pending_materials_core_type on public.pending_materials (core_type);

create table if not exists public.user_forks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  source_url text not null,
  created_at timestamptz not null default now(),
  unique (user_id, material_id, source_url)
);

alter table public.user_forks enable row level security;

drop policy if exists "Allow users to select own forks" on public.user_forks;
create policy "Allow users to select own forks" on public.user_forks
  for select
  using (auth.uid() = user_id);

drop policy if exists "Allow users to insert own forks" on public.user_forks;
create policy "Allow users to insert own forks" on public.user_forks
  for insert
  with check (auth.uid() = user_id);

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

create table if not exists public.exercise_solutions (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  body text not null,
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.exercise_solutions enable row level security;

drop policy if exists "Allow public selects on exercise solutions" on public.exercise_solutions;
create policy "Allow public selects on exercise solutions" on public.exercise_solutions
  for select
  using (true);

drop policy if exists "Allow authenticated inserts on exercise solutions" on public.exercise_solutions;
create policy "Allow authenticated inserts on exercise solutions" on public.exercise_solutions
  for insert
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

create table if not exists public.exercise_solution_votes (
  id uuid primary key default gen_random_uuid(),
  solution_id uuid not null references public.exercise_solutions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (solution_id, user_id)
);

alter table public.exercise_solution_votes enable row level security;

drop policy if exists "Allow public selects on solution votes" on public.exercise_solution_votes;
create policy "Allow public selects on solution votes" on public.exercise_solution_votes
  for select
  using (true);

drop policy if exists "Allow users to upvote once" on public.exercise_solution_votes;
create policy "Allow users to upvote once" on public.exercise_solution_votes
  for insert
  with check (auth.uid() = user_id);

create table if not exists public.knowledge_patches (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('correction', 'mnemonic')),
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.knowledge_patches enable row level security;

drop policy if exists "Allow public selects on knowledge patches" on public.knowledge_patches;
create policy "Allow public selects on knowledge patches" on public.knowledge_patches
  for select
  using (true);

drop policy if exists "Allow authenticated inserts on knowledge patches" on public.knowledge_patches;
create policy "Allow authenticated inserts on knowledge patches" on public.knowledge_patches
  for insert
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

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

create index if not exists idx_user_forks_material_id on public.user_forks (material_id);
create index if not exists idx_user_forks_user_id on public.user_forks (user_id);
create index if not exists idx_annotations_fork_id on public.annotations (fork_id);
create index if not exists idx_exercise_solutions_material_id on public.exercise_solutions (material_id);
create index if not exists idx_solution_votes_solution_id on public.exercise_solution_votes (solution_id);
create index if not exists idx_knowledge_patches_material_id on public.knowledge_patches (material_id);
create index if not exists idx_material_discussions_material_id on public.material_discussions (material_id);

alter table public.materials drop column if exists file_url;
alter table public.materials drop column if exists downloads;
alter table public.materials drop column if exists metadata;

alter table public.pending_materials drop column if exists file_url;
alter table public.pending_materials drop column if exists downloads;
alter table public.pending_materials drop column if exists metadata;

commit;
