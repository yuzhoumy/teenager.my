drop policy if exists "Allow users to update own forum posts" on public.forum_posts;
create policy "Allow users to update own forum posts" on public.forum_posts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Allow users to delete own forum posts" on public.forum_posts;
create policy "Allow users to delete own forum posts" on public.forum_posts
  for delete
  using (auth.uid() = user_id);
