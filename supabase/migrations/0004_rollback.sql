-- ============================================================================
-- NEXUS // OMNIVERSE — SECURITY-PRESERVING RECOVERY SCRIPT (ROLLBACK MIGRATION 0004)
-- Target: Supabase / PostgreSQL 15+
-- ============================================================================
-- ROLLBACK SEMANTICS & SAFETY ADVISORY:
-- This script is a SECURITY-PRESERVING RECOVERY SCRIPT, NOT a complete byte-for-byte
-- restoration of the pre-0004 database state. It is designed to safely recover
-- platform operations if migration 0004 must be reverted, while strictly refusing
-- to re-introduce known security vulnerabilities from the original 0002 baseline.
--
-- 1. Intentional Non-Restoration of Vulnerable 0002 Policies:
--    - Does NOT restore `incidents readable` (`USING (workspace_id IS NULL OR can_access_workspace(workspace_id))`),
--      which would expose theater-wide operational incidents to unprivileged callers.
--      Instead, Option A is enforced (`workspace_id IS NULL AND has_permission('view:incidents')`).
--    - Does NOT restore permissive `USING (true)` policies on sensitive operational
--      child tables (`incident_assignments`, `incident_events`, `incident_notes`, `incident_evidence`).
--    - Does NOT restore the `admin:audit` client bypass in `log_audit()`.
--
-- 2. Intentionally Preserved Schema Elements (Non-Reversible Data Continuity):
--    - `public.dashboards.description` is PRESERVED to avoid destructive column deletion
--      and protect user-entered descriptions and frontend TypeScript contracts.
--    - `public.client_id_map` is PRESERVED with strict per-user RLS to maintain
--      persistent client-to-database UUID continuity for bookmarked URLs.
--    - `ALTER VIEW public.v_operational_theater SET (security_invoker = true);` is
--      PRESERVED so that underlying table RLS continues to be enforced.
--
-- 3. Dependency Order: Policies referencing `public.can_read_incident(uuid)`
--    are dropped BEFORE the helper function is dropped, avoiding PostgreSQL ERROR 2BP01.
--
-- 4. Incident Assignment Integrity:
--    RLS policies for `incident_assignments` enforce lead profile existence,
--    active status, and workspace membership on both INSERT and UPDATE (WITH CHECK).
--    Unassigned teams (`lead IS NULL`) are permitted, but invalid or cross-tenant
--    lead assignments fail directly at the database RLS layer.
--
-- 5. Audit Log Anti-Spoofing:
--    `public.log_audit()` binds `actor = auth.uid()` unconditionally, validates
--    target types and metadata, and restricts client calls to an explicit allowlist.
--    Privileged actions are emitted only by trusted internal procedures.
--
-- 6. Auth Provisioning Baseline:
--    `handle_new_user()` and `on_auth_user_created` trigger are restored with
--    exact 0001 schema baseline defaults ('observer', 'L1', 'active') so new
--    signups do not silently fail closed.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. DROP 0004 RLS POLICIES (DROP DEPENDENT POLICIES BEFORE FUNCTIONS)
-- ----------------------------------------------------------------------------

-- A. Incident Parent & Child Tables
DROP POLICY IF EXISTS "incidents_select" ON public.incidents;
DROP POLICY IF EXISTS "incidents_insert" ON public.incidents;
DROP POLICY IF EXISTS "incidents_update" ON public.incidents;
DROP POLICY IF EXISTS "incidents_delete" ON public.incidents;
DROP POLICY IF EXISTS "incidents readable" ON public.incidents;

DROP POLICY IF EXISTS "incident_assignments_select" ON public.incident_assignments;
DROP POLICY IF EXISTS "incident_assignments_insert" ON public.incident_assignments;
DROP POLICY IF EXISTS "incident_assignments_update" ON public.incident_assignments;
DROP POLICY IF EXISTS "incident_assignments_delete" ON public.incident_assignments;

DROP POLICY IF EXISTS "incident_events_select" ON public.incident_events;
DROP POLICY IF EXISTS "incident_events_insert" ON public.incident_events;

DROP POLICY IF EXISTS "incident_notes_select" ON public.incident_notes;
DROP POLICY IF EXISTS "incident_notes_insert" ON public.incident_notes;
DROP POLICY IF EXISTS "incident_notes_update" ON public.incident_notes;
DROP POLICY IF EXISTS "incident_notes_delete" ON public.incident_notes;

