alter policy support_insert_own on public.support_requests with check ((select auth.uid())=user_id);
create or replace function public.enforce_support_request_limit()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('lnkdit-support:'||new.user_id::text,0));
 if (select count(*) from public.support_requests where user_id=new.user_id and created_at>now()-interval '24 hours')>=5 then
   raise exception using errcode='P0001',message='support_daily_limit';
 end if;
 return new;
end $$;
create trigger support_request_daily_limit before insert on public.support_requests for each row execute function public.enforce_support_request_limit();
