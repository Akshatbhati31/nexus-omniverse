-- ============================================================================
-- NEXUS // OMNIVERSE — RUNTIME SECURITY BOUNDARY VALIDATION SUITE
-- ============================================================================
-- Target: Neon PostgreSQL (Browser SQL Editor & psql compatible)
-- Architecture:
--   1. Fixture creation runs in database owner context.
--   2. Role switching (SET LOCAL ROLE authenticated / RESET ROLE) occurs ONLY
--      via top-level SQL statements outside DO blocks.
--   3. Session setters (auth.set_test_session / auth.clear_test_session) are
--      invoked only while operating as the authorized database owner.
--   4. Each security boundary is independently tested and logs PASS/FAIL.
--   5. Negative tests verify specific rejection messages; unexpected errors fail.
--   6. The entire script runs in a single transaction ending with ROLLBACK.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. TEMPORARY LOGGING & CONTEXT TABLES
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE test_execution_log (
  test_num    integer PRIMARY KEY,
  test_name   text NOT NULL,
  status      text NOT NULL CHECK (status IN ('PASS', 'FAIL')),
  details     text NOT NULL
) ON COMMIT DROP;

GRANT ALL ON TABLE test_execution_log TO authenticated;

-- ----------------------------------------------------------------------------
-- 1. FIXTURE COLLISION CHECK & PROVISIONING (Operating as DB Owner)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  -- Dedicated RFC 4122 v4 Hexadecimal UUIDs for test isolation
  c_admin_id     CONSTANT uuid := 'a0000000-0000-4000-8000-000000000001'; -- Super Admin
  c_user_a_id    CONSTANT uuid := 'a0000000-0000-4000-8000-000000000002'; -- Operations Manager (Author/Owner)
  c_user_b_id    CONSTANT uuid := 'a0000000-0000-4000-8000-000000000003'; -- Observer (Workspace Member)
  c_user_c_id    CONSTANT uuid := 'a0000000-0000-4000-8000-000000000004'; -- Observer (Outsider)

  c_ws_id        CONSTANT uuid := 'b0000000-0000-4000-8000-000000000001';
  c_inc_id       CONSTANT uuid := 'c0000000-0000-4000-8000-000000000001';
  c_inc_ref      CONSTANT text := 'INC-TEST-0001';

  c_rep_restr_id CONSTANT uuid := 'd0000000-0000-4000-8000-000000000001';
  c_rep_norm_id  CONSTANT uuid := 'd0000000-0000-4000-8000-000000000002';
  c_blk_restr_id CONSTANT uuid := 'e0000000-0000-4000-8000-000000000001';
  c_blk_norm_id  CONSTANT uuid := 'e0000000-0000-4000-8000-000000000002';

  c_dash_1_id    CONSTANT uuid := 'f0000000-0000-4000-8000-000000000001';
  c_dash_2_id    CONSTANT uuid := 'f0000000-0000-4000-8000-000000000002';
  c_widget_1_id  CONSTANT uuid := 'f0000000-0000-4000-8000-000000000011';
  c_widget_2_id  CONSTANT uuid := 'f0000000-0000-4000-8000-000000000012';
