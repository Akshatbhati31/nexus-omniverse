-- NEXUS // OMNIVERSE — server-side authorization
-- All privileged mutations are validated in security-definer RPCs.

create or replace function public.current_role_id()
returns text
language sql stable security definer set search_path = public
as $$
  select role_id from public.profiles where id = auth.uid();
$$;

create or replace function public.has_permission(required text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.role_id = p.role_id
    where p.id = auth.uid()
      and p.status = 'active'
      and rp.permission_id = required
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.current_role_id() = 'super_admin';
$$;

create or replace function public.can_access_workspace(workspace uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1 from public.workspace_members
    where workspace_id = workspace and user_id = auth.uid()
  );
$$;

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.locations enable row level security;
alter table public.entities enable row level security;
alter table public.entity_relations enable row level security;
alter table public.observations enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_assignments enable row level security;
alter table public.incident_events enable row level security;
alter table public.incident_notes enable row level security;
alter table public.incident_evidence enable row level security;
alter table public.simulations enable row level security;
alter table public.simulation_results enable row level security;
alter table public.dashboards enable row level security;
alter table public.dashboard_widgets enable row level security;
alter table public.reports enable row level security;
alter table public.report_blocks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.message_sources enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.audit_logs enable row level security;

create policy "catalog readable" on public.roles for select to authenticated using (true);
create policy "permissions readable" on public.permissions for select to authenticated using (true);
create policy "role permissions readable" on public.role_permissions for select to authenticated using (true);
create policy "role permissions managed" on public.role_permissions for all to authenticated
  using (public.has_permission('admin:roles')) with check (public.has_permission('admin:roles'));

create policy "profiles self or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_permission('admin:users'));

create policy "workspaces accessible" on public.workspaces for select to authenticated
  using (public.can_access_workspace(id) or created_by = auth.uid());
create policy "workspace members visible" on public.workspace_members for select to authenticated
  using (user_id = auth.uid() or public.can_access_workspace(workspace_id));

create policy "locations readable" on public.locations for select to authenticated using (true);
create policy "locations managed" on public.locations for all to authenticated
  using (public.has_permission('admin:settings')) with check (public.has_permission('admin:settings'));
create policy "entities readable" on public.entities for select to authenticated using (true);
create policy "entities managed" on public.entities for all to authenticated
  using (public.has_permission('admin:settings')) with check (public.has_permission('admin:settings'));
create policy "relations readable" on public.entity_relations for select to authenticated using (true);
create policy "relations managed" on public.entity_relations for all to authenticated
  using (public.has_permission('admin:settings')) with check (public.has_permission('admin:settings'));
create policy "observations readable" on public.observations for select to authenticated using (true);

create policy "incidents readable" on public.incidents for select to authenticated
  using (workspace_id is null or public.can_access_workspace(workspace_id));
create policy "assignments readable" on public.incident_assignments for select to authenticated
  using (true);
create policy "incident events readable" on public.incident_events for select to authenticated
  using (true);
create policy "incident notes readable" on public.incident_notes for select to authenticated
  using (true);
create policy "incident notes inserted" on public.incident_notes for insert to authenticated
  with check (author = auth.uid() and public.has_permission('incident:note'));
create policy "incident notes edited" on public.incident_notes for update to authenticated
  using (author = auth.uid()) with check (author = auth.uid());
create policy "incident notes deleted" on public.incident_notes for delete to authenticated
  using (author = auth.uid() or public.has_permission('admin:settings'));
create policy "evidence readable" on public.incident_evidence for select to authenticated using (true);
create policy "evidence inserted" on public.incident_evidence for insert to authenticated
  with check (added_by = auth.uid() and public.has_permission('incident:evidence'));

create policy "simulations owned" on public.simulations for all to authenticated
  using (owner = auth.uid() or public.has_permission('admin:audit'))
  with check (owner = auth.uid() and public.has_permission('simulation:save'));
create policy "simulation results owned" on public.simulation_results for all to authenticated
  using (exists (select 1 from public.simulations s where s.id = simulation_id and s.owner = auth.uid()))
  with check (exists (select 1 from public.simulations s where s.id = simulation_id and s.owner = auth.uid()));

create policy "dashboards owned or shared" on public.dashboards for select to authenticated
  using (owner = auth.uid() or public.can_access_workspace(workspace_id) or public.has_permission('admin:audit'));
create policy "dashboards inserted" on public.dashboards for insert to authenticated
  with check (owner = auth.uid() and public.has_permission('analytics:edit'));
create policy "dashboards updated" on public.dashboards for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy "dashboards deleted" on public.dashboards for delete to authenticated
  using (owner = auth.uid() or public.has_permission('admin:settings'));
create policy "widgets visible" on public.dashboard_widgets for select to authenticated
  using (exists (select 1 from public.dashboards d where d.id = dashboard_id and (d.owner = auth.uid() or public.can_access_workspace(d.workspace_id))));
create policy "widgets managed" on public.dashboard_widgets for all to authenticated
  using (exists (select 1 from public.dashboards d where d.id = dashboard_id and d.owner = auth.uid()))
  with check (exists (select 1 from public.dashboards d where d.id = dashboard_id and d.owner = auth.uid()));

create policy "reports readable" on public.reports for select to authenticated
  using (author = auth.uid() or auth.uid() = any(shared_with) or public.has_permission('admin:audit'));
create policy "reports created" on public.reports for insert to authenticated
  with check (author = auth.uid() and public.has_permission('report:create'));
create policy "reports updated" on public.reports for update to authenticated
  using (author = auth.uid() and public.has_permission('report:edit'))
  with check (author = auth.uid());
create policy "report blocks readable" on public.report_blocks for select to authenticated
  using (exists (select 1 from public.reports r where r.id = report_id and (r.author = auth.uid() or auth.uid() = any(r.shared_with))));
create policy "report blocks managed" on public.report_blocks for all to authenticated
  using (exists (select 1 from public.reports r where r.id = report_id and r.author = auth.uid()))
  with check (exists (select 1 from public.reports r where r.id = report_id and r.author = auth.uid()));

create policy "conversations owned" on public.conversations for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid() and public.has_permission('ai:use'));
create policy "messages owned" on public.messages for all to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id and c.owner = auth.uid()))
  with check (exists (select 1 from public.conversations c where c.id = conversation_id and c.owner = auth.uid()));
