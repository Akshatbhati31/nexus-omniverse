# Database Architecture

The demo runs on a versioned local persistence adapter. The production schema is provided as Supabase migrations:

- `supabase/migrations/0001_schema.sql` — enums, tables, indexes, triggers.
- `supabase/migrations/0002_rls.sql` — row-level security and privileged RPC functions.

## Entity groups

| Group | Tables |
| --- | --- |
| Identity | `profiles`, `roles`, `permissions`, `role_permissions`, `user_roles` |
| Tenancy | `workspaces`, `workspace_members` |
| Geography | `locations`, `entities`, `entity_relations` |
| Observations | `observations` |
| Incidents | `incidents`, `incident_assignments`, `incident_events`, `incident_notes`, `incident_evidence` |
| Simulation | `simulations`, `simulation_results` |
| Analysis | `dashboards`, `dashboard_widgets`, `reports`, `report_blocks` |
| Intelligence | `conversations`, `messages`, `message_sources` |
| Operations | `notifications`, `notification_preferences`, `audit_logs` |

## Production security rules

- RLS enabled on every table.
- Users can read their own profile; administrators can read all profiles.
- Role assignments are only mutable by super administrators through a security-definer RPC.
- Incident transitions, assignment changes, report publication and workspace membership changes are enforced by security-definer RPCs that validate permissions server-side.
- Audit records are append-only; no client delete policy exists.
- Observation data is read-only to authenticated members.
- Private conversation threads are visible only to their owner; messages cascade with the thread.

## Required environment variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_NEXUS_AI_ENDPOINT=          # optional LLM proxy
VITE_NEXUS_DEMO_MODE=true
```

The client must never receive a Supabase service-role key.
