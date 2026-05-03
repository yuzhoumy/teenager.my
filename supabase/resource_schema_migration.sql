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

alter table public.materials drop column if exists file_url;
alter table public.materials drop column if exists downloads;
alter table public.materials drop column if exists metadata;

alter table public.pending_materials drop column if exists file_url;
alter table public.pending_materials drop column if exists downloads;
alter table public.pending_materials drop column if exists metadata;

commit;