BEGIN
  -- Collision pre-check: verify that no dedicated test UUID is already present
  IF EXISTS (
    SELECT 1 FROM auth.users WHERE id IN (c_admin_id, c_user_a_id, c_user_b_id, c_user_c_id)
    UNION ALL
    SELECT 1 FROM public.profiles WHERE id IN (c_admin_id, c_user_a_id, c_user_b_id, c_user_c_id)
    UNION ALL
    SELECT 1 FROM public.workspaces WHERE id = c_ws_id
    UNION ALL
    SELECT 1 FROM public.reports WHERE id IN (c_rep_restr_id, c_rep_norm_id)
    UNION ALL
    SELECT 1 FROM public.report_blocks WHERE id IN (c_blk_restr_id, c_blk_norm_id)
    UNION ALL
    SELECT 1 FROM public.dashboards WHERE id IN (c_dash_1_id, c_dash_2_id)
    UNION ALL
    SELECT 1 FROM public.dashboard_widgets WHERE id IN (c_widget_1_id, c_widget_2_id)
    UNION ALL
    SELECT 1 FROM public.incidents WHERE id = c_inc_id OR reference = c_inc_ref
  ) THEN
    RAISE EXCEPTION 'Pre-check failed: One or more test fixture UUIDs collide with existing database records!';
  END IF;

  -- Create test auth users (fires handle_new_user trigger which creates default observer profiles)
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
    (c_admin_id,  'test_admin@nexus.test',  '{"name": "Admin"}'::jsonb),
    (c_user_a_id, 'test_user_a@nexus.test', '{"name": "Operations Manager A"}'::jsonb),
    (c_user_b_id, 'test_user_b@nexus.test', '{"name": "Observer B"}'::jsonb),
    (c_user_c_id, 'test_user_c@nexus.test', '{"name": "Observer C"}'::jsonb);

  -- Configure roles and clearance on created profiles
  UPDATE public.profiles SET role_id = 'super_admin', title = 'Super Administrator', clearance = 'L5' WHERE id = c_admin_id;
  UPDATE public.profiles SET role_id = 'ops_manager',  title = 'Operations Manager', clearance = 'L4' WHERE id = c_user_a_id;
  UPDATE public.profiles SET role_id = 'observer',    title = 'Observer',              clearance = 'L1' WHERE id = c_user_b_id;
  UPDATE public.profiles SET role_id = 'observer',    title = 'Observer',              clearance = 'L1' WHERE id = c_user_c_id;

  -- Create Workspace with User A as owner and User B as viewer
  INSERT INTO public.workspaces (id, name, code, description, created_by)
  VALUES (c_ws_id, 'Test Operations Sector', 'SEC-TEST-99', 'Runtime Security Test Sector', c_user_a_id);

  INSERT INTO public.workspace_members (workspace_id, user_id, access_level) VALUES
    (c_ws_id, c_user_a_id, 'owner'),
    (c_ws_id, c_user_b_id, 'viewer');

  -- Create Reports:
  --   1. Restricted report (in workspace, authored by A, classification = 'restricted')
  --   2. Non-restricted report (in workspace, authored by A, classification = 'internal')
  INSERT INTO public.reports (id, author, title, template, classification, status, summary, shared_with, workspace_id)
  VALUES
    (c_rep_restr_id, c_user_a_id, 'Restricted Brief', 'intelligence_brief', 'restricted', 'published'::public.report_status, 'Top Secret', '{}'::uuid[], c_ws_id),
    (c_rep_norm_id,  c_user_a_id, 'Routine Brief',    'intelligence_brief', 'internal',   'published'::public.report_status, 'Routine Ops', '{}'::uuid[], c_ws_id);

  INSERT INTO public.report_blocks (id, report_id, position, block_type, content)
  VALUES
    (c_blk_restr_id, c_rep_restr_id, 0, 'paragraph', '{"body": "Restricted block content"}'::jsonb),
    (c_blk_norm_id,  c_rep_norm_id,  0, 'paragraph', '{"body": "Routine block content"}'::jsonb);

  -- Create Dashboards & Widgets:
  --   Dashboard 1 with Widget 1
  --   Dashboard 2 with Widget 2
  INSERT INTO public.dashboards (id, owner, name, description, layout, workspace_id)
  VALUES
    (c_dash_1_id, c_user_a_id, 'Dashboard 1', 'Primary Grid', '[]'::jsonb, c_ws_id),
    (c_dash_2_id, c_user_a_id, 'Dashboard 2', 'Secondary Grid', '[]'::jsonb, c_ws_id);

  INSERT INTO public.dashboard_widgets (id, dashboard_id, title, widget_type, config, position)
  VALUES
    (c_widget_1_id, c_dash_1_id, 'Widget 1', 'stat_value', '{}'::jsonb, '{"x": 0, "y": 0, "w": 6, "h": 4}'::jsonb),
    (c_widget_2_id, c_dash_2_id, 'Widget 2', 'stat_value', '{}'::jsonb, '{"x": 0, "y": 0, "w": 6, "h": 4}'::jsonb);

  -- Create an incident for RPC transition tests
  INSERT INTO public.incidents (id, reference, title, category, severity, status, summary, workspace_id)
  VALUES (c_inc_id, c_inc_ref, 'Test Incursion', 'network_failure'::public.incident_category, 'high'::public.incident_severity, 'detected'::public.incident_status, 'Runtime test incident', c_ws_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. BOUNDARY 1: Cross-user access to client_id_map
-- ----------------------------------------------------------------------------
-- 2a. User A creates and verifies their own mapping under authenticated role
SELECT auth.set_test_session('a0000000-0000-4000-8000-000000000002'::uuid, 'test_user_a@nexus.test', 'authenticated');
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.client_id_map (created_by, client_id, entity_type)
  VALUES ('a0000000-0000-4000-8000-000000000002'::uuid, 'slug-alpha-test-1', 'incident');

  SELECT count(*) INTO v_count
  FROM public.client_id_map
  WHERE client_id = 'slug-alpha-test-1';

  IF v_count != 1 THEN
    RAISE EXCEPTION 'User A should be able to read own client_id_map record';
  END IF;
END;
$$;

RESET ROLE;

-- 2b. User B attempts cross-user read and forged insert
SELECT auth.set_test_session('a0000000-0000-4000-8000-000000000003'::uuid, 'test_user_b@nexus.test', 'authenticated');
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_count        integer;
  v_op_succeeded boolean;
  v_caught_error text;
BEGIN
  -- User B MUST NOT see User A's mapping
  SELECT count(*) INTO v_count
  FROM public.client_id_map
  WHERE client_id = 'slug-alpha-test-1';

  IF v_count != 0 THEN
    RAISE EXCEPTION 'Cross-user breach: User B read User A client_id_map record';
  END IF;

  -- User B attempts to insert row forging created_by = User A
  v_op_succeeded := false;
  BEGIN
    INSERT INTO public.client_id_map (created_by, client_id, entity_type)
    VALUES ('a0000000-0000-4000-8000-000000000002'::uuid, 'slug-forged-test-2', 'incident');
    v_op_succeeded := true;
  EXCEPTION WHEN OTHERS THEN
    v_caught_error := SQLERRM;
    IF v_caught_error NOT LIKE '%row-level security%'
       AND v_caught_error NOT LIKE '%violates row-level security policy%'
       AND v_caught_error NOT LIKE '%permission denied%' THEN
      RAISE EXCEPTION 'Unexpected error on forged insert (expected RLS rejection): %', v_caught_error;
    END IF;
  END;

  IF v_op_succeeded THEN
    RAISE EXCEPTION 'Security breach: User B was able to insert client_id_map record forging created_by = User A!';
  END IF;

  INSERT INTO test_execution_log VALUES (
    1,
    'Cross-user access to client_id_map',
    'PASS',
    'User B is strictly isolated from reading or inserting User A client mappings under RLS.'
  );
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_execution_log VALUES (1, 'Cross-user access to client_id_map', 'FAIL', SQLERRM);
END;
$$;

RESET ROLE;
SELECT auth.clear_test_session();

-- ----------------------------------------------------------------------------
-- 3. BOUNDARY 2: Restricted reports invisible to unauthorized workspace members
-- ----------------------------------------------------------------------------
SELECT auth.set_test_session('a0000000-0000-4000-8000-000000000003'::uuid, 'test_user_b@nexus.test', 'authenticated');
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_count        integer;
  v_resolved_id  uuid;
  v_op_succeeded boolean;
  v_caught_error text;
BEGIN
  -- Query on reports must return 0
  SELECT count(*) INTO v_count
  FROM public.reports
  WHERE id = 'd0000000-0000-4000-8000-000000000001'::uuid;

  IF v_count != 0 THEN
    RAISE EXCEPTION 'Data leak: Workspace member User B was able to read restricted report';
  END IF;

  -- Query on report_blocks must return 0
  SELECT count(*) INTO v_count
  FROM public.report_blocks
  WHERE id = 'e0000000-0000-4000-8000-000000000001'::uuid;

  IF v_count != 0 THEN
    RAISE EXCEPTION 'Data leak: Workspace member User B was able to read child blocks of restricted report';
  END IF;

  -- resolve_client_uuid must reject resolving the restricted report ID
  v_op_succeeded := false;
  BEGIN
    SELECT public.resolve_client_uuid('d0000000-0000-4000-8000-000000000001', 'report') INTO v_resolved_id;
    v_op_succeeded := true;
  EXCEPTION WHEN OTHERS THEN
    v_caught_error := SQLERRM;
    IF v_caught_error NOT LIKE '%permission denied%' THEN
      RAISE EXCEPTION 'Unexpected error resolving restricted report: %', v_caught_error;
    END IF;
  END;

  IF v_op_succeeded THEN
    RAISE EXCEPTION 'Security breach: User B resolved restricted report UUID!';
  END IF;

  INSERT INTO test_execution_log VALUES (
    2,
    'Restricted report workspace isolation',
    'PASS',
    'Workspace member User B was denied access to restricted report and child blocks.'
  );
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_execution_log VALUES (2, 'Restricted report workspace isolation', 'FAIL', SQLERRM);
END;
$$;

RESET ROLE;
SELECT auth.clear_test_session();

-- ----------------------------------------------------------------------------
-- 4. BOUNDARY 3: Non-restricted workspace reports accessible to authorized members
-- ----------------------------------------------------------------------------
SELECT auth.set_test_session('a0000000-0000-4000-8000-000000000003'::uuid, 'test_user_b@nexus.test', 'authenticated');
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_count       integer;
  v_resolved_id uuid;
BEGIN
  -- Direct query on reports must return 1
  SELECT count(*) INTO v_count
  FROM public.reports
  WHERE id = 'd0000000-0000-4000-8000-000000000002'::uuid;

  IF v_count != 1 THEN
    RAISE EXCEPTION 'Access failure: Workspace member User B cannot read internal workspace report';
  END IF;

  -- Direct query on report_blocks must return 1
  SELECT count(*) INTO v_count
  FROM public.report_blocks
  WHERE id = 'e0000000-0000-4000-8000-000000000002'::uuid;

  IF v_count != 1 THEN
    RAISE EXCEPTION 'Access failure: Workspace member User B cannot read internal report child blocks';
  END IF;

  -- resolve_client_uuid must resolve the legitimate report ID
  SELECT public.resolve_client_uuid('d0000000-0000-4000-8000-000000000002', 'report') INTO v_resolved_id;
  IF v_resolved_id != 'd0000000-0000-4000-8000-000000000002'::uuid THEN
    RAISE EXCEPTION 'resolve_client_uuid returned mismatched ID for legitimate report';
  END IF;

  INSERT INTO test_execution_log VALUES (
    3,
    'Non-restricted workspace report access',
    'PASS',
    'Workspace member User B successfully reads internal workspace report and child blocks.'
  );
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_execution_log VALUES (3, 'Non-restricted workspace report access', 'FAIL', SQLERRM);
END;
$$;

RESET ROLE;
SELECT auth.clear_test_session();

-- ----------------------------------------------------------------------------
-- 5. BOUNDARY 4: Cross-dashboard widget modification rejected by save_dashboard_atomic
-- ----------------------------------------------------------------------------
SELECT auth.set_test_session('a0000000-0000-4000-8000-000000000002'::uuid, 'test_user_a@nexus.test', 'authenticated');
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_op_succeeded boolean;
  v_caught_error text;
BEGIN
  v_op_succeeded := false;
  BEGIN
    PERFORM public.save_dashboard_atomic(
      'f0000000-0000-4000-8000-000000000002'::uuid,
      'Dashboard 2 Overwrite Attempt',
      'Should fail due to widget theft',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'f0000000-0000-4000-8000-000000000011'::uuid,
          'title', 'Hijacked Widget',
          'widget_type', 'stat_value',
          'config', '{}'::jsonb,
          'position', jsonb_build_object('x', 0, 'y', 0, 'w', 6, 'h', 4)
        )
      )
    );
    v_op_succeeded := true;
  EXCEPTION WHEN OTHERS THEN
    v_caught_error := SQLERRM;
    IF v_caught_error NOT LIKE '%belongs to another dashboard%' THEN
      RAISE EXCEPTION 'Expected belongs to another dashboard error, got: %', v_caught_error;
    END IF;
  END;

  IF v_op_succeeded THEN
    RAISE EXCEPTION 'Security breach: Cross-dashboard widget overwrite succeeded unexpectedly!';
  END IF;

  INSERT INTO test_execution_log VALUES (
    4,
    'Cross-dashboard widget tampering rejection',
    'PASS',
    'save_dashboard_atomic rejected upsert of widget ID belonging to a different dashboard.'
  );
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_execution_log VALUES (4, 'Cross-dashboard widget tampering rejection', 'FAIL', SQLERRM);
END;
$$;