DROP POLICY IF EXISTS "incident_evidence_select" ON public.incident_evidence;
DROP POLICY IF EXISTS "incident_evidence_insert" ON public.incident_evidence;
DROP POLICY IF EXISTS "incident_evidence_update" ON public.incident_evidence;
DROP POLICY IF EXISTS "incident_evidence_delete" ON public.incident_evidence;

-- B. Dashboards & Dashboard Widgets
DROP POLICY IF EXISTS "dashboards_select" ON public.dashboards;
DROP POLICY IF EXISTS "dashboards_insert" ON public.dashboards;
DROP POLICY IF EXISTS "dashboards_update" ON public.dashboards;
DROP POLICY IF EXISTS "dashboards_delete" ON public.dashboards;

DROP POLICY IF EXISTS "dashboard_widgets_select" ON public.dashboard_widgets;
DROP POLICY IF EXISTS "dashboard_widgets_insert" ON public.dashboard_widgets;
DROP POLICY IF EXISTS "dashboard_widgets_update" ON public.dashboard_widgets;
DROP POLICY IF EXISTS "dashboard_widgets_delete" ON public.dashboard_widgets;

-- C. Reports & Report Blocks
DROP POLICY IF EXISTS "reports_select" ON public.reports;
DROP POLICY IF EXISTS "reports_insert" ON public.reports;
DROP POLICY IF EXISTS "reports_update" ON public.reports;
DROP POLICY IF EXISTS "reports_delete" ON public.reports;

DROP POLICY IF EXISTS "report_blocks_select" ON public.report_blocks;
DROP POLICY IF EXISTS "report_blocks_insert" ON public.report_blocks;
DROP POLICY IF EXISTS "report_blocks_update" ON public.report_blocks;
DROP POLICY IF EXISTS "report_blocks_delete" ON public.report_blocks;

-- D. Client ID Map Policies
DROP POLICY IF EXISTS "client_id_map_select" ON public.client_id_map;
DROP POLICY IF EXISTS "client_id_map_insert" ON public.client_id_map;

-- ----------------------------------------------------------------------------
-- 2. DROP 0004 HELPER FUNCTIONS & ATOMIC RPCS
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.save_dashboard_atomic(uuid, text, text, jsonb);
DROP FUNCTION IF EXISTS public.save_report_atomic(uuid, text, text, text, public.report_status, text, jsonb);
DROP FUNCTION IF EXISTS public.resolve_client_uuid(text, text);
DROP FUNCTION IF EXISTS public.can_read_incident(uuid);

-- ----------------------------------------------------------------------------
-- 3. RESTORE SECURE INCIDENT POLICIES (EXPLICIT WORKSPACE & PERMISSION CHECKS)
-- ----------------------------------------------------------------------------

-- A. Incidents (Parent Table: Workspace-Scoped & Theater-Wide Operational Incidents)
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

-- B. Incident Assignments
CREATE POLICY "incident_assignments_select" ON public.incident_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_assignments.incident_id
        AND (
          public.is_super_admin()
          OR (
            public.has_permission('view:incidents')
            AND (i.workspace_id IS NULL OR public.can_access_workspace(i.workspace_id))
          )
        )
    )
  );

CREATE POLICY "incident_assignments_insert" ON public.incident_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('incident:assign')
    AND EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_assignments.incident_id
        AND (
          public.is_super_admin()
          OR (
            (i.workspace_id IS NULL AND public.has_permission('view:incidents'))
            OR (i.workspace_id IS NOT NULL AND public.can_access_workspace(i.workspace_id))
          )
        )
        AND (
          incident_assignments.lead IS NULL
          OR (
            EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = incident_assignments.lead
                AND p.status = 'active'
            )
            AND (
              i.workspace_id IS NULL
              OR EXISTS (
                SELECT 1 FROM public.workspace_members wm
                WHERE wm.workspace_id = i.workspace_id
                  AND wm.user_id = incident_assignments.lead
              )
            )
          )
        )
    )
  );

CREATE POLICY "incident_assignments_update" ON public.incident_assignments
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('incident:assign')
    AND EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_assignments.incident_id
        AND (
          public.is_super_admin()
          OR (
            (i.workspace_id IS NULL AND public.has_permission('view:incidents'))
            OR (i.workspace_id IS NOT NULL AND public.can_access_workspace(i.workspace_id))
          )
        )
    )
  )
  WITH CHECK (
    public.has_permission('incident:assign')
    AND EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_assignments.incident_id
        AND (
          public.is_super_admin()
          OR (
            (i.workspace_id IS NULL AND public.has_permission('view:incidents'))
            OR (i.workspace_id IS NOT NULL AND public.can_access_workspace(i.workspace_id))
          )
        )
        AND (
          incident_assignments.lead IS NULL
          OR (
            EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = incident_assignments.lead
                AND p.status = 'active'
            )
            AND (
              i.workspace_id IS NULL
              OR EXISTS (
                SELECT 1 FROM public.workspace_members wm
                WHERE wm.workspace_id = i.workspace_id
                  AND wm.user_id = incident_assignments.lead
              )
            )
          )
        )
    )
  );

