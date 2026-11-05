-- ============================================================================
-- NEXUS // OMNIVERSE — PRODUCTION SECURITY HARDENING MIGRATION
-- Migration: 0004_security_hardening.sql
-- Target: Supabase / PostgreSQL 15+
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. SCHEMA RECONCILIATION
-- ----------------------------------------------------------------------------

-- Add description column to dashboards to satisfy frontend Dashboard interface contract
ALTER TABLE public.dashboards
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

-- Persistent client identifier mapping table (isolated per-user namespace)
-- NOTE: Profiles belong exclusively to auth.users and public.profiles and must NEVER
-- be resolved via client_id_map. 'profile' is strictly excluded from allowed entity types.
CREATE TABLE IF NOT EXISTS public.client_id_map (
  created_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   text NOT NULL,
  entity_type text NOT NULL,
  db_id       uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT pk_client_id_map PRIMARY KEY (created_by, client_id, entity_type),
  CONSTRAINT uq_client_id_map_db_id UNIQUE (db_id),
  CONSTRAINT chk_client_id_map_entity_type CHECK (
    entity_type IN ('incident', 'dashboard', 'dashboard_widget', 'report', 'report_block', 'entity', 'location')
  )
);

CREATE INDEX IF NOT EXISTS idx_client_id_map_lookup
  ON public.client_id_map(created_by, client_id, entity_type);

ALTER TABLE public.client_id_map ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. SEED EXACT 32 PERMISSIONS & 6 ROLES (Source: src/data/roles.ts)
-- ----------------------------------------------------------------------------

-- Upsert exact 32 permissions
INSERT INTO public.permissions (id, label, category, description) VALUES
  ('view:overview',        'View overview',                    'Situational Awareness', 'Read-only access to overview theater and status summaries'),
  ('view:geoint',          'View geospatial intelligence',     'Situational Awareness', 'Access spatial mapping, heatmaps, and geospatial telemetry'),
  ('view:infrastructure',  'View infrastructure grid',         'Domain Operations',    'Access infrastructure topology and operational statuses'),
  ('view:environment',     'View environmental sensors',       'Domain Operations',    'Access environmental monitoring, telemetry, and forecasts'),
  ('view:economy',         'View economic metrics',            'Domain Operations',    'Access economic transactions, supply routes, and trade data'),
  ('view:mobility',        'View mobility network',            'Domain Operations',    'Access transport grid, traffic flow, and fleet operations'),
  ('view:energy',          'View energy grid',                 'Domain Operations',    'Access power generation, distribution, and consumption nodes'),
  ('view:incidents',       'View incidents',                   'Incidents',            'Access incident queues and status logs'),
  ('view:simulation',      'View simulation sandbox',          'Analysis',             'Run scenario simulations and trajectory projections'),
  ('view:ai',              'View AI nexus systems',            'Intelligence',         'Interact with cognitive analysis and predictive models'),
  ('view:archive',         'View historical archives',         'Administration',       'Inspect operational records and audit history'),
  ('view:analytics',       'View analytics dashboards',        'Analysis',             'Access statistical views and analytics reports'),
  ('view:reports',         'View generated reports',           'Analysis',             'Read published intelligence briefs and operations reports'),
  ('view:network',         'View relation graph',              'Intelligence',         'Explore relationship topologies and network graphs'),
  ('view:admin',           'View administration panel',        'Administration',       'Access administrative controls and user management'),
  ('incident:create',      'Create incidents',                 'Incidents',            'Declare and publish new incidents'),
  ('incident:transition',  'Advance incident state',           'Incidents',            'Advance incident state in lifecycle'),
  ('incident:assign',      'Assign response teams',            'Incidents',            'Deploy and assign response teams'),
  ('incident:note',        'Add investigation notes',          'Incidents',            'Append investigation log notes'),
  ('incident:evidence',    'Attach evidence',                  'Incidents',            'Attach files, telemetry, and evidence'),
  ('simulation:save',      'Save simulations',                 'Analysis',             'Persist simulation runs and test states'),
  ('analytics:edit',       'Edit dashboards',                  'Analysis',             'Create, edit, and reorganize analytical widgets'),
  ('report:create',        'Create reports',                   'Analysis',             'Draft intelligence and operational reports'),
  ('report:edit',          'Edit reports',                     'Analysis',             'Modify report text, findings, and blocks'),
  ('report:share',         'Share reports',                    'Analysis',             'Manage distribution lists and report access'),
  ('ai:use',               'Query AI models',                  'Intelligence',         'Issue queries and generate AI projections'),
  ('entity:note',          'Annotate entities',                'Situational Awareness','Attach operational notes to system entities'),
  ('notification:prefs',   'Manage notification prefs',        'Personal',             'Update alert channels, frequencies, and subscriptions'),
  ('admin:users',          'Manage users and clearances',      'Administration',       'Administer user status, clearances, and accounts'),
  ('admin:roles',          'Manage RBAC roles and permissions','Administration',       'Modify permission mappings and role definitions'),
  ('admin:audit',          'View audit logs',                  'Administration',       'Inspect security logs and activity records'),
  ('admin:settings',       'Manage system settings',           'Administration',       'Configure environment settings and parameters')
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- Upsert exact 6 system roles
INSERT INTO public.roles (id, name, description, rank) VALUES
  ('super_admin', 'Super Administrator',  'Unrestricted control of the operating environment, identity and security posture.', 100),
  ('sys_admin',   'System Administrator', 'Platform administration, audit oversight and configuration without role delegation.', 80),
  ('ops_manager', 'Operations Manager',   'Operational command, response assignment and cross-subsystem mitigation.', 70),
  ('analyst',     'Intelligence Analyst', 'Deep analytical access, incident investigation and reporting.', 60),
  ('researcher',  'Researcher',           'Simulation, historical analysis and research reporting.', 40),
  ('observer',    'Read-only Observer',   'Read-only situational awareness across declassified workspaces.', 10)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  rank = EXCLUDED.rank;

