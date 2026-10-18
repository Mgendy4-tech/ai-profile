do $$ begin
 if not exists (select 1 from pg_roles where rolname='lnkdit_backup_readonly') then
   create role lnkdit_backup_readonly nologin bypassrls;
 end if;
end $$;
grant pg_read_all_data to lnkdit_backup_readonly;
alter role lnkdit_backup_readonly set default_transaction_read_only = on;