CREATE POLICY "incident_assignments_delete" ON public.incident_assignments
  FOR DELETE TO authenticated
  USING (
    public.has_permission('incident:assign')
    AND EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_assignments.incident_id
        AND (
          public.is_super_admin()
          OR (
            (i.workspace_id IS NULL AND public.has_permission('view:incidents'))
            OR (i.workspace_id IS NOT NULL AND public.can_access_workspace(i.workspace_id))
          )
        )
    )
  );

-- B. Incident Events: Strictly Read-Only for Clients (Append-only via trusted procedures)
CREATE POLICY "incident_events_select" ON public.incident_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_events.incident_id
        AND (
          public.is_super_admin()
          OR (
            public.has_permission('view:incidents')
            AND (i.workspace_id IS NULL OR public.can_access_workspace(i.workspace_id))
          )
        )
    )
  );

-- C. Incident Notes: Scoped to Parent Incident Access and Author Identity
CREATE POLICY "incident_notes_select" ON public.incident_notes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_notes.incident_id
        AND (
          public.is_super_admin()
          OR (
            public.has_permission('view:incidents')
            AND (i.workspace_id IS NULL OR public.can_access_workspace(i.workspace_id))
          )
        )
    )
  );

CREATE POLICY "incident_notes_insert" ON public.incident_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    author = auth.uid()
    AND public.has_permission('incident:note')
    AND EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_notes.incident_id
        AND (
          public.is_super_admin()
          OR (
            (i.workspace_id IS NULL AND public.has_permission('view:incidents'))
            OR (i.workspace_id IS NOT NULL AND public.can_access_workspace(i.workspace_id))
          )
        )
    )
  );

CREATE POLICY "incident_notes_update" ON public.incident_notes
  FOR UPDATE TO authenticated
  USING (
    author = auth.uid()
    AND public.has_permission('incident:note')
    AND EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_notes.incident_id
        AND (
          public.is_super_admin()
          OR (
            (i.workspace_id IS NULL AND public.has_permission('view:incidents'))
            OR (i.workspace_id IS NOT NULL AND public.can_access_workspace(i.workspace_id))
          )
        )
    )
  )
  WITH CHECK (
    author = auth.uid()
    AND public.has_permission('incident:note')
    AND EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_notes.incident_id
        AND (
          public.is_super_admin()
          OR (
            (i.workspace_id IS NULL AND public.has_permission('view:incidents'))
            OR (i.workspace_id IS NOT NULL AND public.can_access_workspace(i.workspace_id))
          )
        )
    )
  );

CREATE POLICY "incident_notes_delete" ON public.incident_notes
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_notes.incident_id
        AND (
          public.is_super_admin()
          OR (
            (i.workspace_id IS NULL AND public.has_permission('view:incidents'))
            OR (i.workspace_id IS NOT NULL AND public.can_access_workspace(i.workspace_id))
          )
        )
    )
    AND (
      (author = auth.uid() AND public.has_permission('incident:note'))
      OR public.has_permission('admin:settings')
      OR public.is_super_admin()
    )
  );

-- D. Incident Evidence: Scoped to Parent Incident Access and Added-By Identity
CREATE POLICY "incident_evidence_select" ON public.incident_evidence
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_evidence.incident_id
        AND (
          public.is_super_admin()
          OR (
            public.has_permission('view:incidents')
            AND (i.workspace_id IS NULL OR public.can_access_workspace(i.workspace_id))
          )
        )
    )
  );

CREATE POLICY "incident_evidence_insert" ON public.incident_evidence
  FOR INSERT TO authenticated
  WITH CHECK (
    added_by = auth.uid()
    AND public.has_permission('incident:evidence')
    AND EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_evidence.incident_id
        AND (
          public.is_super_admin()
          OR (
            (i.workspace_id IS NULL AND public.has_permission('view:incidents'))
            OR (i.workspace_id IS NOT NULL AND public.can_access_workspace(i.workspace_id))
          )
        )
    )
  );