-- Populate role_permissions mapping idempotently (preserving existing custom role-permission mappings)
-- 1. super_admin: all 32 built-in permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'super_admin', id FROM public.permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 2. sys_admin: exactly 31 permissions (all except admin:roles)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'sys_admin', id FROM public.permissions
WHERE id IN (
  'view:overview', 'view:geoint', 'view:infrastructure', 'view:environment', 'view:economy',
  'view:mobility', 'view:energy', 'view:incidents', 'view:simulation', 'view:ai',
  'view:archive', 'view:analytics', 'view:reports', 'view:network', 'view:admin',
  'incident:create', 'incident:transition', 'incident:assign', 'incident:note', 'incident:evidence',
  'simulation:save', 'analytics:edit', 'report:create', 'report:edit', 'report:share',
  'ai:use', 'entity:note', 'notification:prefs', 'admin:users', 'admin:audit', 'admin:settings'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 3. ops_manager: exactly 27 permissions (14 view + 5 incident + 5 analysis + 3 misc)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'ops_manager', id FROM public.permissions
WHERE id IN (
  'view:overview', 'view:geoint', 'view:infrastructure', 'view:environment', 'view:economy',
  'view:mobility', 'view:energy', 'view:incidents', 'view:simulation', 'view:ai',
  'view:archive', 'view:analytics', 'view:reports', 'view:network',
  'incident:create', 'incident:transition', 'incident:assign', 'incident:note', 'incident:evidence',
  'simulation:save', 'analytics:edit', 'report:create', 'report:edit', 'report:share',
  'ai:use', 'entity:note', 'notification:prefs'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. analyst: exactly 26 permissions (14 view + 4 incident [no assign] + 5 analysis + 3 misc)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'analyst', id FROM public.permissions
WHERE id IN (
  'view:overview', 'view:geoint', 'view:infrastructure', 'view:environment', 'view:economy',
  'view:mobility', 'view:energy', 'view:incidents', 'view:simulation', 'view:ai',
  'view:archive', 'view:analytics', 'view:reports', 'view:network',
  'incident:create', 'incident:transition', 'incident:note', 'incident:evidence',
  'simulation:save', 'analytics:edit', 'report:create', 'report:edit', 'report:share',
  'ai:use', 'entity:note', 'notification:prefs'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 5. researcher: exactly 21 permissions (14 view + 4 analysis [no report:share] + 3 misc)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'researcher', id FROM public.permissions
WHERE id IN (
  'view:overview', 'view:geoint', 'view:infrastructure', 'view:environment', 'view:economy',
  'view:mobility', 'view:energy', 'view:incidents', 'view:simulation', 'view:ai',
  'view:archive', 'view:analytics', 'view:reports', 'view:network',
  'simulation:save', 'analytics:edit', 'report:create', 'report:edit',
  'ai:use', 'entity:note', 'notification:prefs'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 6. observer: exactly 15 permissions (14 view + 1 misc [notification:prefs])
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'observer', id FROM public.permissions
WHERE id IN (
  'view:overview', 'view:geoint', 'view:infrastructure', 'view:environment', 'view:economy',
  'view:mobility', 'view:energy', 'view:incidents', 'view:simulation', 'view:ai',
  'view:archive', 'view:analytics', 'view:reports', 'view:network',
  'notification:prefs'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Safe verification of built-in role and permission catalogs (preserves custom roles/permissions)
DO $$
DECLARE
  v_missing_perms    int;
  v_missing_roles    int;
  v_builtin_mappings int;
BEGIN
  -- Verify all 32 required built-in permissions exist
  SELECT count(*) INTO v_missing_perms
  FROM (
    VALUES
      ('view:overview'), ('view:geoint'), ('view:infrastructure'), ('view:environment'), ('view:economy'),
      ('view:mobility'), ('view:energy'), ('view:incidents'), ('view:simulation'), ('view:ai'),
      ('view:archive'), ('view:analytics'), ('view:reports'), ('view:network'), ('view:admin'),
      ('incident:create'), ('incident:transition'), ('incident:assign'), ('incident:note'), ('incident:evidence'),
      ('simulation:save'), ('analytics:edit'), ('report:create'), ('report:edit'), ('report:share'),
      ('ai:use'), ('entity:note'), ('notification:prefs'), ('admin:users'), ('admin:roles'),
      ('admin:audit'), ('admin:settings')
  ) AS expected(id)
  WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = expected.id);

  IF v_missing_perms > 0 THEN
    RAISE EXCEPTION 'Built-in permission catalog incomplete: % missing permissions', v_missing_perms;
  END IF;

  -- Verify all 6 required built-in roles exist
  SELECT count(*) INTO v_missing_roles
  FROM (
    VALUES ('super_admin'), ('sys_admin'), ('ops_manager'), ('analyst'), ('researcher'), ('observer')
  ) AS expected(id)
  WHERE NOT EXISTS (SELECT 1 FROM public.roles r WHERE r.id = expected.id);

  IF v_missing_roles > 0 THEN
    RAISE EXCEPTION 'Built-in role catalog incomplete: % missing roles', v_missing_roles;
  END IF;

  -- Verify expected built-in role-permission mappings (152 total across 6 built-in roles) without counting unrelated custom mappings
  SELECT count(*) INTO v_builtin_mappings
  FROM public.role_permissions
  WHERE role_id IN ('super_admin', 'sys_admin', 'ops_manager', 'analyst', 'researcher', 'observer')
    AND permission_id IN (
      'view:overview', 'view:geoint', 'view:infrastructure', 'view:environment', 'view:economy',
      'view:mobility', 'view:energy', 'view:incidents', 'view:simulation', 'view:ai',
      'view:archive', 'view:analytics', 'view:reports', 'view:network', 'view:admin',
      'incident:create', 'incident:transition', 'incident:assign', 'incident:note', 'incident:evidence',
      'simulation:save', 'analytics:edit', 'report:create', 'report:edit', 'report:share',
      'ai:use', 'entity:note', 'notification:prefs', 'admin:users', 'admin:roles',
      'admin:audit', 'admin:settings'
    );

  IF v_builtin_mappings < 152 THEN
    RAISE EXCEPTION 'Built-in role permissions mapping verification failed: expected at least 152, found %', v_builtin_mappings;
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. HARDENED SECURITY DEFINER HELPERS
-- ----------------------------------------------------------------------------

-- Helper: verify incident read access
CREATE OR REPLACE FUNCTION public.can_read_incident(p_incident_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_super_admin() THEN
    RETURN true;
  END IF;

  SELECT workspace_id INTO v_workspace_id
  FROM public.incidents
  WHERE id = p_incident_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_workspace_id IS NULL THEN
    RETURN public.has_permission('view:incidents');
  END IF;

  RETURN public.has_permission('view:incidents')
     AND public.can_access_workspace(v_workspace_id);
END;
$$;

-- Helper: client ID resolution with per-user isolation, authorization, and entity validation
CREATE OR REPLACE FUNCTION public.resolve_client_uuid(
  p_client_id text,
  p_entity_type text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id     uuid;
  v_user   uuid;
  v_exists boolean;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required for UUID resolution.';
  END IF;

  -- Profile identities must NEVER be resolved through client_id_map
  IF p_entity_type = 'profile' THEN
    RAISE EXCEPTION 'Profiles cannot be resolved via client_id_map; use verified profile UUIDs.';
  END IF;

  IF p_entity_type NOT IN ('incident', 'dashboard', 'dashboard_widget', 'report', 'report_block', 'entity', 'location') THEN
    RAISE EXCEPTION 'Invalid entity type: %', p_entity_type;
  END IF;

  IF p_client_id IS NULL OR pg_catalog.btrim(p_client_id) = '' THEN
    RETURN pg_catalog.gen_random_uuid();
  END IF;

  -- If caller supplied a valid UUID, validate access to existing records
  BEGIN
    v_id := p_client_id::uuid;

    IF p_entity_type = 'incident' THEN
      SELECT EXISTS (SELECT 1 FROM public.incidents WHERE id = v_id) INTO v_exists;
      IF v_exists AND NOT public.can_read_incident(v_id) THEN
        RAISE EXCEPTION 'permission denied: unauthorized incident UUID %', v_id;
      END IF;
    ELSIF p_entity_type = 'dashboard' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.dashboards
        WHERE id = v_id
          AND (
            owner = v_user
            OR (workspace_id IS NOT NULL AND public.can_access_workspace(workspace_id))
            OR public.is_super_admin()
          )
      ) INTO v_exists;
      IF EXISTS (SELECT 1 FROM public.dashboards WHERE id = v_id) AND NOT v_exists THEN
        RAISE EXCEPTION 'permission denied: unauthorized dashboard UUID %', v_id;
      END IF;
    ELSIF p_entity_type = 'report' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.reports
        WHERE id = v_id
          AND (
            author = v_user
            OR v_user = ANY(shared_with)
            OR (
              classification != 'restricted'
              AND (
                (
                  status = 'published'
                  AND workspace_id IS NULL
                  AND public.has_permission('view:reports')
                )
                OR (
                  workspace_id IS NOT NULL
                  AND public.can_access_workspace(workspace_id)
                )
              )
            )
            OR public.is_super_admin()
          )
      ) INTO v_exists;
      IF EXISTS (SELECT 1 FROM public.reports WHERE id = v_id) AND NOT v_exists THEN
        RAISE EXCEPTION 'permission denied: unauthorized report UUID %', v_id;
      END IF;
    END IF;

    RETURN v_id;
  EXCEPTION WHEN invalid_text_representation THEN
    -- Fall through to persistent lookup for slug strings
  END;

  SELECT db_id INTO v_id
  FROM public.client_id_map
  WHERE created_by = v_user
    AND client_id = p_client_id
    AND entity_type = p_entity_type;

  IF v_id IS NULL THEN
    INSERT INTO public.client_id_map (created_by, client_id, entity_type)
    VALUES (v_user, p_client_id, p_entity_type)
    RETURNING db_id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. HARDENED STORED PROCEDURES (SECURITY DEFINER + search_path)
-- ----------------------------------------------------------------------------

-- A. transition_incident: Preserves (uuid, incident_status, text) -> public.incidents
CREATE OR REPLACE FUNCTION public.transition_incident(
  p_incident uuid,
  p_next     public.incident_status,
  p_detail   text DEFAULT NULL
)
RETURNS public.incidents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current public.incidents;
  v_allowed boolean;
  v_from    public.incident_status;
BEGIN
  -- Authenticated caller authority check
  IF NOT public.has_permission('incident:transition') THEN
    RAISE EXCEPTION 'permission denied: incident:transition';
  END IF;

  -- 1. Preserve row-level lock
  SELECT * INTO v_current
  FROM public.incidents
  WHERE id = p_incident
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'incident not found';
  END IF;

  -- 2. Validate caller workspace access (Option A: workspace-less incidents require view:incidents)
  IF v_current.workspace_id IS NULL THEN
    IF NOT public.has_permission('view:incidents') AND NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'permission denied: view:incidents required for global incident';
    END IF;
  ELSE
    IF NOT public.can_access_workspace(v_current.workspace_id) AND NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'permission denied: unauthorized workspace access';
    END IF;
  END IF;

  -- 3. Strict state machine enforcement
  v_allowed := CASE
    WHEN v_current.status = 'detected' AND p_next IN ('investigating','assigned') THEN true
    WHEN v_current.status = 'investigating' AND p_next IN ('assigned','mitigating') THEN true
    WHEN v_current.status = 'assigned' AND p_next IN ('investigating','mitigating') THEN true
    WHEN v_current.status = 'mitigating' AND p_next IN ('resolved','assigned') THEN true
    WHEN v_current.status = 'resolved' AND p_next = 'archived' THEN true
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'invalid incident transition: % -> %', v_current.status, p_next;
  END IF;

  v_from := v_current.status;

  -- 4. Update status and timestamp
  UPDATE public.incidents
  SET status = p_next,
      resolved_at = CASE WHEN p_next = 'resolved' THEN pg_catalog.now() ELSE resolved_at END,
      updated_at = pg_catalog.now()
  WHERE id = p_incident
  RETURNING * INTO v_current;

  -- 5. Append-only event history via trusted RPC
  INSERT INTO public.incident_events(incident_id, actor, event_type, from_status, to_status, detail)
  VALUES (p_incident, auth.uid(), 'status_transition', v_from, p_next, COALESCE(p_detail, ''));

  -- 6. Tamper-evident audit log
  INSERT INTO public.audit_logs(actor, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'incident.transition', 'incident', p_incident::text, pg_catalog.jsonb_build_object('from', v_from, 'to', p_next));

  -- 7. High-priority notification on incident resolution
  IF p_next = 'resolved' AND v_current.commander IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, category, priority, title, body, href)
    VALUES (
      v_current.commander,
      'incident',
      'high',
      'Incident resolved',
      v_current.reference || ' has been transitioned to resolved.',
      '/incidents/' || p_incident
    );
  END IF;

  RETURN v_current;
END;
$$;

-- B. assign_incident: Preserves (uuid, text, uuid) with lead profile validation
CREATE OR REPLACE FUNCTION public.assign_incident(
  p_incident uuid,
  p_team     text,
  p_lead     uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_incident    record;
  v_lead_status text;
BEGIN
  -- 1. Validate caller permission
  IF NOT public.has_permission('incident:assign') THEN
    RAISE EXCEPTION 'permission denied: incident:assign';
  END IF;

  -- 2. Validate incident exists
  SELECT id, workspace_id, reference INTO v_incident
  FROM public.incidents
  WHERE id = p_incident;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'incident not found: %', p_incident;
  END IF;

  -- 3. Validate caller can access incident workspace (Option A: workspace-less incidents require view:incidents)
  IF v_incident.workspace_id IS NULL THEN
    IF NOT public.has_permission('view:incidents') AND NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'permission denied: view:incidents required for global incident';
    END IF;
  ELSE
    IF NOT public.can_access_workspace(v_incident.workspace_id) AND NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'permission denied: caller cannot access incident workspace';
    END IF;
  END IF;

  -- 4. Validate assigned lead profile
  IF p_lead IS NOT NULL THEN
    SELECT status INTO v_lead_status
    FROM public.profiles
    WHERE id = p_lead;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'assigned lead profile does not exist: %', p_lead;
    END IF;

    IF v_lead_status != 'active' THEN
      RAISE EXCEPTION 'assigned lead profile % is not active (status: %)', p_lead, v_lead_status;
    END IF;

    -- Validate lead is actually a member of the incident workspace
    IF v_incident.workspace_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = v_incident.workspace_id AND user_id = p_lead
      ) THEN
        RAISE EXCEPTION 'assigned lead % is not a member of incident workspace %', p_lead, v_incident.workspace_id;
      END IF;
    END IF;
  END IF;

  -- 5. Record assignment
  INSERT INTO public.incident_assignments (incident_id, team, lead)
  VALUES (p_incident, p_team, p_lead);

  -- 6. Append event history
  INSERT INTO public.incident_events (incident_id, actor, event_type, detail)
  VALUES (p_incident, auth.uid(), 'assignment', 'Assigned to ' || p_team);

  -- 7. Audit log
  INSERT INTO public.audit_logs (actor, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'incident.assign', 'incident', p_incident::text, pg_catalog.jsonb_build_object('team', p_team, 'lead', p_lead));

  IF p_lead IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, category, priority, title, body, href)
    VALUES (p_lead, 'assignment', 'high', 'Incident assignment', 'You were assigned to ' || v_incident.reference, '/incidents/' || p_incident);
  END IF;
END;
$$;

-- C. log_audit: Restricts direct client actions to an explicit allowlist and binds actor to auth.uid()
CREATE OR REPLACE FUNCTION public.log_audit(
  p_action      text,
  p_target_type text,
  p_target_id   text,
  p_metadata    jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user             uuid;
  v_is_client_action boolean;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required for audit logging.';
  END IF;

  IF p_action IS NULL OR pg_catalog.btrim(p_action) = '' THEN
    RAISE EXCEPTION 'Audit action cannot be null or empty.';
  END IF;

  -- Validate target type
  IF p_target_type NOT IN ('incident', 'dashboard', 'report', 'entity', 'simulation', 'workspace', 'profile', 'system') THEN
    RAISE EXCEPTION 'Invalid audit target type: %', p_target_type;
  END IF;

  -- Validate metadata object structure
  IF p_metadata IS NULL OR pg_catalog.jsonb_typeof(p_metadata) != 'object' THEN
    RAISE EXCEPTION 'Audit metadata must be a valid JSON object.';
  END IF;

  -- Client action allowlist: Only explicitly permitted non-privileged actions are accepted from the client.
  -- Privileged events (incident.transition, incident.assign, user.role.assign) are emitted by trusted RPCs.
  -- Note: admin:audit alone does NOT permit arbitrary privileged audit fabrication.
  v_is_client_action := p_action IN (
    'ui.interaction',
    'dashboard.view',
    'report.view',
    'incident.view',
    'telemetry.inspect',
    'simulation.run'
  );

  IF NOT v_is_client_action THEN
    RAISE EXCEPTION 'permission denied: action % is not an authorized client audit action', p_action;
  END IF;

  INSERT INTO public.audit_logs (actor, action, target_type, target_id, metadata, created_at)
  VALUES (v_user, p_action, p_target_type, p_target_id, p_metadata, pg_catalog.now());
END;
$$;

-- D. assign_user_role: Super-admin user role assignment with validation and trusted audit logging
CREATE OR REPLACE FUNCTION public.assign_user_role(
  p_user uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'permission denied: super administrator required';
  END IF;

  IF p_user IS NULL THEN
    RAISE EXCEPTION 'target user id cannot be null';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user) THEN
    RAISE EXCEPTION 'target user profile does not exist: %', p_user;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE id = p_role) THEN
    RAISE EXCEPTION 'unknown role: %', p_role;
  END IF;

  UPDATE public.profiles
  SET role_id = p_role
  WHERE id = p_user;

  INSERT INTO public.audit_logs(actor, action, target_type, target_id, metadata, created_at)
  VALUES (auth.uid(), 'user.role.assign', 'profile', p_user::text, pg_catalog.jsonb_build_object('role', p_role), pg_catalog.now());
END;
$$;

-- E. save_dashboard_atomic: Single transaction for parent dashboard & child widgets
CREATE OR REPLACE FUNCTION public.save_dashboard_atomic(
  p_dashboard_id  uuid,
  p_name          text,
  p_description   text,
  p_widgets       jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user        uuid;
  v_existing    record;
  v_widget      jsonb;
  v_widget_id   uuid;
  v_widget_ids  uuid[] := '{}';
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT public.has_permission('analytics:edit') THEN
    RAISE EXCEPTION 'permission denied: analytics:edit';
  END IF;

  SELECT id, owner, workspace_id INTO v_existing
  FROM public.dashboards
  WHERE id = p_dashboard_id;

  IF FOUND THEN
    IF v_existing.owner != v_user
       AND (v_existing.workspace_id IS NULL OR NOT EXISTS (
         SELECT 1 FROM public.workspace_members
         WHERE workspace_id = v_existing.workspace_id AND user_id = v_user AND access_level IN ('owner', 'editor')
       ))
       AND NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'permission denied: cannot edit dashboard %', p_dashboard_id;
    END IF;

    UPDATE public.dashboards
    SET name = p_name,
        description = COALESCE(p_description, ''),
        layout = COALESCE(p_widgets, '[]'::jsonb),
        updated_at = pg_catalog.now()
    WHERE id = p_dashboard_id;
  ELSE
    INSERT INTO public.dashboards (id, owner, name, description, layout, created_at, updated_at)
    VALUES (
      p_dashboard_id,
      v_user,
      p_name,
      COALESCE(p_description, ''),
      COALESCE(p_widgets, '[]'::jsonb),
      pg_catalog.now(),
      pg_catalog.now()
    );
  END IF;

  -- Synchronize widgets
  IF p_widgets IS NOT NULL AND pg_catalog.jsonb_array_length(p_widgets) > 0 THEN
    FOR v_widget IN SELECT * FROM pg_catalog.jsonb_array_elements(p_widgets)
    LOOP
      v_widget_id := (v_widget->>'id')::uuid;
      v_widget_ids := pg_catalog.array_append(v_widget_ids, v_widget_id);

      -- Reject attempts to modify widgets belonging to another dashboard
      IF EXISTS (
        SELECT 1 FROM public.dashboard_widgets
        WHERE id = v_widget_id AND dashboard_id != p_dashboard_id
      ) THEN
        RAISE EXCEPTION 'permission denied: widget % belongs to another dashboard', v_widget_id;
      END IF;

      INSERT INTO public.dashboard_widgets (id, dashboard_id, title, widget_type, config, position)
      VALUES (
        v_widget_id,
        p_dashboard_id,
        COALESCE(v_widget->>'title', 'Untitled Widget'),
        COALESCE(v_widget->>'widget_type', 'stat_value'),
        COALESCE(v_widget->'config', '{}'::jsonb),
        COALESCE((v_widget->>'position')::integer, 0)
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        widget_type = EXCLUDED.widget_type,
        config = EXCLUDED.config,
        position = EXCLUDED.position;
    END LOOP;

    DELETE FROM public.dashboard_widgets
    WHERE dashboard_id = p_dashboard_id
      AND NOT (id = ANY(v_widget_ids));
  ELSE
    DELETE FROM public.dashboard_widgets
    WHERE dashboard_id = p_dashboard_id;
  END IF;

  RETURN true;
END;
$$;

-- F. save_report_atomic: Single transaction for parent report & child blocks
CREATE OR REPLACE FUNCTION public.save_report_atomic(
  p_report_id       uuid,
  p_title           text,
  p_template        text,
  p_classification  text,
  p_status          public.report_status,
  p_summary         text,
  p_blocks          jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user        uuid;
  v_existing    record;
  v_block       jsonb;
  v_block_id    uuid;
  v_block_ids   uuid[] := '{}';
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT id, author, workspace_id INTO v_existing
  FROM public.reports
  WHERE id = p_report_id;

  IF FOUND THEN
    IF NOT public.has_permission('report:edit') THEN
      RAISE EXCEPTION 'permission denied: report:edit';
    END IF;

    IF v_existing.author != v_user
       AND (v_existing.workspace_id IS NULL OR NOT EXISTS (
         SELECT 1 FROM public.workspace_members
         WHERE workspace_id = v_existing.workspace_id AND user_id = v_user AND access_level IN ('owner', 'editor')
       ))
       AND NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'permission denied: cannot edit report %', p_report_id;
    END IF;

    UPDATE public.reports
    SET title = p_title,
        template = COALESCE(p_template, 'intelligence_brief'),
        classification = COALESCE(p_classification, 'internal'),
        status = p_status,
        summary = COALESCE(p_summary, ''),
        updated_at = pg_catalog.now()
    WHERE id = p_report_id;
  ELSE
    IF NOT public.has_permission('report:create') THEN
      RAISE EXCEPTION 'permission denied: report:create';
    END IF;

    INSERT INTO public.reports (id, author, title, template, classification, status, summary, created_at, updated_at)
    VALUES (
      p_report_id,
      v_user,
      p_title,
      COALESCE(p_template, 'intelligence_brief'),
      COALESCE(p_classification, 'internal'),
      p_status,
      COALESCE(p_summary, ''),
      pg_catalog.now(),
      pg_catalog.now()
    );
  END IF;

  -- Synchronize blocks
  IF p_blocks IS NOT NULL AND pg_catalog.jsonb_array_length(p_blocks) > 0 THEN
    FOR v_block IN SELECT * FROM pg_catalog.jsonb_array_elements(p_blocks)
    LOOP
      v_block_id := (v_block->>'id')::uuid;
      v_block_ids := pg_catalog.array_append(v_block_ids, v_block_id);

      -- Reject attempts to modify blocks belonging to another report
      IF EXISTS (
        SELECT 1 FROM public.report_blocks
        WHERE id = v_block_id AND report_id != p_report_id
      ) THEN
        RAISE EXCEPTION 'permission denied: report block % belongs to another report', v_block_id;
      END IF;

      INSERT INTO public.report_blocks (id, report_id, position, block_type, content)
      VALUES (
        v_block_id,
        p_report_id,
        COALESCE((v_block->>'position')::integer, 0),
        COALESCE(v_block->>'block_type', 'paragraph'),
        COALESCE(v_block->'content', '{}'::jsonb)
      )
      ON CONFLICT (id) DO UPDATE SET
        position = EXCLUDED.position,
        block_type = EXCLUDED.block_type,
        content = EXCLUDED.content;
    END LOOP;

    DELETE FROM public.report_blocks
    WHERE report_id = p_report_id
      AND NOT (id = ANY(v_block_ids));
  ELSE
    DELETE FROM public.report_blocks
    WHERE report_id = p_report_id;
  END IF;

  RETURN true;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. DROP VULNERABLE PERMISSIVE POLICIES FROM 0002_rls.sql
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "incidents readable" ON public.incidents;
DROP POLICY IF EXISTS "incidents_select" ON public.incidents;
DROP POLICY IF EXISTS "incidents_insert" ON public.incidents;
DROP POLICY IF EXISTS "incidents_update" ON public.incidents;
DROP POLICY IF EXISTS "incidents_delete" ON public.incidents;

DROP POLICY IF EXISTS "assignments readable" ON public.incident_assignments;
DROP POLICY IF EXISTS "incident events readable" ON public.incident_events;
DROP POLICY IF EXISTS "incident notes readable" ON public.incident_notes;
DROP POLICY IF EXISTS "incident notes inserted" ON public.incident_notes;
DROP POLICY IF EXISTS "incident notes edited" ON public.incident_notes;
DROP POLICY IF EXISTS "incident notes deleted" ON public.incident_notes;
DROP POLICY IF EXISTS "evidence readable" ON public.incident_evidence;
DROP POLICY IF EXISTS "evidence inserted" ON public.incident_evidence;

DROP POLICY IF EXISTS "dashboards owned or shared" ON public.dashboards;
DROP POLICY IF EXISTS "dashboards inserted" ON public.dashboards;
DROP POLICY IF EXISTS "dashboards updated" ON public.dashboards;
DROP POLICY IF EXISTS "dashboards deleted" ON public.dashboards;
DROP POLICY IF EXISTS "widgets visible" ON public.dashboard_widgets;
DROP POLICY IF EXISTS "widgets managed" ON public.dashboard_widgets;

DROP POLICY IF EXISTS "reports readable" ON public.reports;
DROP POLICY IF EXISTS "reports created" ON public.reports;
DROP POLICY IF EXISTS "reports updated" ON public.reports;
DROP POLICY IF EXISTS "report blocks readable" ON public.report_blocks;
DROP POLICY IF EXISTS "report blocks managed" ON public.report_blocks;

-- ----------------------------------------------------------------------------
-- 6. RECREATE HARDENED ROW LEVEL SECURITY POLICIES
-- ----------------------------------------------------------------------------

-- A. Client ID Map Policies
DROP POLICY IF EXISTS "client_id_map_select" ON public.client_id_map;
DROP POLICY IF EXISTS "client_id_map_insert" ON public.client_id_map;

CREATE POLICY "client_id_map_select" ON public.client_id_map
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "client_id_map_insert" ON public.client_id_map
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- B. Incidents (Parent Table: Workspace-Scoped & Theater-Wide Operational Incidents)
CREATE POLICY "incidents_select" ON public.incidents
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (workspace_id IS NULL AND public.has_permission('view:incidents'))
    OR (workspace_id IS NOT NULL AND public.has_permission('view:incidents') AND public.can_access_workspace(workspace_id))
  );

CREATE POLICY "incidents_insert" ON public.incidents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.has_permission('incident:create')
      AND (workspace_id IS NULL OR public.can_access_workspace(workspace_id))
    )
  );

CREATE POLICY "incidents_update" ON public.incidents
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      (public.has_permission('incident:transition') OR public.has_permission('manage:incidents'))
      AND (
        (workspace_id IS NULL AND public.has_permission('view:incidents'))
        OR (workspace_id IS NOT NULL AND public.can_access_workspace(workspace_id))
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      (public.has_permission('incident:transition') OR public.has_permission('manage:incidents'))
      AND (
        (workspace_id IS NULL AND public.has_permission('view:incidents'))
        OR (workspace_id IS NOT NULL AND public.can_access_workspace(workspace_id))
      )
    )
  );

CREATE POLICY "incidents_delete" ON public.incidents
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR public.has_permission('admin:settings')
  );

