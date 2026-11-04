# NEXUS // OMNIVERSE — Architecture

## 1. System intent

NEXUS // OMNIVERSE is a civilization-scale intelligence and simulation operating environment. It is structured as an operating system rather than a website: a persistent global shell surrounds independently loaded subsystems, all sharing a typed data fabric and a single contextual state model.

The running build is a **deterministic demo environment**. It does not represent live-world data. Every generated observation is derived from a fixed seed and the application labels its simulated status in the shell and on analytical surfaces. Production deployment can replace the local persistence adapter with Supabase without changing page-level contracts.

## 2. Runtime topology

```
Browser
├── Global shell (persistent)
│   ├── Navigation rail + expandable subsystem panels
│   ├── Command palette / universal search / actions
│   ├── Notification center
│   ├── Contextual inspector
│   ├── Workspace selector, simulated clock, system health
│   └── Keyboard shortcut layer
├── Lazy-loaded subsystem routes
│   ├── Overview / GeoInt / Infrastructure / Environment
│   ├── Economy / Mobility / Energy / Incidents
│   ├── Simulation Lab / Network / Temporal Archive
│   ├── Analytics Studio / AI Intelligence / Reports / Admin
│   └── Entity dossiers + incident dossiers
├── Shared domain services
│   ├── Deterministic dataset generator
│   ├── Simulation engine (graph propagation)
│   ├── Permission engine
│   ├── Incident workflow state machine
│   ├── AI deterministic fallback + optional endpoint adapter
│   └── Export helpers
└── Persistence adapter
    ├── Demo: Zustand persist → localStorage (versioned)
    └── Production: Supabase/PostgreSQL + RLS (migration included)
```

## 3. Layer model

| Layer | Responsibility | Implementation |
| --- | --- | --- |
| L0 | Global operating environment | `components/layout`, command palette, notification center, inspector |
| L1 | Intelligence network | Route-level workspaces under `pages` |
| L2 | Specialized workspaces | Tabs, nested panels, toolbars inside each page |
| L3 | Entity details | `/entity/:id`, `/incidents/:id`, reusable dossier components |
| L4 | Analytics and exploration | `/analytics` grid builder, split comparisons, saved layouts |

## 4. Frontend architecture

- **React 19 + TypeScript + Vite** with route-level `React.lazy` boundaries.
- **React Router** for navigation; every workspace has a stable deep link.
- **Zustand** stores separated by concern:
  - `useSessionStore` — demo identities, role resolution, session state.
  - `usePlatformStore` — domain records, workflows, audit logs, preferences.
  - `useUIStore` — transient UI state, inspector target, palette and drawer state.
- **Design system** — Tailwind 4 plus semantic CSS tokens and composed primitives (`Panel`, `Button`, `Badge`, `Metric`, `Tabs`, `Toolbar`).
- **Motion** — Framer Motion at route and panel level; CSS for ambient effects; reduced-motion respected at both levels.
- **Charts** — Recharts for standard statistical views, custom SVG for network, heatmaps and 2D geography.
- **3D** — React Three Fiber / Three.js procedural city with instanced building geometry, animated transit, layer systems and camera state machine.
- **Error isolation** — route-level error boundary and Suspense skeletons; the 3D canvas is lazy loaded and independently recoverable.

## 5. Domain model

The core record graph is:

```
User ── role ── permission
Workspace ── membership
Entity ── location
Entity ── relation ── Entity
Entity ── observation
Incident ── entity/location
Incident ── assignment ── team
Incident ── timeline/evidence/notes
Simulation ── scenario ── result
Report ── entity references / charts
Conversation ── messages
Notification
AuditLog
Dashboard ── widgets
```

Entity kinds include `city`, `district`, `facility`, `route`, `organization`, `economic`, `environmental`, and `landmark`. Relations are typed and directional where relevant (`powers`, `serves`, `depends_on`, `monitors`, `routes_through`, `owns`, `responds_to`).

## 6. Security posture

### Demo mode
- Local role-based gates protect every privileged interaction in the UI.
- All privileged domain actions record an audit event.
- Demo credentials are local fixtures and are not a security boundary. The UI labels the environment as demo/simulated.

### Production mode
- Authentication via Supabase Auth.
- Role and permission checks enforced by PostgreSQL Row Level Security, not only the client.
- Service-role credentials never shipped to the browser.
- Environment variables configured in `.env.local`; no private keys committed.
- Full migration and policy pack in `supabase/migrations`.

## 7. Performance strategy

- Route-level code splitting via dynamic imports.
- 3D subsystem isolated in its own lazy chunk; WebGL pixel ratio capped.
- Buildings rendered with instancing.
- Deterministic data generated once at seed or memoized per configuration.
- Long lists paginated or capped; incident feed virtualized by page.
- Charts use `ResponsiveContainer` and fixed-height parents.
- Motion and expensive ambient layers respect reduced-motion.
- 3D DPR and shadows are constrained; optional effects avoid postprocessing dependencies.

## 8. AI integration boundary

`services/ai.ts` defines an async adapter:

1. If `VITE_NEXUS_AI_ENDPOINT` is configured, messages are posted to that endpoint with conversation context and platform references.
2. Otherwise a deterministic local intelligence engine answers from the platform dataset.
3. The interface displays the active engine and never claims a live model is connected unless configured.

## 9. Testing

Vitest covers deterministic generators, RBAC, incident transitions, simulation graph propagation and notification invariants. TypeScript compilation and production bundling are release gates.
