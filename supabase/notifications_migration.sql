-- Notifications + announcements. Run in Supabase SQL Editor (or psql).
-- After applying: Dashboard → Database → Replication → enable postgres_changes for `notifications` (optional, for live badge updates).

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null check (
    type in (
      'follow',
      'fork_material',
      'comment_material',
      'mention_material',
      'comment_forum',
      'reply_forum',
      'mention_forum',
      'new_material_followed',
      'new_fork_followed',
      'new_post_followed',
      'announcement',
      'fork_annotation'
    )
  ),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recipient_created on public.notifications (recipient_id, created_at desc);
create index if not exists idx_notifications_recipient_unread on public.notifications (recipient_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications" on public.notifications
  for select using (auth.uid() = recipient_id);

drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications" on public.notifications
  for update using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- Admin-maintained announcements (insert/update via SQL Editor or service role).
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

drop policy if exists "Anyone can read announcements" on public.announcements;
create policy "Anyone can read announcements" on public.announcements
  for select using (true);

create or replace function public.insert_notification(
  p_recipient uuid,
  p_actor uuid,
  p_type text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_recipient is null then
    return;
  end if;
  if p_actor is not null and p_recipient = p_actor then
    return;
  end if;
  insert into public.notifications (recipient_id, actor_id, type, payload)
  values (p_recipient, p_actor, p_type, coalesce(p_payload, '{}'::jsonb));
end;
$$;

create or replace function public.notify_profile_mentions(
  p_body text,
  p_actor uuid,
  p_mention_type text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tok text;
  match_count integer;
  matched_user uuid;
begin
  if p_body is null or length(trim(p_body)) = 0 or p_actor is null then
    return;
  end if;

  for tok in
    select distinct lower(trim(m[1]))
    from regexp_matches(p_body, '@([^\s@]+)', 'g') as m
    where length(trim(m[1])) between 1 and 80
  loop
    select count(*)::integer into match_count
    from public.profiles p
    where lower(trim(p.display_name)) = tok;

    if match_count <> 1 then
      continue;
    end if;

    select p.user_id into matched_user
    from public.profiles p
    where lower(trim(p.display_name)) = tok
    limit 1;

    perform public.insert_notification(matched_user, p_actor, p_mention_type, p_payload);
  end loop;
end;
$$;

create or replace function public.trg_notify_profile_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.insert_notification(new.followed_id, new.follower_id, 'follow', '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists notify_on_profile_follow on public.profile_follows;
create trigger notify_on_profile_follow
  after insert on public.profile_follows
  for each row execute function public.trg_notify_profile_follow();

create or replace function public.trg_notify_user_fork()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  slug text;
  follower uuid;
begin
  select m.uploaded_by, m.slug into owner_id, slug
  from public.materials m
  where m.id = new.material_id;

  if owner_id is not null then
    perform public.insert_notification(
      owner_id,
      new.user_id,
      'fork_material',
      jsonb_build_object(
        'material_id', new.material_id,
        'material_slug', slug,
        'fork_id', new.id
      )
    );
  end if;

  for follower in
    select pf.follower_id from public.profile_follows pf where pf.followed_id = new.user_id
  loop
    perform public.insert_notification(
      follower,
      new.user_id,
      'new_fork_followed',
      jsonb_build_object(
        'material_id', new.material_id,
        'material_slug', slug,
        'fork_id', new.id
      )
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists notify_on_user_fork on public.user_forks;
create trigger notify_on_user_fork
  after insert on public.user_forks
  for each row execute function public.trg_notify_user_fork();

create or replace function public.trg_notify_material_discussion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  slug text;
begin
  if new.user_id is null then
    return new;
  end if;

  select m.uploaded_by, m.slug into owner_id, slug
  from public.materials m
  where m.id = new.material_id;

  if owner_id is not null then
    perform public.insert_notification(
      owner_id,
      new.user_id,
      'comment_material',
      jsonb_build_object(
        'material_id', new.material_id,
        'material_slug', slug,
        'discussion_id', new.id
      )
    );
  end if;

  perform public.notify_profile_mentions(
    new.body,
    new.user_id,
    'mention_material',
    jsonb_build_object(
      'material_id', new.material_id,
      'material_slug', slug,
      'discussion_id', new.id
    )
  );

  return new;
end;
$$;

drop trigger if exists notify_on_material_discussion on public.material_discussions;
create trigger notify_on_material_discussion
  after insert on public.material_discussions
  for each row execute function public.trg_notify_material_discussion();

create or replace function public.trg_notify_forum_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author uuid;
  post_title text;
  parent_author uuid;
begin
  if new.user_id is null then
    return new;
  end if;

  select fp.user_id, fp.title into post_author, post_title
  from public.forum_posts fp
  where fp.id = new.post_id;

  if new.parent_comment_id is null then
    if post_author is not null then
      perform public.insert_notification(
        post_author,
        new.user_id,
        'comment_forum',
        jsonb_build_object(
          'post_id', new.post_id,
          'comment_id', new.id,
          'post_title', post_title
        )
      );
    end if;
  else
    select fc.user_id into parent_author
    from public.forum_comments fc
    where fc.id = new.parent_comment_id;

    if parent_author is not null then
      perform public.insert_notification(
        parent_author,
        new.user_id,
        'reply_forum',
        jsonb_build_object(
          'post_id', new.post_id,
          'comment_id', new.id,
          'parent_comment_id', new.parent_comment_id,
          'post_title', post_title
        )
      );
    end if;
  end if;

  perform public.notify_profile_mentions(
    new.body,
    new.user_id,
    'mention_forum',
    jsonb_build_object(
      'post_id', new.post_id,
      'comment_id', new.id,
      'post_title', post_title
    )
  );

  return new;
end;
$$;

drop trigger if exists notify_on_forum_comment on public.forum_comments;
create trigger notify_on_forum_comment
  after insert on public.forum_comments
  for each row execute function public.trg_notify_forum_comment();

create or replace function public.trg_notify_new_forum_post_followers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  follower uuid;
begin
  if new.user_id is null then
    return new;
  end if;

  for follower in
    select pf.follower_id from public.profile_follows pf where pf.followed_id = new.user_id
  loop
    perform public.insert_notification(
      follower,
      new.user_id,
      'new_post_followed',
      jsonb_build_object(
        'post_id', new.id,
        'post_title', new.title
      )
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists notify_followers_new_forum_post on public.forum_posts;
create trigger notify_followers_new_forum_post
  after insert on public.forum_posts
  for each row execute function public.trg_notify_new_forum_post_followers();

create or replace function public.trg_notify_new_material_followers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  follower uuid;
begin
  if new.uploaded_by is null then
    return new;
  end if;

  for follower in
    select pf.follower_id from public.profile_follows pf where pf.followed_id = new.uploaded_by
  loop
    perform public.insert_notification(
      follower,
      new.uploaded_by,
      'new_material_followed',
      jsonb_build_object(
        'material_id', new.id,
        'material_slug', new.slug,
        'material_title', new.title
      )
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists notify_followers_new_material on public.materials;
create trigger notify_followers_new_material
  after insert on public.materials
  for each row execute function public.trg_notify_new_material_followers();

create or replace function public.trg_broadcast_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  for uid in select p.user_id from public.profiles p
  loop
    perform public.insert_notification(
      uid,
      new.created_by,
      'announcement',
      jsonb_build_object(
        'announcement_id', new.id,
        'title', new.title
      )
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists notify_users_on_announcement on public.announcements;
create trigger notify_users_on_announcement
  after insert on public.announcements
  for each row execute function public.trg_broadcast_announcement();

create or replace function public.trg_notify_fork_annotation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fork_owner uuid;
  slug text;
begin
  select uf.user_id, m.slug into fork_owner, slug
  from public.user_forks uf
  join public.materials m on m.id = uf.material_id
  where uf.id = new.fork_id;

  if fork_owner is null or new.created_by is null then
    return new;
  end if;

  if fork_owner is distinct from new.created_by then
    perform public.insert_notification(
      fork_owner,
      new.created_by,
      'fork_annotation',
      jsonb_build_object(
        'fork_id', new.fork_id,
        'annotation_id', new.id,
        'material_slug', slug
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists notify_on_fork_annotation on public.annotations;
create trigger notify_on_fork_annotation
  after insert on public.annotations
  for each row execute function public.trg_notify_fork_annotation();

-- Optional: expose notifications to Supabase Realtime (safe — RLS still applies to clients).
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