-- C. Incident Assignments
CREATE POLICY "incident_assignments_select" ON public.incident_assignments
  FOR SELECT TO authenticated
  USING (public.can_read_incident(incident_id));

CREATE POLICY "incident_assignments_insert" ON public.incident_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('incident:assign')
    AND public.can_read_incident(incident_id)
    AND (
      incident_assignments.lead IS NULL
      OR (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = incident_assignments.lead
            AND p.status = 'active'
        )
        AND (
          (SELECT workspace_id FROM public.incidents WHERE id = incident_assignments.incident_id) IS NULL
          OR EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = (SELECT workspace_id FROM public.incidents WHERE id = incident_assignments.incident_id)
              AND wm.user_id = incident_assignments.lead
          )
        )
      )
    )
  );

CREATE POLICY "incident_assignments_update" ON public.incident_assignments
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('incident:assign')
    AND public.can_read_incident(incident_id)
  )
  WITH CHECK (
    public.has_permission('incident:assign')
    AND public.can_read_incident(incident_id)
    AND (
      incident_assignments.lead IS NULL
      OR (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = incident_assignments.lead
            AND p.status = 'active'
        )
        AND (
          (SELECT workspace_id FROM public.incidents WHERE id = incident_assignments.incident_id) IS NULL
          OR EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = (SELECT workspace_id FROM public.incidents WHERE id = incident_assignments.incident_id)
              AND wm.user_id = incident_assignments.lead
          )
        )
      )
    )
  );

