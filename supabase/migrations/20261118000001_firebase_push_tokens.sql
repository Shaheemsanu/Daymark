create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;
grant select, insert, update, delete on public.push_tokens to authenticated;

create policy "Users can read their own push tokens" on public.push_tokens for select to authenticated using (auth.uid() = user_id);
create policy "Users can add their own push tokens" on public.push_tokens for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update their own push tokens" on public.push_tokens for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own push tokens" on public.push_tokens for delete to authenticated using (auth.uid() = user_id);
