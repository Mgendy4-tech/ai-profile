-- Customer-ready V1: private authenticated asset storage.
-- Run manually in Supabase SQL editor. This file is idempotent and does not
-- delete existing rows or files.

create table if not exists public.cloud_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version integer not null default 1,
  active_profile_id text,
  updated_at timestamptz not null default now()
);

create table if not exists public.cloud_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  display_name text not null default 'New Profile',
  company_data jsonb,
  projects jsonb not null default '[]'::jsonb,
  generated_profile jsonb,
  profile_structure jsonb,
  selected_family text,
  selected_variant text,
  export_decision jsonb,
  freshness jsonb not null default '{}'::jsonb,
  unsupported_assets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, profile_id)
);

alter table public.cloud_workspaces enable row level security;
alter table public.cloud_profiles enable row level security;

drop policy if exists "workspace owner access" on public.cloud_workspaces;
create policy "workspace owner access" on public.cloud_workspaces
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "profile owner access" on public.cloud_profiles;
create policy "profile owner access" on public.cloud_profiles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists cloud_profiles_user_updated_idx
  on public.cloud_profiles (user_id, updated_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-assets',
  'customer-assets',
  false,
  10485760,
  array['image/png', 'image/jpeg']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Supabase owns storage.objects and already enforces RLS on it.\n-- Do not ALTER this managed table: the SQL editor may fail with\n-- "must be owner of table objects". Configure only the policies below.\n

drop policy if exists "customer assets owner read" on storage.objects;
create policy "customer assets owner read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'customer-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "customer assets owner upload" on storage.objects;
create policy "customer assets owner upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'customer-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) >= 3
  );

drop policy if exists "customer assets owner update" on storage.objects;
create policy "customer assets owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'customer-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'customer-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "customer assets owner delete" on storage.objects;
create policy "customer assets owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'customer-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