CREATE POLICY "incident_assignments_delete" ON public.incident_assignments
  FOR DELETE TO authenticated
  USING (
    public.has_permission('incident:assign')
    AND public.can_read_incident(incident_id)
  );

-- D. Incident Events: Strictly Read-Only for Clients (Append-only through trusted RPCs)
DROP POLICY IF EXISTS "incident_events_select" ON public.incident_events;
DROP POLICY IF EXISTS "incident_events_insert" ON public.incident_events;

CREATE POLICY "incident_events_select" ON public.incident_events
  FOR SELECT TO authenticated
  USING (public.can_read_incident(incident_id));

-- E. Incident Notes: Checks parent incident access on update, delete, and insert
CREATE POLICY "incident_notes_select" ON public.incident_notes
  FOR SELECT TO authenticated
  USING (public.can_read_incident(incident_id));

CREATE POLICY "incident_notes_insert" ON public.incident_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    author = auth.uid()
    AND public.has_permission('incident:note')
    AND public.can_read_incident(incident_id)
  );

CREATE POLICY "incident_notes_update" ON public.incident_notes
  FOR UPDATE TO authenticated
  USING (
    author = auth.uid()
    AND public.has_permission('incident:note')
    AND public.can_read_incident(incident_id)
  )
  WITH CHECK (
    author = auth.uid()
    AND public.has_permission('incident:note')
    AND public.can_read_incident(incident_id)
  );

