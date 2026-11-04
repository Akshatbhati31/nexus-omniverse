-- NEXUS // OMNIVERSE — Enhanced Database Triggers & Real-time Replication
-- Target: Supabase / PostgreSQL 15+

-- Enable Realtime publication for operational tables
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.incidents;
    alter publication supabase_realtime add table public.incident_events;
    alter publication supabase_realtime add table public.observations;
    alter publication supabase_realtime add table public.notifications;
    alter publication supabase_realtime add table public.audit_logs;
  end if;
end;
$$;

-- View for cross-domain operational intelligence synthesis
create or replace view public.v_operational_theater as
select
  e.id,
  e.name,
  e.code,
  e.kind,
  e.status,
  e.criticality,
  w.name as workspace_name,
  l.name as location_name,
  l.latitude,
  l.longitude,
  count(distinct i.id) filter (where i.status not in ('resolved', 'archived')) as active_incidents
from public.entities e
left join public.workspaces w on w.id = e.workspace_id
left join public.locations l on l.id = e.location_id
left join public.incidents i on i.primary_entity_id = e.id
group by e.id, e.name, e.code, e.kind, e.status, e.criticality, w.name, l.name, l.latitude, l.longitude;

grant select on public.v_operational_theater to authenticated;

