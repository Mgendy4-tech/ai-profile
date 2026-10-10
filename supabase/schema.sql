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
create policy "workspace owner access" on public.cloud_workspaces for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "profile owner access" on public.cloud_profiles;
create policy "profile owner access" on public.cloud_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists cloud_profiles_user_updated_idx on public.cloud_profiles (user_id, updated_at desc);
