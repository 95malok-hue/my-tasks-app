-- Выполни этот скрипт в Supabase → SQL Editor.
create extension if not exists pg_cron with schema extensions;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);

alter table public.tasks enable row level security;

drop policy if exists "Users can read own tasks" on public.tasks;
create policy "Users can read own tasks" on public.tasks
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can insert own tasks" on public.tasks;
create policy "Users can insert own tasks" on public.tasks
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can update own tasks" on public.tasks;
create policy "Users can update own tasks" on public.tasks
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own tasks" on public.tasks;
create policy "Users can delete own tasks" on public.tasks
for delete to authenticated using (auth.uid() = user_id);

-- Удаление выполняется сервером раз в минуту, даже если приложение закрыто.
select cron.schedule(
  'delete-completed-tasks-every-minute',
  '* * * * *',
  $$delete from public.tasks
    where completed_at is not null
      and completed_at <= now() - interval '48 hours';$$
);