CREATE POLICY "incident_notes_delete" ON public.incident_notes
  FOR DELETE TO authenticated
  USING (
    public.can_read_incident(incident_id)
    AND (
      (author = auth.uid() AND public.has_permission('incident:note'))
      OR public.has_permission('admin:settings')
      OR public.is_super_admin()
    )
  );

-- F. Incident Evidence: Checks parent incident access on update and delete
CREATE POLICY "incident_evidence_select" ON public.incident_evidence
  FOR SELECT TO authenticated
  USING (public.can_read_incident(incident_id));

CREATE POLICY "incident_evidence_insert" ON public.incident_evidence
  FOR INSERT TO authenticated
  WITH CHECK (
    added_by = auth.uid()
    AND public.has_permission('incident:evidence')
    AND public.can_read_incident(incident_id)
  );

CREATE POLICY "incident_evidence_update" ON public.incident_evidence
  FOR UPDATE TO authenticated
  USING (
    added_by = auth.uid()
    AND public.has_permission('incident:evidence')
    AND public.can_read_incident(incident_id)
  )
  WITH CHECK (
    added_by = auth.uid()
    AND public.has_permission('incident:evidence')
    AND public.can_read_incident(incident_id)
  );

CREATE POLICY "incident_evidence_delete" ON public.incident_evidence
  FOR DELETE TO authenticated
  USING (
    public.can_read_incident(incident_id)
    AND (
      (added_by = auth.uid() AND public.has_permission('incident:evidence'))
      OR public.has_permission('admin:settings')
      OR public.is_super_admin()
    )
  );

