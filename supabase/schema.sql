-- 1) Required extension for UUID helpers
create extension if not exists "pgcrypto";

-- 2) Quiz table
create table if not exists public.quizzes (
  id text primary key,
  user_id uuid,
  title text not null,
  category_type text not null,
  author text not null default 'Guest',
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quizzes_user_id_idx on public.quizzes(user_id);

-- 3) Enable Row Level Security
alter table public.quizzes enable row level security;

-- 4) Shared library policies
-- Anyone (including anonymous auth users) can read/write quizzes.
drop policy if exists "quizzes_select_all" on public.quizzes;
create policy "quizzes_select_all"
on public.quizzes for select
using (true);

drop policy if exists "quizzes_insert_all" on public.quizzes;
create policy "quizzes_insert_all"
on public.quizzes for insert
with check (true);

drop policy if exists "quizzes_update_all" on public.quizzes;
create policy "quizzes_update_all"
on public.quizzes for update
using (true)
with check (true);

drop policy if exists "quizzes_delete_all" on public.quizzes;
create policy "quizzes_delete_all"
on public.quizzes for delete
using (true);

-- 5) Storage bucket (run in SQL editor once)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quiz-media',
  'quiz-media',
  true,
  52428800,
  array[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm',
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 6) Storage policies for owner-only writes/deletes
drop policy if exists "media_select_public" on storage.objects;
create policy "media_select_public"
on storage.objects for select
using (bucket_id = 'quiz-media');

drop policy if exists "media_insert_own" on storage.objects;
create policy "media_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'quiz-media'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "media_delete_own" on storage.objects;
create policy "media_delete_own"
on storage.objects for delete
using (
  bucket_id = 'quiz-media'
  and auth.uid()::text = split_part(name, '/', 1)
);