RESET ROLE;
SELECT auth.clear_test_session();

-- ----------------------------------------------------------------------------
-- 6. BOUNDARY 5: Cross-report block modification rejected by save_report_atomic
-- ----------------------------------------------------------------------------
SELECT auth.set_test_session('a0000000-0000-4000-8000-000000000002'::uuid, 'test_user_a@nexus.test', 'authenticated');
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_op_succeeded boolean;
  v_caught_error text;
BEGIN
  v_op_succeeded := false;
  BEGIN
    PERFORM public.save_report_atomic(
      'd0000000-0000-4000-8000-000000000002'::uuid,
      'Report 2 Overwrite Attempt',
      'intelligence_brief',
      'internal',
      'published'::public.report_status,
      'Should fail due to block theft',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'e0000000-0000-4000-8000-000000000001'::uuid,
          'position', 0,
          'block_type', 'paragraph',
          'content', '{"body": "Hijacked block"}'::jsonb
        )
      )
    );
    v_op_succeeded := true;
  EXCEPTION WHEN OTHERS THEN
    v_caught_error := SQLERRM;
    IF v_caught_error NOT LIKE '%belongs to another report%' THEN
      RAISE EXCEPTION 'Expected belongs to another report error, got: %', v_caught_error;
    END IF;
  END;

  IF v_op_succeeded THEN
    RAISE EXCEPTION 'Security breach: Cross-report block overwrite succeeded unexpectedly!';
  END IF;

  INSERT INTO test_execution_log VALUES (
    5,
    'Cross-report block tampering rejection',
    'PASS',
    'save_report_atomic rejected upsert of block ID belonging to a different report.'
  );
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_execution_log VALUES (5, 'Cross-report block tampering rejection', 'FAIL', SQLERRM);
END;
$$;