-- G. Dashboards & Widgets
CREATE POLICY "dashboards_select" ON public.dashboards
  FOR SELECT TO authenticated
  USING (
    owner = auth.uid()
    OR (workspace_id IS NOT NULL AND public.can_access_workspace(workspace_id))
    OR public.is_super_admin()
  );

CREATE POLICY "dashboards_insert" ON public.dashboards
  FOR INSERT TO authenticated
  WITH CHECK (
    owner = auth.uid()
    AND public.has_permission('analytics:edit')
    AND (workspace_id IS NULL OR public.can_access_workspace(workspace_id))
  );

CREATE POLICY "dashboards_update" ON public.dashboards
  FOR UPDATE TO authenticated
  USING (
    (owner = auth.uid() AND public.has_permission('analytics:edit'))
    OR (workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = dashboards.workspace_id
        AND user_id = auth.uid()
        AND access_level IN ('owner', 'editor')
    ))
    OR public.is_super_admin()
  )
  WITH CHECK (
    (owner = auth.uid() AND public.has_permission('analytics:edit'))
    OR (workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = dashboards.workspace_id
        AND user_id = auth.uid()
        AND access_level IN ('owner', 'editor')
    ))
    OR public.is_super_admin()
  );

CREATE POLICY "dashboards_delete" ON public.dashboards
  FOR DELETE TO authenticated
  USING (
    (owner = auth.uid() AND public.has_permission('analytics:edit'))
    OR (workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = dashboards.workspace_id
        AND user_id = auth.uid()
        AND access_level = 'owner'
    ))
    OR public.has_permission('admin:settings')
    OR public.is_super_admin()
  );

