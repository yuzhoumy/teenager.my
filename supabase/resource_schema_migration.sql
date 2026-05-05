begin;

-- 1. Ensure new columns exist
alter table public.materials add column if not exists slug text;
alter table public.materials add column if not exists core_type text;
alter table public.materials add column if not exists content_markdown text;
alter table public.materials add column if not exists author_name text;

alter table public.pending_materials add column if not exists slug text;
alter table public.pending_materials add column if not exists core_type text;
alter table public.pending_materials add column if not exists content_markdown text;
alter table public.pending_materials add column if not exists author_name text;

alter table public.user_forks add column if not exists markdown_content text;
alter table public.user_forks add column if not exists annotation_layers jsonb;
update public.user_forks set markdown_content = '' where markdown_content is null;
alter table public.user_forks alter column markdown_content set not null;

-- 2. Drop the restrictive constraint
alter table public.materials drop constraint if exists materials_category_tags_not_empty;
alter table public.pending_materials drop constraint if exists pending_materials_category_tags_not_empty;

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
                when m.category_tags @> array[''past-year'']::text[] then ''exercise''
                when m.category_tags @> array[''trial-paper'']::text[] then ''exercise''
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