RESET ROLE;
SELECT auth.clear_test_session();

-- ----------------------------------------------------------------------------
-- 7. BOUNDARY 6: Unauthorized users prevented from executing privileged RPCs
-- ----------------------------------------------------------------------------
-- 7a. assign_user_role: User A (ops_manager, not super_admin) attempts role promotion
SELECT auth.set_test_session('a0000000-0000-4000-8000-000000000002'::uuid, 'test_user_a@nexus.test', 'authenticated');
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_op_succeeded boolean;
  v_caught_error text;
BEGIN
  v_op_succeeded := false;
  BEGIN
    PERFORM public.assign_user_role('a0000000-0000-4000-8000-000000000003'::uuid, 'sys_admin');
    v_op_succeeded := true;
  EXCEPTION WHEN OTHERS THEN
    v_caught_error := SQLERRM;
    IF v_caught_error NOT LIKE '%super administrator required%' THEN
      RAISE EXCEPTION 'Unexpected error on assign_user_role: %', v_caught_error;
    END IF;
  END;

  IF v_op_succeeded THEN
    RAISE EXCEPTION 'Privilege escalation: Non-super-admin invoked assign_user_role!';
  END IF;
END;
$$;

RESET ROLE;

-- 7b & 7c. transition_incident and log_audit as Observer User B
SELECT auth.set_test_session('a0000000-0000-4000-8000-000000000003'::uuid, 'test_user_b@nexus.test', 'authenticated');
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_op_succeeded boolean;
  v_caught_error text;
