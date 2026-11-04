-- NEXUS // OMNIVERSE — production schema
-- Target: Supabase / PostgreSQL 15+
-- Demo mode does not require this migration. Apply in a configured Supabase project.

create extension if not exists pgcrypto;

create type public.entity_kind as enum ('city','district','facility','route','organization','economic','environmental','landmark');
create type public.entity_status as enum ('operational','degraded','offline','maintenance','unknown');
create type public.criticality as enum ('critical','high','moderate','low');
create type public.incident_category as enum ('infrastructure_failure','transport_disruption','environmental_emergency','power_outage','water_disruption','network_failure','natural_disaster');
create type public.incident_severity as enum ('critical','high','moderate','low');
create type public.incident_status as enum ('detected','investigating','assigned','mitigating','resolved','archived');
create type public.simulation_kind as enum ('route_closure','power_shortage','supply_chain','rainfall','population_growth');
create type public.report_status as enum ('draft','review','published','archived');
create type public.notification_category as enum ('system','incident','assignment','simulation','workspace','administration');
create type public.notification_priority as enum ('critical','high','normal','low');

create table public.roles (
  id text primary key,
  name text not null,
  description text not null default '',
  rank integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id text primary key,
  label text not null,
  category text not null,
  description text not null default ''
);

create table public.role_permissions (
  role_id text not null references public.roles(id) on delete cascade,
  permission_id text not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null unique,
  role_id text not null references public.roles(id) default 'observer',
  title text not null default 'Observer',
  clearance text not null default 'L1',
  status text not null default 'active' check (status in ('active','suspended','invited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  description text not null default '',
  classification text not null default 'internal',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  access_level text not null default 'viewer' check (access_level in ('owner','editor','viewer')),
  primary key (workspace_id, user_id)
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text not null default 'Aurelia Metropolitan Theater',
  latitude numeric(9,6),
  longitude numeric(9,6),
  map_x numeric(8,3),
  map_y numeric(8,3),
  metadata jsonb not null default '{}'::jsonb
);

create table public.entities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  parent_id uuid references public.entities(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  kind public.entity_kind not null,
  name text not null,
  code text not null unique,
  status public.entity_status not null default 'operational',
  criticality public.criticality not null default 'moderate',
  description text not null default '',
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index entities_workspace_idx on public.entities(workspace_id);
create index entities_kind_idx on public.entities(kind);
create index entities_parent_idx on public.entities(parent_id);

create table public.entity_relations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.entities(id) on delete cascade,
  target_id uuid not null references public.entities(id) on delete cascade,
  relation_type text not null,
  strength numeric(4,3) not null default 0.5 check (strength between 0 and 1),
  metadata jsonb not null default '{}'::jsonb,
  unique (source_id, target_id, relation_type)
);
create index entity_relations_source_idx on public.entity_relations(source_id);
create index entity_relations_target_idx on public.entity_relations(target_id);

create table public.observations (
  id bigint generated always as identity primary key,
  entity_id uuid not null references public.entities(id) on delete cascade,
  metric text not null,
  value numeric not null,
  unit text not null,
  observed_at timestamptz not null,
  source text not null default 'simulated',
  quality text not null default 'verified'
);
create index observations_entity_metric_time_idx on public.observations(entity_id, metric, observed_at desc);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  primary_entity_id uuid references public.entities(id) on delete set null,
  reference text not null unique,
  title text not null,
  category public.incident_category not null,
  severity public.incident_severity not null,
  status public.incident_status not null default 'detected',
  summary text not null default '',
  commander uuid references public.profiles(id) on delete set null,
  confidence integer not null default 0 check (confidence between 0 and 100),
  impact_score integer not null default 0 check (impact_score between 0 and 100),
  detected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text
);
create index incidents_status_severity_idx on public.incidents(status, severity);
create index incidents_detected_idx on public.incidents(detected_at desc);

create table public.incident_assignments (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  team text not null,
  lead uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  released_at timestamptz
);

create table public.incident_events (
  id bigint generated always as identity primary key,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  actor uuid references public.profiles(id) on delete set null,
  event_type text not null,
  from_status public.incident_status,
  to_status public.incident_status,
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index incident_events_incident_idx on public.incident_events(incident_id, created_at);

create table public.incident_notes (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  author uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.incident_evidence (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  label text not null,
  kind text not null default 'document',
  storage_path text,
  external_url text,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.simulations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  owner uuid references public.profiles(id) on delete set null,
  name text not null,
  kind public.simulation_kind not null,
  parameters jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','running','complete','failed')),
  created_at timestamptz not null default now()
);

create table public.simulation_results (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.simulations(id) on delete cascade,
  horizon_hours integer not null,
  summary jsonb not null default '{}'::jsonb,
  series jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.dashboards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  owner uuid references public.profiles(id) on delete cascade,
  name text not null,
  layout jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references public.dashboards(id) on delete cascade,
  title text not null,
  widget_type text not null,
  config jsonb not null default '{}'::jsonb,
  position jsonb not null default '{}'::jsonb
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  author uuid references public.profiles(id) on delete set null,
  title text not null,
  template text not null default 'intelligence_brief',
  status public.report_status not null default 'draft',
  classification text not null default 'internal',
  summary text not null default '',
  shared_with uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.report_blocks (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  position integer not null default 0,
  block_type text not null,
  content jsonb not null default '{}'::jsonb
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'New intelligence thread',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages(conversation_id, created_at);

create table public.message_sources (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  entity_id uuid references public.entities(id) on delete set null,
  label text not null,
  href text
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category public.notification_category not null default 'system',
  priority public.notification_priority not null default 'normal',
  title text not null,
  body text not null default '',
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_unread_idx on public.notifications(user_id, read_at, created_at desc);

create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  incident_updates boolean not null default true,
  assignments boolean not null default true,
  simulations boolean not null default true,
  workspace_activity boolean not null default true,
  system_alerts boolean not null default true,
  digest_frequency text not null default 'realtime'
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip inet,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs(created_at desc);
create index audit_logs_actor_idx on public.audit_logs(actor, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated before update on public.profiles
for each row execute function public.set_updated_at();
create trigger entities_updated before update on public.entities
for each row execute function public.set_updated_at();
create trigger incidents_updated before update on public.incidents
for each row execute function public.set_updated_at();
create trigger dashboards_updated before update on public.dashboards
for each row execute function public.set_updated_at();
create trigger reports_updated before update on public.reports
for each row execute function public.set_updated_at();
create trigger conversations_updated before update on public.conversations
for each row execute function public.set_updated_at();