CREATE POLICY "incident_evidence_update" ON public.incident_evidence
  FOR UPDATE TO authenticated
  USING (
    added_by = auth.uid()
    AND public.has_permission('incident:evidence')
    AND EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_evidence.incident_id
        AND (
          public.is_super_admin()
          OR (
            (i.workspace_id IS NULL AND public.has_permission('view:incidents'))
            OR (i.workspace_id IS NOT NULL AND public.can_access_workspace(i.workspace_id))
          )
        )
    )
  )
  WITH CHECK (
    added_by = auth.uid()
    AND public.has_permission('incident:evidence')
    AND EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_evidence.incident_id
        AND (
          public.is_super_admin()
          OR (
            (i.workspace_id IS NULL AND public.has_permission('view:incidents'))
            OR (i.workspace_id IS NOT NULL AND public.can_access_workspace(i.workspace_id))
          )
        )
    )
  );

CREATE POLICY "incident_evidence_delete" ON public.incident_evidence
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_evidence.incident_id
        AND (
          public.is_super_admin()
          OR (
            (i.workspace_id IS NULL AND public.has_permission('view:incidents'))
            OR (i.workspace_id IS NOT NULL AND public.can_access_workspace(i.workspace_id))
          )
        )
    )
    AND (
      (added_by = auth.uid() AND public.has_permission('incident:evidence'))
      OR public.has_permission('admin:settings')
      OR public.is_super_admin()
    )
  );

-- ----------------------------------------------------------------------------
-- 4. RESTORE SECURE DASHBOARD & WIDGET POLICIES
-- ----------------------------------------------------------------------------

-- A. Dashboards
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
    AND (
      workspace_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = dashboards.workspace_id
          AND user_id = auth.uid()
          AND access_level IN ('owner', 'editor')
      )
      OR public.is_super_admin()
    )
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

-- B. Dashboard Widgets: Inherit Access Strictly from Parent Dashboard
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
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = d.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.access_level IN ('owner', 'editor')
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
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = d.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.access_level IN ('owner', 'editor')
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
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = d.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.access_level IN ('owner', 'editor')
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
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = d.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.access_level = 'owner'
          ))
          OR public.is_super_admin()
        )
    )
  );

-- ----------------------------------------------------------------------------
-- 5. RESTORE SECURE REPORT & BLOCK POLICIES (CLASSIFICATION PRESERVED)
-- ----------------------------------------------------------------------------

-- A. Reports
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
    AND (
      workspace_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = reports.workspace_id
          AND user_id = auth.uid()
          AND access_level IN ('owner', 'editor')
      )
      OR public.is_super_admin()
    )
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
    (author = auth.uid() AND public.has_permission('report:create'))
    OR (workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = reports.workspace_id
        AND user_id = auth.uid()
        AND access_level = 'owner'
    ))
    OR public.is_super_admin()
  );

-- B. Report Blocks: Inherit Access Strictly from Parent Report
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
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = r.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.access_level IN ('owner', 'editor')
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
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = r.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.access_level IN ('owner', 'editor')
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
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = r.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.access_level IN ('owner', 'editor')
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
          (r.author = auth.uid() AND public.has_permission('report:edit'))
          OR (r.workspace_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = r.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.access_level = 'owner'
          ))
          OR public.is_super_admin()
        )
    )
  );

-- ----------------------------------------------------------------------------
-- 6. RESTORE CLIENT ID MAP POLICIES (ISOLATED RUNTIME CONTINUITY)
-- ----------------------------------------------------------------------------
CREATE POLICY "client_id_map_select" ON public.client_id_map
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "client_id_map_insert" ON public.client_id_map
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- ----------------------------------------------------------------------------
-- 7. RESTORE AUTH PROVISIONING TRIGGER (OBSERVER DEFAULT BASELINE)
-- ----------------------------------------------------------------------------
-- Preserves signup profile creation using exact original defaults from 0001_schema.sql
-- role_id: 'observer', title: 'Observer', clearance: 'L1', status: 'active'.
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
-- 8. RESTORE STORED PROCEDURES WITH SECURE SEARCH_PATH & WORKSPACE CONTROLS
-- ----------------------------------------------------------------------------

-- A. transition_incident: Preserves state machine, row-level locking, and workspace check
CREATE OR REPLACE FUNCTION public.transition_incident(
  p_incident uuid,
  p_next public.incident_status,
  p_detail text DEFAULT ''
)
RETURNS public.incidents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current public.incidents;
  v_from    public.incident_status;
  v_allowed boolean := false;