BEGIN
  -- 7b: transition_incident
  v_op_succeeded := false;
  BEGIN
    PERFORM public.transition_incident('c0000000-0000-4000-8000-000000000001'::uuid, 'investigating'::public.incident_status, 'Unauthorized attempt');
    v_op_succeeded := true;
  EXCEPTION WHEN OTHERS THEN
    v_caught_error := SQLERRM;
    IF v_caught_error NOT LIKE '%permission denied%' THEN
      RAISE EXCEPTION 'Unexpected error on transition_incident: %', v_caught_error;
    END IF;
  END;

  IF v_op_succeeded THEN
    RAISE EXCEPTION 'Privilege escalation: Observer invoked transition_incident!';
  END IF;

  -- 7c: log_audit unwhitelisted action
  v_op_succeeded := false;
  BEGIN
    PERFORM public.log_audit('unauthorized.admin.override', 'system', 'sys-01', '{}'::jsonb);
    v_op_succeeded := true;
  EXCEPTION WHEN OTHERS THEN
    v_caught_error := SQLERRM;
    IF v_caught_error NOT LIKE '%permission denied%' THEN
      RAISE EXCEPTION 'Unexpected error on log_audit: %', v_caught_error;
    END IF;
  END;

  IF v_op_succeeded THEN
    RAISE EXCEPTION 'Privilege escalation: Client forged unwhitelisted audit action!';
  END IF;

  INSERT INTO test_execution_log VALUES (
    6,
    'Privileged RPC authorization enforcement',
    'PASS',
    'assign_user_role, transition_incident, and log_audit strictly rejected unauthorized callers.'
  );
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_execution_log VALUES (6, 'Privileged RPC authorization enforcement', 'FAIL', SQLERRM);
END;
$$;

