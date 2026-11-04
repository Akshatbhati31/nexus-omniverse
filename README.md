<<<<<<< HEAD
# NEXUS // OMNIVERSE

A civilization-scale intelligence and simulation operating environment. NEXUS is built as a persistent operating shell around independently loaded workspaces: a procedural city twin, cross-domain telemetry, incident command, deterministic simulation, relationship analysis, reporting and role-governed administration.

> **Demonstration environment.** Aurelia Prime, its citizens, assets, incidents, market records, reports and simulations are fictional and deterministic. Nothing in this build connects to live systems or represents real-world intelligence. The AI assistant uses a local deterministic fallback unless an external endpoint is configured.

## Stack

- React 19, TypeScript, Vite 8
- Tailwind CSS 4 with a semantic token layer
- Zustand with versioned localStorage persistence
- React Router with lazy routes and permission guards
- React Three Fiber / Three.js procedural 3D city with a 2D SVG fallback
- Recharts plus custom SVG analytics views
- Framer Motion with reduced-motion handling
- Vitest and Testing Library
- Supabase/PostgreSQL migration and RLS policy set for production planning

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The demo opens with the Elena Voss analyst identity. Use the profile menu in the top bar to switch identities.

### Demo identities

All demo passwords are `nexus`.

| Identity | Role | Access summary |
| --- | --- | --- |
| Elena Voss | Intelligence Analyst | Analytical workspaces, incident workflow, reports, AI |
| Aris Thorne | Super Administrator | Full platform and permission administration |
| Mira Chen | System Administrator | Administration without role delegation |
| Dain Rook | Operations Manager | Incident assignment and operational command |
| Sera Ilyan | Researcher | Simulation and research analysis |
| Oren Vale | Read-only Observer | Read-only visibility across workspaces |

Direct route access is permission-gated. For example, `/admin` is rejected for the analyst role even if the URL is entered manually.

## Workspaces

- `/overview` — cross-domain operating picture and command priorities
- `/geoint` — 3D procedural city twin, layer controls, 2D schematic fallback
- `/infrastructure` — asset posture, dependency chains and maintenance exposure
- `/environment` — air, water and climate telemetry
- `/economy` — market momentum, trade flows and supply-chain exposure
- `/mobility` — transit, corridor and freight operations
- `/energy` — grid demand, reserve margin, generation mix and node ledger
- `/incidents` and `/incidents/:id` — incident ledger, workflow, notes and evidence
- `/simulation` — five deterministic scenario models with saved runs and comparison
- `/ai` — grounded local assistant with citations and thread history
- `/archive` — historical snapshots and closed incident records
- `/analytics` — saved dashboard workspaces and widget composition
- `/network` — typed entity graph and shortest-path analysis
- `/reports` and `/reports/:id` — structured report drafting, review, publishing and sharing
- `/entity/:id` — entity dossier, relationships, timeline and annotations
- `/admin` — identities, role matrix, audit explorer and environment settings

## Demo behavior and persistence

Demo state is stored in versioned localStorage keys:

- `nexus-platform-v1` — entities, incidents, notifications, reports, simulations, dashboards, conversations and audit logs
- `nexus-session-v1` — identities, role matrix, active session
- `nexus-ui-v1` — workspace, inspector, density and other interface preferences

Use **Administration → Environment → Reset demo data** to restore the seeded baseline. This replaces records created in the current browser.

### AI configuration

The assistant is grounded in local records and labels its engine as deterministic. To connect a compatible proxy, set:

```bash
VITE_NEXUS_AI_ENDPOINT=https://your-proxy.example/api/assist
```

When the variable is absent or the endpoint fails, the local fallback remains active. The UI must not claim a live model is connected unless the endpoint is configured.

## Production path

The repository includes a production-oriented database design:

- `supabase/migrations/0001_schema.sql` — enums, tables, indexes and triggers
- `supabase/migrations/0002_rls.sql` — row-level security, permission checks and security-definer RPCs

Copy `.env.example` to `.env.local` for production integration placeholders. The current client adapter is intentionally local-only; the Supabase variables are documented for the migration path and are not consumed by the demo store yet.

Client-side RBAC is a demonstration control. Production authorization must be enforced by PostgreSQL RLS and server-side RPCs. Never expose a Supabase service-role key to the browser.

See:

- `docs/ARCHITECTURE.md` — runtime topology, layers and state boundaries
- `docs/IMPLEMENTATION_PLAN.md` — delivery phases and scope
- `docs/DATABASE.md` — schema groups, RLS rules and environment variables

## Scripts

```bash
npm run dev        # Vite development server
npm run typecheck  # TypeScript project build check
npm test           # Vitest suite
npm run build      # typecheck + production bundle
npm run preview    # preview the production bundle
npm run lint       # Oxlint
```

## Verification

The current suite covers:

- RBAC catalog integrity and fail-closed role resolution
- Session login, role delegation and permission-matrix protection
- Incident transition legality, resolved → archived flow and store mutation rules
- Simulation determinism, bounded output and defensive defaults
- Notification preference gating, read-state invariants and demo reset

The production build is code-split by route. The 3D geospatial route is the largest chunk because Three.js is loaded only for that workspace.

## Accessibility and resilience

- Skip-to-workspace link, keyboard focus styles and semantic landmarks
- Reduced-motion handling in the shell, 3D scene, AI auto-scroll and animated metrics
- 2D SVG fallback when WebGL is unavailable
- Route-level error boundaries and loading skeletons
- Responsive navigation drawer and page layouts down to small screens
- Explicit simulated/demo labeling throughout the shell and analytical surfaces

## Limitations

- All domain data is synthetic and deterministic; there are no live feeds.
- The local assistant is not a general-purpose model and does not learn.
- Demo persistence is browser-local, not multi-user or server-authoritative.
- Supabase integration, real authentication and file storage are documented but not wired into this build.
- No external map tiles or third-party assets are used; the city is generated locally.
=======
# nexus-omniverse
>>>>>>> 6b04f13a272c524e908c9c09e516e107149dc741