CREATE POLICY "dashboard_widgets_select" ON public.dashboard_widgets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboards d
      WHERE d.id = dashboard_widgets.dashboard_id
        AND (
          d.owner = auth.uid()
          OR (d.workspace_id IS NOT NULL AND public.can_access_workspace(d.workspace_id))
          OR public.is_super_admin()
        )
    )
  );

CREATE POLICY "dashboard_widgets_insert" ON public.dashboard_widgets
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dashboards d
      WHERE d.id = dashboard_widgets.dashboard_id
        AND (
          (d.owner = auth.uid() AND public.has_permission('analytics:edit'))
          OR (d.workspace_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_id = d.workspace_id
              AND user_id = auth.uid()
              AND access_level IN ('owner', 'editor')
          ))
          OR public.is_super_admin()
        )
    )
  );

CREATE POLICY "dashboard_widgets_update" ON public.dashboard_widgets
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboards d
      WHERE d.id = dashboard_widgets.dashboard_id
        AND (
          (d.owner = auth.uid() AND public.has_permission('analytics:edit'))
          OR (d.workspace_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_id = d.workspace_id
              AND user_id = auth.uid()
              AND access_level IN ('owner', 'editor')
          ))
          OR public.is_super_admin()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dashboards d
      WHERE d.id = dashboard_widgets.dashboard_id
        AND (
          (d.owner = auth.uid() AND public.has_permission('analytics:edit'))
          OR (d.workspace_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_id = d.workspace_id
              AND user_id = auth.uid()
              AND access_level IN ('owner', 'editor')
          ))
          OR public.is_super_admin()
        )
    )
  );