BEGIN
  IF NOT public.has_permission('incident:transition') THEN
    RAISE EXCEPTION 'permission denied: incident:transition';
  END IF;

  SELECT * INTO v_current
  FROM public.incidents
  WHERE id = p_incident
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'incident not found';
  END IF;

  -- Validate caller workspace access or global view permission
  IF v_current.workspace_id IS NOT NULL THEN
    IF NOT public.can_access_workspace(v_current.workspace_id) AND NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'permission denied: unauthorized workspace access';
    END IF;
  ELSE
    IF NOT public.has_permission('view:incidents') AND NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'permission denied: view:incidents required for global incident';
    END IF;
  END IF;

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

  UPDATE public.incidents
  SET status = p_next,
      resolved_at = CASE WHEN p_next = 'resolved' THEN pg_catalog.now() ELSE resolved_at END,
      updated_at = pg_catalog.now()
  WHERE id = p_incident
  RETURNING * INTO v_current;

  INSERT INTO public.incident_events(incident_id, actor, event_type, from_status, to_status, detail)
  VALUES (p_incident, auth.uid(), 'status_transition', v_from, p_next, COALESCE(p_detail, ''));

  INSERT INTO public.audit_logs(actor, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'incident.transition', 'incident', p_incident::text, pg_catalog.jsonb_build_object('from', v_from, 'to', p_next));

  IF v_current.commander IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, category, priority, title, body, href)
    VALUES (
      v_current.commander,
      'incident',
      CASE WHEN v_current.severity = 'critical' THEN 'critical' ELSE 'high' END,
      'Incident status changed',
      v_current.reference || ' moved to ' || p_next,
      '/incidents/' || p_incident
    );
  END IF;

  RETURN v_current;
END;
$$;

-- B. assign_incident: Preserves lead profile existence, active status, and workspace validation
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
  IF NOT public.has_permission('incident:assign') THEN
    RAISE EXCEPTION 'permission denied: incident:assign';
  END IF;

  SELECT id, workspace_id, reference INTO v_incident
  FROM public.incidents
  WHERE id = p_incident;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'incident not found: %', p_incident;
  END IF;

  IF v_incident.workspace_id IS NOT NULL THEN
    IF NOT public.can_access_workspace(v_incident.workspace_id) AND NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'permission denied: caller cannot access incident workspace';
    END IF;
  ELSE
    IF NOT public.has_permission('view:incidents') AND NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'permission denied: view:incidents required for global incident';
    END IF;
  END IF;

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

    IF v_incident.workspace_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = v_incident.workspace_id AND user_id = p_lead
      ) THEN
        RAISE EXCEPTION 'assigned lead % is not a member of incident workspace %', p_lead, v_incident.workspace_id;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.incident_assignments(incident_id, team, lead)
  VALUES (p_incident, p_team, p_lead);

  INSERT INTO public.incident_events(incident_id, actor, event_type, detail)
  VALUES (p_incident, auth.uid(), 'assignment', 'Assigned to ' || p_team);

  INSERT INTO public.audit_logs(actor, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'incident.assign', 'incident', p_incident::text, pg_catalog.jsonb_build_object('team', p_team, 'lead', p_lead));

  IF p_lead IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, category, priority, title, body, href)
    VALUES (p_lead, 'assignment', 'high', 'Incident assignment', 'You were assigned to ' || v_incident.reference, '/incidents/' || p_incident);
  END IF;
END;
$$;

-- C. log_audit: Strict client action allowlist and anti-spoofing enforcement
-- Ordinary authenticated users (including those with admin:audit) cannot emit privileged audit records directly.
-- Privileged events are emitted only by server-side SECURITY DEFINER procedures.
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

  IF p_target_type NOT IN ('incident', 'dashboard', 'report', 'entity', 'simulation', 'workspace', 'profile', 'system') THEN
    RAISE EXCEPTION 'Invalid audit target type: %', p_target_type;
  END IF;

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

-- ----------------------------------------------------------------------------
-- 9. EXPLICIT LEAST-PRIVILEGE TABLE & FUNCTION GRANTS & REVOKES
-- ----------------------------------------------------------------------------

-- A. Table Privileges on client_id_map
REVOKE ALL ON TABLE public.client_id_map FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.client_id_map TO authenticated;

-- B. Revoke all public and anon execution on functions
REVOKE ALL ON FUNCTION public.transition_incident(uuid, public.incident_status, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_incident(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_user_role(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_audit(text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- C. Grant authenticated execution
GRANT EXECUTE ON FUNCTION public.transition_incident(uuid, public.incident_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_incident(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit(text, text, text, jsonb) TO authenticated;

-- View Security: Ensure security_invoker = true so underlying table RLS applies
ALTER VIEW public.v_operational_theater SET (security_invoker = true);

COMMIT;
