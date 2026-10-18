create table if not exists public.support_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(title) between 1 and 120),
 message text not null check (char_length(message) between 1 and 4000),
 status text not null default 'open' check (status in ('open','answered','closed')),
 reply text check (char_length(reply) <= 8000),
 created_at timestamptz not null default now()
);
create index if not exists support_requests_user_created_idx on public.support_requests(user_id,created_at desc);
alter table public.support_requests enable row level security;
revoke all on public.support_requests from anon,authenticated;
grant select,delete on public.support_requests to authenticated;
grant insert(user_id,title,message) on public.support_requests to authenticated;
create policy support_read_own on public.support_requests for select to authenticated using ((select auth.uid()) = user_id);
create policy support_delete_own on public.support_requests for delete to authenticated using ((select auth.uid()) = user_id);
create policy support_insert_own on public.support_requests for insert to authenticated with check (
 (select auth.uid()) = user_id and
 (select count(*) from public.support_requests recent where recent.user_id=(select auth.uid()) and recent.created_at > now()-interval '24 hours') < 5
);