RESET ROLE;
SELECT auth.clear_test_session();

-- ----------------------------------------------------------------------------
-- 8. BOUNDARY 7: Verify RLS is enabled on all intended public tables (DB Owner)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_count       integer;
  v_unprotected text[];
BEGIN
  -- Check for any public tables where RLS is disabled
  SELECT array_agg(c.relname) INTO v_unprotected
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity = false;

  IF v_unprotected IS NOT NULL AND array_length(v_unprotected, 1) > 0 THEN
    RAISE EXCEPTION 'Tables found with RLS disabled: %', array_to_string(v_unprotected, ', ');
  END IF;

  -- Verify exact count of RLS-protected public tables (exact count: 28 tables)
  SELECT count(*) INTO v_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity = true;

  IF v_count != 28 THEN
    RAISE EXCEPTION 'Expected exactly 28 RLS-protected tables, found %', v_count;
  END IF;

  INSERT INTO test_execution_log VALUES (
    7,
    'Row-Level Security coverage across all tables',
    'PASS',
    format('Verified 100%% RLS enforcement: all %s public tables have relrowsecurity = true.', v_count)
  );
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_execution_log VALUES (7, 'Row-Level Security coverage across all tables', 'FAIL', SQLERRM);
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. DISPLAY TEST RESULTS & ROLLBACK TRANSACTION
-- ----------------------------------------------------------------------------
SELECT
  test_num AS "#",
  test_name AS "Security Invariant",
  status AS "Result",
  details AS "Verification Details"
FROM test_execution_log
ORDER BY test_num;

DO $$
DECLARE
  v_failed_count integer;
BEGIN
  SELECT count(*) INTO v_failed_count
  FROM test_execution_log
  WHERE status = 'FAIL';

  IF v_failed_count > 0 THEN
    RAISE EXCEPTION 'CRITICAL: % security validation test(s) FAILED!', v_failed_count;
  ELSE
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'NEXUS // OMNIVERSE: All 7 Security Runtime Tests PASSED successfully.';
    RAISE NOTICE 'Rolling back test transaction. Zero changes persisted.';
    RAISE NOTICE '======================================================================';
  END IF;
END;
$$;

ROLLBACK;
