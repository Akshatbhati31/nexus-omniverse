-- ============================================================================
-- NEXUS // OMNIVERSE — NEON POSTGRESQL TEST COMPATIBILITY BOOTSTRAP
-- ============================================================================
-- Target: Neon PostgreSQL (PostgreSQL 15+)
-- Purpose:
--   Establishes the minimal Supabase compatibility layer required to execute
--   and validate the four official NEXUS // OMNIVERSE migrations on a clean,
--   disposable Neon database without modifying the migration source files:
--     1. supabase/migrations/0001_schema.sql
--     2. supabase/migrations/0002_rls.sql
--     3. supabase/migrations/0003_realtime_views.sql
--     4. supabase/migrations/0004_security_hardening.sql
--
-- Security & Integrity Rules Enforced:
--   - Idempotent and non-destructive.
--   - Does NOT create synthetic application users or seed sample profiles.
--   - Does NOT disable or bypass Row-Level Security (RLS).
--   - Does NOT grant blanket table access to anon or authenticated roles.
--   - Fails closed when no authenticated JWT or test session is active.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CORE EXTENSIONS
-- ----------------------------------------------------------------------------
-- Ensure essential cryptographic and UUID generation extensions are present.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 2. SUPABASE SYSTEM ROLES
-- ----------------------------------------------------------------------------
-- Supabase manages three primary API roles (anon, authenticated, service_role).
-- In pure PostgreSQL / Neon, these roles must exist so that GRANT / REVOKE
-- statements and RLS policies (e.g. "TO authenticated") compile cleanly.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END;
$$;

-- Allow the current connecting database owner / test harness to assume or grant
-- these roles during testing sessions.
DO $$
BEGIN
  EXECUTE format('GRANT anon, authenticated, service_role TO %I', CURRENT_USER);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. SUPABASE AUTH SCHEMA & USERS TABLE
-- ----------------------------------------------------------------------------
-- Required by:
--   - 0001_schema.sql: public.profiles(id) REFERENCES auth.users(id) ON DELETE CASCADE
--   - 0004_security_hardening.sql: Trigger on_auth_user_created ON auth.users
--                                  invoking public.handle_new_user()
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id         uuid,
  email               text UNIQUE,
  encrypted_password  text,
  email_confirmed_at  timestamptz,
  invited_at          timestamptz,
  confirmation_token  text,
  recovery_token      text,
  email_change_token  text,
  email_change        text,
  raw_app_meta_data   jsonb DEFAULT '{}'::jsonb,
  raw_user_meta_data  jsonb DEFAULT '{}'::jsonb,
  is_super_admin      boolean DEFAULT false,
  role                text DEFAULT 'authenticated',
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Protect auth.users from arbitrary anonymous or authenticated manipulation
REVOKE ALL ON SCHEMA auth FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
REVOKE ALL ON TABLE auth.users FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE auth.users TO service_role;

-- ----------------------------------------------------------------------------
-- 4. SUPABASE CONTEXT FUNCTIONS (auth.uid(), auth.role(), auth.email())
-- ----------------------------------------------------------------------------
-- These functions replicate Supabase's request-level context resolution.
-- They look first for standard PostgREST / GoTrue GUC settings:
--   - request.jwt.claim.sub / request.jwt.claims->>'sub'
--   - request.jwt.claim.role / request.jwt.claims->>'role'
--   - request.jwt.claim.email / request.jwt.claims->>'email'
-- And fallback to convenient test-harness settings:
--   - auth.test_user_id, auth.test_user_role, auth.test_user_email
-- If unset, auth.uid() returns NULL (failing closed).
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), ''),
    (nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'),
    nullif(pg_catalog.current_setting('auth.test_user_id', true), '')
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    nullif(pg_catalog.current_setting('request.jwt.claim.role', true), ''),
    (nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    nullif(pg_catalog.current_setting('auth.test_user_role', true), ''),
    'anon'
  )::text;
$$;

CREATE OR REPLACE FUNCTION auth.email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    nullif(pg_catalog.current_setting('request.jwt.claim.email', true), ''),
    (nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'email'),
    nullif(pg_catalog.current_setting('auth.test_user_email', true), '')
  )::text;
$$;

-- auth context functions must be executable by all roles to evaluate RLS expressions
GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.role() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.email() TO PUBLIC, anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. REALTIME REPLICATION PUBLICATION
-- ----------------------------------------------------------------------------
-- Required by 0003_realtime_views.sql:
--   ALTER PUBLICATION supabase_realtime ADD TABLE ...
-- In Neon, publications are supported when logical replication is enabled.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping CREATE PUBLICATION supabase_realtime: insufficient privilege in this Neon environment.';
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. BASIC SCHEMA USAGE PRIVILEGES
-- ----------------------------------------------------------------------------
-- Grant schema usage so authenticated and anon roles can resolve objects in public.
-- Note: Does NOT grant table-level SELECT, INSERT, UPDATE, or DELETE privileges.
-- Table-specific DAC grants for Neon test execution are defined separately in
-- supabase/neon_post_migration_grants.sql (executed after migrations 0001–0004).
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. TEST HARNESS SESSION HELPERS (TESTING CONVENIENCE ONLY)
-- ----------------------------------------------------------------------------
-- Helper procedures to simulate authenticated users in Neon psql / SQL console
-- without requiring a running PostgREST HTTP server.
--
-- Usage in test scripts:
--   SELECT auth.set_test_session('11111111-1111-1111-1111-111111111111'::uuid, 'analyst@nexus.internal');
--   -- Execute queries as that user; auth.uid() returns the specified UUID.
--   SELECT auth.clear_test_session();
--   -- auth.uid() now returns NULL (unauthenticated).
CREATE OR REPLACE FUNCTION auth.set_test_session(
  p_user_id uuid,
  p_email   text DEFAULT 'operator@nexus.internal',
  p_role    text DEFAULT 'authenticated'
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', p_user_id::text, false);
  PERFORM pg_catalog.set_config('auth.test_user_id', p_user_id::text, false);
  PERFORM pg_catalog.set_config('request.jwt.claim.role', p_role, false);
  PERFORM pg_catalog.set_config('auth.test_user_role', p_role, false);
  PERFORM pg_catalog.set_config('request.jwt.claim.email', p_email, false);
  PERFORM pg_catalog.set_config('auth.test_user_email', p_email, false);
END;
$$;

CREATE OR REPLACE FUNCTION auth.clear_test_session()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '', false);
  PERFORM pg_catalog.set_config('auth.test_user_id', '', false);
  PERFORM pg_catalog.set_config('request.jwt.claim.role', '', false);
  PERFORM pg_catalog.set_config('auth.test_user_role', '', false);
  PERFORM pg_catalog.set_config('request.jwt.claim.email', '', false);
  PERFORM pg_catalog.set_config('auth.test_user_email', '', false);
END;
$$;

-- Explicitly revoke execution from PUBLIC and all standard application roles.
-- Only the database owner / superuser / test administrator who created the functions
-- retains execution privileges, preventing unauthorized session impersonation.
REVOKE ALL ON FUNCTION auth.set_test_session(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION auth.clear_test_session() FROM PUBLIC, anon, authenticated, service_role;