CREATE POLICY "dashboard_widgets_delete" ON public.dashboard_widgets
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboards d
      WHERE d.id = dashboard_widgets.dashboard_id
        AND (
          (d.owner = auth.uid() AND public.has_permission('analytics:edit'))
          OR (d.workspace_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_id = d.workspace_id
              AND user_id = auth.uid()
              AND access_level = 'owner'
          ))
          OR public.has_permission('admin:settings')
          OR public.is_super_admin()
        )
    )
  );

-- H. Reports & Blocks
CREATE POLICY "reports_select" ON public.reports
  FOR SELECT TO authenticated
  USING (
    author = auth.uid()
    OR auth.uid() = ANY(shared_with)
    OR (
      classification != 'restricted'
      AND (
        (
          status = 'published'
          AND workspace_id IS NULL
          AND public.has_permission('view:reports')
        )
        OR (
          workspace_id IS NOT NULL
          AND public.can_access_workspace(workspace_id)
        )
      )
    )
    OR public.is_super_admin()
  );

CREATE POLICY "reports_insert" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (
    author = auth.uid()
    AND public.has_permission('report:create')
    AND (workspace_id IS NULL OR public.can_access_workspace(workspace_id))
  );

CREATE POLICY "reports_update" ON public.reports
  FOR UPDATE TO authenticated
  USING (
    (author = auth.uid() AND public.has_permission('report:edit'))
    OR (workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = reports.workspace_id
        AND user_id = auth.uid()
        AND access_level IN ('owner', 'editor')
    ))
    OR public.is_super_admin()
  )
  WITH CHECK (
    (author = auth.uid() AND public.has_permission('report:edit'))
    OR (workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = reports.workspace_id
        AND user_id = auth.uid()
        AND access_level IN ('owner', 'editor')
    ))
    OR public.is_super_admin()
  );

CREATE POLICY "reports_delete" ON public.reports
  FOR DELETE TO authenticated
  USING (
    (author = auth.uid() AND (public.has_permission('report:edit') OR public.has_permission('report:create')))
    OR (workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = reports.workspace_id
        AND user_id = auth.uid()
        AND access_level = 'owner'
    ))
    OR public.has_permission('admin:settings')
    OR public.is_super_admin()
  );

CREATE POLICY "report_blocks_select" ON public.report_blocks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_blocks.report_id
        AND (
          r.author = auth.uid()
          OR auth.uid() = ANY(r.shared_with)
          OR (
            r.classification != 'restricted'
            AND (
              (
                r.status = 'published'
                AND r.workspace_id IS NULL
                AND public.has_permission('view:reports')
              )
              OR (
                r.workspace_id IS NOT NULL
                AND public.can_access_workspace(r.workspace_id)
              )
            )
          )
          OR public.is_super_admin()
        )
    )
  );

CREATE POLICY "report_blocks_insert" ON public.report_blocks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_blocks.report_id
        AND (
          (r.author = auth.uid() AND public.has_permission('report:edit'))
          OR (r.workspace_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_id = r.workspace_id
              AND user_id = auth.uid()
              AND access_level IN ('owner', 'editor')
          ))
          OR public.is_super_admin()
        )
    )
  );

CREATE POLICY "report_blocks_update" ON public.report_blocks
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_blocks.report_id
        AND (
          (r.author = auth.uid() AND public.has_permission('report:edit'))
          OR (r.workspace_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_id = r.workspace_id
              AND user_id = auth.uid()
              AND access_level IN ('owner', 'editor')
          ))
          OR public.is_super_admin()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_blocks.report_id
        AND (
          (r.author = auth.uid() AND public.has_permission('report:edit'))
          OR (r.workspace_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_id = r.workspace_id
              AND user_id = auth.uid()
              AND access_level IN ('owner', 'editor')
          ))
          OR public.is_super_admin()
        )
    )
  );

CREATE POLICY "report_blocks_delete" ON public.report_blocks
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_blocks.report_id
        AND (
          (r.author = auth.uid() AND (public.has_permission('report:edit') OR public.has_permission('report:create')))
          OR (r.workspace_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_id = r.workspace_id
              AND user_id = auth.uid()
              AND access_level = 'owner'
          ))
          OR public.has_permission('admin:settings')
          OR public.is_super_admin()
        )
    )
  );

-- View Security: Ensure security_invoker = true so underlying table RLS applies
ALTER VIEW public.v_operational_theater SET (security_invoker = true);

-- ----------------------------------------------------------------------------
-- 7. SAFE SUPABASE AUTH PROVISIONING TRIGGER (Observer Default)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_display_name text;
BEGIN
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'name',
    pg_catalog.split_part(NEW.email, '@', 1)
  );

  -- 1. Insert Profile: FORCED role 'observer', 'L1' clearance, 'active'
  -- Zero privilege escalation: Self-service cannot provision sys_admin or super_admin
  INSERT INTO public.profiles (
    id,
    display_name,
    email,
    role_id,
    title,
    clearance,
    status
  )
  VALUES (
    NEW.id,
    v_display_name,
    NEW.email,
    'observer',
    'Observer',
    'L1',
    'active'
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Insert Default Notification Preferences
  INSERT INTO public.notification_preferences (
    user_id,
    incident_updates,
    assignments,
    simulations,
    workspace_activity,
    system_alerts,
    digest_frequency
  )
  VALUES (
    NEW.id,
    true,
    true,
    true,
    true,
    true,
    'realtime'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 8. EXPLICIT LEAST-PRIVILEGE TABLE & FUNCTION GRANTS & REVOKES
-- ----------------------------------------------------------------------------

-- A. Table Privileges on client_id_map
REVOKE ALL ON TABLE public.client_id_map FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.client_id_map TO authenticated;

-- B. Revoke all public and anon execution on functions
REVOKE ALL ON FUNCTION public.transition_incident(uuid, public.incident_status, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_incident(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_user_role(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_audit(text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_client_uuid(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_incident(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_dashboard_atomic(uuid, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_report_atomic(uuid, text, text, text, public.report_status, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- C. Grant authenticated execution
GRANT EXECUTE ON FUNCTION public.transition_incident(uuid, public.incident_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_incident(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit(text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_client_uuid(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_incident(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_dashboard_atomic(uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_report_atomic(uuid, text, text, text, public.report_status, text, jsonb) TO authenticated;

COMMIT;
