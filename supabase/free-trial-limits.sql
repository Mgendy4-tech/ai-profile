-- Atomic free-trial budget. No client can read or reset these counters.
create schema if not exists lnkdit_private;
revoke all on schema lnkdit_private from public, anon, authenticated;
create table if not exists lnkdit_private.trial_ai_daily (
  day date not null,
  account text not null,
  used integer not null default 0 check (used >= 0),
  primary key (day, account)
);
alter table lnkdit_private.trial_ai_daily enable row level security;
revoke all on lnkdit_private.trial_ai_daily from public, anon, authenticated;

-- The definer can touch only private counters; identity always comes from auth.uid().
create or replace function public.consume_trial_ai_request()
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  today date := (now() at time zone 'UTC')::date;
  account_used integer;
  total_used integer;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  -- Serialize reservations across server instances; hold only for this short transaction.
  perform pg_catalog.pg_advisory_xact_lock(734810, 1);
  select used into account_used from lnkdit_private.trial_ai_daily where day=today and account=actor::text;
  select used into total_used from lnkdit_private.trial_ai_daily where day=today and account='global';
  if coalesce(account_used,0) >= 20 or coalesce(total_used,0) >= 200 then return false; end if;
  insert into lnkdit_private.trial_ai_daily(day,account,used) values(today,actor::text,1),(today,'global',1)
    on conflict(day,account) do update set used=lnkdit_private.trial_ai_daily.used+1;
  return true;
end;
$$;
revoke all on function public.consume_trial_ai_request() from public, anon;
grant execute on function public.consume_trial_ai_request() to authenticated;
