# Implementation Plan

## Phase 1 — Foundation
- Vite / React / TypeScript / Tailwind scaffold.
- Semantic design tokens, typography, panel system, grid background, motion primitives.
- Persistent shell, navigation rail, expandable subsystem panel, topbar, status bar.
- Route map and lazy loading boundaries.
- Command palette, keyboard shortcuts, notification drawer, inspector shell.

## Phase 2 — Data and access
- Typed domain model and deterministic seed generator.
- Zustand domain store with versioned localStorage persistence.
- Demo identity/session store, role matrix and permission checks.
- Audit log for privileged actions.
- Supabase schema, indexes and RLS migration for production.

## Phase 3 — Geographic and 3D
- Procedural Aurelia city geometry, river, bridges, roads, transit.
- Building selection, layer toggles, legends, camera modes.
- Animated traffic and transit.
- 2D SVG city mode with matching layers.
- GeoInt workspace and contextual entity inspector.

## Phase 4 — Intelligence workspaces
- Overview command surface.
- Infrastructure dependency graph and network tabs.
- Environmental, economic, mobility and energy subsystems with domain-specific analytics.

## Phase 5 — Operations
- Incident feed, filters, severity handling and detailed dossiers.
- State-machine workflow with permission checks.
- Assignments, notes, evidence, relationship graph and resolution reporting.
- Persistent notification generation and preferences.

## Phase 6 — Simulation and network
- Deterministic scenario engine for route closure, power shortage, rainfall and supply chain shocks.
- Parameter builder, timeline, result charts, impact analysis, saved runs and comparison.
- Interactive SVG relationship graph with pan, zoom, drag, filters and expansion.

## Phase 7 — AI and temporal
- Multi-conversation intelligence workstation.
- Deterministic local responses and optional external endpoint adapter.
- Source references, streaming-style reveal, export and deletion.
- Temporal archive with scrubber, date comparison and event overlay.

## Phase 8 — Analysis and administration
- Dashboard builder with draggable/resizable widgets and saved layouts.
- Report editor with blocks, entity references, print/PDF and sharing controls.
- User administration, role/permission editor, audit explorer and system settings.

## Phase 9 — Quality
- Unit tests for critical business logic.
- TypeScript check, production build, bundle inspection.
- Responsive and browser smoke verification.
- Documentation and environment template.