create policy "message sources owned" on public.message_sources for all to authenticated
  using (exists (select 1 from public.messages m join public.conversations c on c.id = m.conversation_id where m.id = message_id and c.owner = auth.uid()))
  with check (exists (select 1 from public.messages m join public.conversations c on c.id = m.conversation_id where m.id = message_id and c.owner = auth.uid()));

create policy "notifications owned" on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "notifications updated" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notification prefs owned" on public.notification_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "audit admin read" on public.audit_logs for select to authenticated
  using (public.has_permission('admin:audit'));

-- Server-enforced incident state machine.
create or replace function public.transition_incident(
  p_incident uuid,
  p_next public.incident_status,
  p_detail text default ''
)
returns public.incidents
language plpgsql security definer set search_path = public
as $$
declare
  v_current public.incidents;
  v_from public.incident_status;
  v_allowed boolean := false;
begin
  if not public.has_permission('incident:transition') then
    raise exception 'permission denied: incident:transition';
  end if;

  select * into v_current from public.incidents where id = p_incident for update;
  if not found then
    raise exception 'incident not found';
  end if;

  v_allowed := case
    when v_current.status = 'detected' and p_next in ('investigating','assigned') then true
    when v_current.status = 'investigating' and p_next in ('assigned','mitigating') then true
    when v_current.status = 'assigned' and p_next in ('investigating','mitigating') then true
    when v_current.status = 'mitigating' and p_next in ('resolved','assigned') then true
    when v_current.status = 'resolved' and p_next = 'archived' then true
    else false
  end;
  if not v_allowed then
    raise exception 'invalid incident transition: % -> %', v_current.status, p_next;
  end if;

  v_from := v_current.status;

  update public.incidents
  set status = p_next,
      resolved_at = case when p_next = 'resolved' then now() else resolved_at end
  where id = p_incident
  returning * into v_current;

  insert into public.incident_events(incident_id, actor, event_type, from_status, to_status, detail)
  values (p_incident, auth.uid(), 'status_transition', v_from, p_next, coalesce(p_detail, ''));

  insert into public.audit_logs(actor, action, target_type, target_id, metadata)
  values (auth.uid(), 'incident.transition', 'incident', p_incident::text, jsonb_build_object('to', p_next));

  if v_current.commander is not null then
    insert into public.notifications(user_id, category, priority, title, body, href)
    values (
      v_current.commander,
      'incident',
      case when v_current.severity = 'critical' then 'critical' else 'high' end,
      'Incident status changed',
      v_current.reference || ' moved to ' || p_next,
      '/incidents/' || p_incident
    );
  end if;

  return v_current;
end;
$$;

create or replace function public.assign_incident(p_incident uuid, p_team text, p_lead uuid default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_permission('incident:assign') then
    raise exception 'permission denied: incident:assign';
  end if;
  insert into public.incident_assignments(incident_id, team, lead) values (p_incident, p_team, p_lead);
  insert into public.incident_events(incident_id, actor, event_type, detail)
  values (p_incident, auth.uid(), 'assignment', 'Assigned to ' || p_team);
  insert into public.audit_logs(actor, action, target_type, target_id, metadata)
  values (auth.uid(), 'incident.assign', 'incident', p_incident::text, jsonb_build_object('team', p_team));
  if p_lead is not null then
    insert into public.notifications(user_id, category, priority, title, body, href)
    values (p_lead, 'assignment', 'high', 'Incident assignment', 'You were assigned to ' || p_incident::text, '/incidents/' || p_incident);
  end if;
end;
$$;

create or replace function public.assign_user_role(p_user uuid, p_role text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'permission denied: super administrator required';
  end if;
  if not exists (select 1 from public.roles where id = p_role) then
    raise exception 'unknown role';
  end if;
  update public.profiles set role_id = p_role where id = p_user;
  insert into public.audit_logs(actor, action, target_type, target_id, metadata)
  values (auth.uid(), 'user.role.assign', 'profile', p_user::text, jsonb_build_object('role', p_role));
end;
$$;

create or replace function public.log_audit(p_action text, p_target_type text, p_target_id text, p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.audit_logs(actor, action, target_type, target_id, metadata)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_metadata);
end;
$$;

revoke all on function public.assign_user_role(uuid, text) from public;
grant execute on function public.assign_user_role(uuid, text) to authenticated;
grant execute on function public.transition_incident(uuid, public.incident_status, text) to authenticated;
grant execute on function public.assign_incident(uuid, text, uuid) to authenticated;
grant execute on function public.log_audit(text, text, text, jsonb) to authenticated;
