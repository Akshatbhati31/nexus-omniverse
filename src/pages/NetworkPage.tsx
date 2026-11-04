import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  ChevronRight,
  Download,
  GitBranch,
  Layers,
  Network,
  Search,
  ShieldCheck,
  Waypoints,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel, PanelHeader } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { EntityStatusBadge } from '../components/ui/StatusBadge'
import { DISTRICTS } from '../data/constants'
import { getEntityKindLabel } from '../data/entities'
import { formatRelative, titleCase } from '../lib/format'
import { cn, csvFromRows, downloadFile } from '../lib/utils'
import { usePlatformStore } from '../store/usePlatformStore'
import type { Entity, EntityKind } from '../types'

const KIND_META: Record<EntityKind, { label: string; color: string; ring: number }> = {
  city: { label: 'City', color: '#f2f8ff', ring: 0 },
  district: { label: 'District', color: '#56e1ff', ring: 1 },
  organization: { label: 'Organization', color: '#c2a8ff', ring: 2 },
  facility: { label: 'Facility', color: '#f3b85a', ring: 3 },
  route: { label: 'Route', color: '#5ce1a4', ring: 4 },
  economic: { label: 'Economic index', color: '#8f7cff', ring: 5 },
  environmental: { label: 'Environment', color: '#5b8def', ring: 5 },
  landmark: { label: 'Landmark', color: '#9ceeff', ring: 5 },
}

const RING_RADIUS = [0, 126, 206, 246, 286, 306]
const GRAPH_CENTER = { x: 450, y: 306 }

const RELATION_GROUPS: Array<{ label: string; types: string[]; color: string }> = [
  { label: 'Dependency', types: ['depends_on', 'powers', 'serves', 'protected_by', 'routes_through'], color: '#ff5d73' },
  { label: 'Containment', types: ['contains', 'part_of', 'located_in', 'hosts'], color: '#56e1ff' },
  { label: 'Coordination', types: ['coordinates_with', 'responds_to', 'regulates', 'regulated_by', 'owns'], color: '#8f7cff' },
  { label: 'Observation', types: ['monitors', 'measured_by', 'contributes_to'], color: '#5ce1a4' },
]

function relationColor(type: string) {
  return RELATION_GROUPS.find((group) => group.types.includes(type))?.color ?? '#7e91a8'
}

interface GraphLink {
  id: string
  source: string
  target: string
  type: string
  strength: number
}

interface PositionedEntity {
  entity: Entity
  x: number
  y: number
  degree: number
  radius: number
  color: string
}

function buildPositions(entities: Entity[]): PositionedEntity[] {
  const byKind = new Map<EntityKind, Entity[]>()
  entities.forEach((entity) => {
    byKind.set(entity.kind, [...(byKind.get(entity.kind) ?? []), entity])
  })

  const incoming = new Map<string, number>()
  entities.forEach((entity) => {
    entity.relations.forEach((relation) => {
      incoming.set(relation.targetId, (incoming.get(relation.targetId) ?? 0) + 1)
    })
  })

  return entities.map((entity) => {
    const meta = KIND_META[entity.kind]
    const group = byKind.get(entity.kind) ?? [entity]
    const index = group.findIndex((candidate) => candidate.id === entity.id)
    const angle = (index / Math.max(1, group.length)) * Math.PI * 2 - Math.PI / 2 + meta.ring * 0.22
    const radius = RING_RADIUS[meta.ring] ?? 306
    const degree = entity.relations.length + (incoming.get(entity.id) ?? 0)
    const baseRadius = entity.kind === 'city' ? 15 : entity.kind === 'district' ? 10 : 5.5
    return {
      entity,
      x: GRAPH_CENTER.x + Math.cos(angle) * radius,
      y: GRAPH_CENTER.y + Math.sin(angle) * radius * 0.82,
      degree,
      radius: baseRadius + Math.min(5, degree * 0.7),
      color: meta.color,
    }
  })
}

function neighborhood(entities: Entity[], originId: string, depth: number) {
  const adjacency = new Map<string, Set<string>>()
  entities.forEach((entity) => {
    const set = adjacency.get(entity.id) ?? new Set<string>()
    entity.relations.forEach((relation) => {
      set.add(relation.targetId)
      const reverse = adjacency.get(relation.targetId) ?? new Set<string>()
      reverse.add(entity.id)
      adjacency.set(relation.targetId, reverse)
    })
    adjacency.set(entity.id, set)
  })

  const seen = new Set([originId])
  let frontier = [originId]
  for (let level = 0; level < depth; level += 1) {
    const next: string[] = []
    frontier.forEach((id) => {
      adjacency.get(id)?.forEach((neighbor) => {
        if (!seen.has(neighbor)) {
          seen.add(neighbor)
          next.push(neighbor)
        }
      })
    })
    frontier = next
  }
  return seen
}

function shortestPath(entities: Entity[], fromId: string, toId: string) {
  if (!fromId || !toId) return []
  if (fromId === toId) return [fromId]
  const adjacency = new Map<string, string[]>()
  entities.forEach((entity) => {
    const targets = entity.relations.map((relation) => relation.targetId)
    adjacency.set(entity.id, targets)
    targets.forEach((target) => {
      adjacency.set(target, [...(adjacency.get(target) ?? []), entity.id])
    })
  })
  const queue = [fromId]
  const previous = new Map<string, string | null>([[fromId, null]])
  while (queue.length) {
    const current = queue.shift()
    if (!current) break
    for (const neighbor of adjacency.get(current) ?? []) {
      if (previous.has(neighbor)) continue
      previous.set(neighbor, current)
      if (neighbor === toId) {
        const path: string[] = []
        let cursor: string | null = toId
        while (cursor) {
          path.unshift(cursor)
          cursor = previous.get(cursor) ?? null
        }
        return path
      }
      queue.push(neighbor)
    }
  }
  return []
}

export default function NetworkPage() {
  const navigate = useNavigate()
  const entities = usePlatformStore((state) => state.entities)
  const incidents = usePlatformStore((state) => state.incidents)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<EntityKind | 'all'>('all')
  const [relationType, setRelationType] = useState('all')
  const [focusDepth, setFocusDepth] = useState<1 | 2>(1)
  const [dimOutsideFocus, setDimOutsideFocus] = useState(true)
  const [selectedId, setSelectedId] = useState('city-aurelia')
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pathTarget, setPathTarget] = useState('')

  const positions = useMemo(() => buildPositions(entities), [entities])
  const positionById = useMemo(() => new Map(positions.map((position) => [position.entity.id, position])), [positions])

  const allLinks = useMemo<GraphLink[]>(
    () =>
      entities.flatMap((entity) =>
        entity.relations
          .filter((relation) => positionById.has(relation.targetId))
          .map((relation, index) => ({
            id: `${entity.id}-${relation.targetId}-${index}`,
            source: entity.id,
            target: relation.targetId,
            type: relation.type,
            strength: relation.strength,
          })),
      ),
    [entities, positionById],
  )

  const relationTypes = useMemo(() => Array.from(new Set(allLinks.map((link) => link.type))).sort(), [allLinks])

  const filteredEntities = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return entities.filter((entity) => {
      if (kind !== 'all' && entity.kind !== kind) return false
      if (!normalized) return true
      return `${entity.name} ${entity.code} ${entity.tags.join(' ')} ${entity.description}`.toLowerCase().includes(normalized)
    })
  }, [entities, kind, query])

  const visibleIds = useMemo(() => new Set(filteredEntities.map((entity) => entity.id)), [filteredEntities])
  const visibleLinks = useMemo(
    () =>
      allLinks.filter(
        (link) =>
          visibleIds.has(link.source) &&
          visibleIds.has(link.target) &&
          (relationType === 'all' || link.type === relationType),
      ),
    [allLinks, relationType, visibleIds],
  )

  const selected = entities.find((entity) => entity.id === selectedId) ?? entities.find((entity) => entity.kind === 'city') ?? entities[0]
  const focusSet = useMemo(() => (selected ? neighborhood(entities, selected.id, focusDepth) : new Set<string>()), [entities, focusDepth, selected])
  const selectedRelations = selected
    ? selected.relations
        .map((relation) => ({ relation, target: entities.find((entity) => entity.id === relation.targetId) }))
        .filter((item): item is { relation: Entity['relations'][number]; target: Entity } => Boolean(item.target))
        .sort((a, b) => b.relation.strength - a.relation.strength)
    : []
  const linkedIncidents = selected
    ? incidents.filter((incident) => incident.primaryEntityId === selected.id || incident.relatedEntityIds.includes(selected.id))
    : []

  const graphStats = useMemo(() => {
    const degrees = positions.map((position) => position.degree)
    const average = degrees.reduce((sum, value) => sum + value, 0) / Math.max(1, degrees.length)
    const isolated = positions.filter((position) => position.degree === 0).length
    const seen = new Set<string>()
    let components = 0
    const adjacency = new Map<string, string[]>()
    allLinks.forEach((link) => {
      adjacency.set(link.source, [...(adjacency.get(link.source) ?? []), link.target])
      adjacency.set(link.target, [...(adjacency.get(link.target) ?? []), link.source])
    })
    entities.forEach((entity) => {
      if (seen.has(entity.id)) return
      components += 1
      const stack = [entity.id]
      while (stack.length) {
        const current = stack.pop()
        if (!current || seen.has(current)) continue
        seen.add(current)
        adjacency.get(current)?.forEach((neighbor) => {
          if (!seen.has(neighbor)) stack.push(neighbor)
        })
      }
    })
    return { average, isolated, components }
  }, [allLinks, entities, positions])

  const path = useMemo(() => shortestPath(entities, selected?.id ?? '', pathTarget), [entities, pathTarget, selected?.id])

  const exportGraph = () => {
    downloadFile(
      'aurelia-relationship-graph.csv',
      csvFromRows(
        allLinks.map((link) => ({
          source: entities.find((entity) => entity.id === link.source)?.name ?? link.source,
          target: entities.find((entity) => entity.id === link.target)?.name ?? link.target,
          relation: link.type,
          strength: link.strength,
        })),
      ),
    )
  }

  const isDimmed = (id: string) => {
    if (!dimOutsideFocus || !selected) return false
    return !focusSet.has(id)
  }

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        kicker="Operations // Relationship network"
        title="Everything touches everything."
        subtitle="Explore the typed dependency graph connecting districts, facilities, routes, organizations and environmental observation networks. Links are deterministic and derived from the platform entity model."
        meta={
          <>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <Network size={10} className="text-[var(--cyan)]" /> {positions.length} entities
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <GitBranch size={10} className="text-[var(--violet)]" /> {allLinks.length} typed relations
            </span>
            <span className="badge badge-amber">Simulated dependency model</span>
          </>
        }
        actions={
          <>
            <button type="button" className="btn" onClick={exportGraph}>
              <Download size={12} /> Export edge list
            </button>
            <button type="button" className="btn btn-primary" onClick={() => selected && navigate(`/entity/${selected.id}`)} disabled={!selected}>
              <ArrowUpRight size={12} /> Open dossier
            </button>
          </>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Graph entities', value: String(positions.length), detail: `${filteredEntities.length} visible after filters`, color: 'var(--cyan)' },
          { label: 'Typed relations', value: String(allLinks.length), detail: `${visibleLinks.length} currently rendered`, color: 'var(--violet)' },
          { label: 'Mean degree', value: graphStats.average.toFixed(1), detail: `${graphStats.isolated} isolated entities`, color: 'var(--green)' },
          { label: 'Connected components', value: String(graphStats.components), detail: 'components across the full graph', color: 'var(--amber)' },
        ].map((metric) => (
          <Panel key={metric.label} className="p-4">
            <div className="label-micro">{metric.label}</div>
            <div className="data-value mt-2 text-[26px]" style={{ color: metric.color }}>{metric.value}</div>
            <div className="mt-1 text-[9px] text-[var(--muted-2)]">{metric.detail}</div>
          </Panel>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <Panel className="xl:col-span-8">
          <PanelHeader
            title="Aurelia entity graph"
            eyebrow="Concentric kind layout · directional relations"
            icon={<Network size={13} />}
            action={
              <div className="flex items-center gap-1">
                <button type="button" className="icon-btn h-6 w-6" onClick={() => setZoom((value) => Math.max(0.7, Number((value - 0.15).toFixed(2))))} aria-label="Zoom out">
                  <ZoomOut size={12} />
                </button>
                <span className="w-9 text-center font-mono text-[8px] text-[var(--muted-2)]">{Math.round(zoom * 100)}%</span>
                <button type="button" className="icon-btn h-6 w-6" onClick={() => setZoom((value) => Math.min(1.8, Number((value + 0.15).toFixed(2))))} aria-label="Zoom in">
                  <ZoomIn size={12} />
                </button>
              </div>
            }
          />
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-2.5">
            <div className="relative min-w-[170px] flex-1">
              <Search size={11} className="absolute left-2.5 top-2.5 text-[var(--muted-2)]" />
              <input className="field h-8 min-h-0 pl-8 text-[10px]" placeholder="Search entity, code or tag…" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <select className="field h-8 min-h-0 w-auto text-[10px]" value={kind} onChange={(event) => setKind(event.target.value as EntityKind | 'all')} aria-label="Filter entity kind">
              <option value="all">All kinds</option>
              {(Object.keys(KIND_META) as EntityKind[]).map((item) => (
                <option key={item} value={item}>{KIND_META[item].label}</option>
              ))}
            </select>
            <select className="field h-8 min-h-0 w-auto text-[10px]" value={relationType} onChange={(event) => setRelationType(event.target.value)} aria-label="Filter relation type">
              <option value="all">All relations</option>
              {relationTypes.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
            </select>
            <select className="field h-8 min-h-0 w-auto text-[10px]" value={focusDepth} onChange={(event) => setFocusDepth(Number(event.target.value) as 1 | 2)} aria-label="Focus depth">
              <option value={1}>1-hop focus</option>
              <option value={2}>2-hop focus</option>
            </select>
            <button
              type="button"
              className={cn('btn h-8 text-[9px]', dimOutsideFocus && 'border-[var(--cyan)]/30 bg-[var(--cyan-dim)] text-[var(--cyan)]')}
              onClick={() => setDimOutsideFocus((value) => !value)}
              aria-pressed={dimOutsideFocus}
            >
              <Layers size={10} /> Dim outside focus
            </button>
          </div>

          <div className="relative h-[560px] overflow-hidden bg-[#050a10]">
            <svg viewBox="0 0 900 620" className="h-full w-full" role="img" aria-label="Interactive relationship graph of Aurelia entities">
              <defs>
                <pattern id="network-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(112,148,180,0.08)" strokeWidth="0.5" />
                </pattern>
                <radialGradient id="network-glow">
                  <stop offset="0%" stopColor="#56e1ff" stopOpacity="0.13" />
                  <stop offset="100%" stopColor="#56e1ff" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width="900" height="620" fill="#050a10" />
              <rect width="900" height="620" fill="url(#network-grid)" />
              <ellipse cx="450" cy="306" rx="390" ry="285" fill="url(#network-glow)" />
              <g transform={`translate(${GRAPH_CENTER.x} ${GRAPH_CENTER.y}) scale(${zoom}) translate(-${GRAPH_CENTER.x} -${GRAPH_CENTER.y})`}>
                {visibleLinks.map((link) => {
                  const source = positionById.get(link.source)
                  const target = positionById.get(link.target)
                  if (!source || !target) return null
                  const highlighted = !selected || focusSet.has(link.source) || focusSet.has(link.target)
                  const color = relationColor(link.type)
                  const active = selected?.id === link.source || selected?.id === link.target
                  return (
                    <line
                      key={link.id}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={active ? color : 'rgba(146,174,203,0.28)'}
                      strokeWidth={active ? 1.6 : 0.7}
                      strokeOpacity={highlighted ? (active ? 0.85 : 0.4) : 0.08}
                      strokeDasharray={link.type === 'depends_on' || link.type === 'powers' ? '4 4' : undefined}
                    />
                  )
                })}
                {positions
                  .filter((position) => visibleIds.has(position.entity.id))
                  .map((position) => {
                    const dimmed = isDimmed(position.entity.id)
                    const isSelected = selected?.id === position.entity.id
                    const isHovered = hoverId === position.entity.id
                    const showLabel =
                      position.entity.kind === 'city' ||
                      position.entity.kind === 'district' ||
                      isSelected ||
                      isHovered ||
                      focusSet.has(position.entity.id)
                    return (
                      <g
                        key={position.entity.id}
                        transform={`translate(${position.x} ${position.y})`}
                        opacity={dimmed ? 0.32 : 1}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoverId(position.entity.id)}
                        onMouseLeave={() => setHoverId(null)}
                        onClick={() => {
                          setSelectedId(position.entity.id)
                          setPathTarget('')
                        }}
                      >
                        <title>{`${position.entity.name} · ${getEntityKindLabel(position.entity.kind)} · ${position.degree} relations`}</title>
                        {isSelected ? (
                          <circle r={position.radius + 7} fill="none" stroke={position.color} strokeWidth="0.8" strokeOpacity="0.55" strokeDasharray="2 4" />
                        ) : null}
                        <circle r={position.radius + 4} fill={position.color} opacity={isSelected || isHovered ? 0.16 : 0.06} />
                        <circle
                          r={position.radius}
                          fill={position.color}
                          fillOpacity={isSelected ? 0.9 : 0.55}
                          stroke={position.color}
                          strokeWidth={isSelected ? 1.6 : 0.8}
                          strokeOpacity={isSelected ? 1 : 0.55}
                        />
                        {position.entity.status === 'degraded' || position.entity.status === 'offline' ? (
                          <circle r={2.5} cx={position.radius * 0.8} cy={-position.radius * 0.8} fill={position.entity.status === 'offline' ? '#ff5d73' : '#f3b85a'} />
                        ) : null}
                        {showLabel ? (
                          <text
                            y={position.radius + 13}
                            textAnchor="middle"
                            fontSize={position.entity.kind === 'district' ? 8 : 7}
                            fontFamily="JetBrains Mono Variable, monospace"
                            fill={isSelected ? '#f2f8ff' : '#8ea3ba'}
                            className="pointer-events-none"
                          >
                            {position.entity.kind === 'city' ? position.entity.name : position.entity.code}
                          </text>
                        ) : null}
                      </g>
                    )
                  })}
              </g>
            </svg>

            <div className="pointer-events-none absolute left-3 top-3 border border-[var(--line)] bg-[rgba(6,10,15,0.86)] px-2.5 py-2">
              <div className="label-micro mb-1.5">Entity kinds</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {(Object.keys(KIND_META) as EntityKind[]).map((item) => (
                  <div key={item} className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5" style={{ background: KIND_META[item].color }} />
                    <span className="font-mono text-[7.5px] uppercase tracking-[0.06em] text-[var(--muted)]">{KIND_META[item].label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-2">
              <div className="flex flex-wrap items-center gap-3">
                {RELATION_GROUPS.map((group) => (
                  <div key={group.label} className="flex items-center gap-1.5">
                    <span className="h-px w-4" style={{ background: group.color }} />
                    <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{group.label}</span>
                  </div>
                ))}
              </div>
              <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">Click a node to focus · dashed links indicate dependency</span>
            </div>
          </div>
        </Panel>

        <div className="space-y-3 xl:col-span-4">
          <Panel>
            <PanelHeader title={selected?.name ?? 'Select an entity'} eyebrow={selected ? `${selected.code} · ${getEntityKindLabel(selected.kind)}` : 'No selection'} icon={<ShieldCheck size={13} />} action={selected ? <EntityStatusBadge status={selected.status} /> : null} />
            {selected ? (
              <div className="p-4">
                <p className="text-[10.5px] leading-relaxed text-[var(--muted)]">{selected.description}</p>
                <div className="mt-3 grid grid-cols-2 gap-px bg-[var(--line)]">
                  <div className="bg-[rgba(8,13,19,0.92)] px-3 py-2.5">
                    <div className="label-micro">Criticality</div>
                    <div className="mt-1 font-mono text-[11px] uppercase text-[var(--text-bright)]">{selected.criticality}</div>
                  </div>
                  <div className="bg-[rgba(8,13,19,0.92)] px-3 py-2.5">
                    <div className="label-micro">District</div>
                    <div className="mt-1 truncate text-[10.5px] text-[var(--text-bright)]">{DISTRICTS.find((district) => district.id === selected.districtId)?.name ?? 'Theater'}</div>
                  </div>
                  <div className="bg-[rgba(8,13,19,0.92)] px-3 py-2.5">
                    <div className="label-micro">Relations</div>
                    <div className="mt-1 font-mono text-[11px] text-[var(--text-bright)]">{selected.relations.length}</div>
                  </div>
                  <div className="bg-[rgba(8,13,19,0.92)] px-3 py-2.5">
                    <div className="label-micro">Last signal</div>
                    <div className="mt-1 font-mono text-[10px] text-[var(--text-bright)]">{formatRelative(selected.updatedAt)}</div>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {selected.vitals.slice(0, 3).map((vital) => (
                    <div key={vital.label}>
                      <div className="flex items-center justify-between gap-2 text-[9px]">
                        <span className="text-[var(--muted)]">{vital.label}</span>
                        <span className="font-mono text-[var(--text-bright)]">{vital.value.toLocaleString()} <span className="text-[var(--muted-2)]">{vital.unit}</span></span>
                      </div>
                      <ProgressBar value={Math.max(0, Math.min(100, vital.format === 'percent' ? vital.value : vital.value / 100))} color="var(--cyan)" className="mt-1.5" />
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-primary mt-4 w-full" onClick={() => navigate(`/entity/${selected.id}`)}>
                  <ArrowUpRight size={11} /> Open full dossier
                </button>
              </div>
            ) : null}
          </Panel>

          <Panel>
            <PanelHeader title="Relation ledger" eyebrow="Ordered by strength" icon={<GitBranch size={13} />} action={<span className="font-mono text-[8px] text-[var(--muted-2)]">{selectedRelations.length} links</span>} />
            <div className="max-h-[260px] overflow-y-auto">
              {selectedRelations.map(({ relation, target }) => (
                <button
                  key={`${target.id}-${relation.type}`}
                  type="button"
                  className="group flex w-full items-center gap-2.5 border-b border-[var(--line)] px-4 py-2.5 text-left last:border-0 hover:bg-white/[0.025]"
                  onClick={() => {
                    setSelectedId(target.id)
                    setPathTarget('')
                  }}
                >
                  <span className="h-1.5 w-1.5 flex-none" style={{ background: relationColor(relation.type) }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10px] text-[var(--text)]">{target.name}</span>
                    <span className="mt-0.5 block font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{titleCase(relation.type)} · {target.code}</span>
                  </span>
                  <span className="font-mono text-[8px] text-[var(--muted-2)]">{Math.round(relation.strength * 100)}%</span>
                  <ChevronRight size={10} className="text-[var(--muted-2)] transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
              {selectedRelations.length === 0 ? <div className="px-4 py-6 text-center text-[9px] text-[var(--muted-2)]">No outgoing relations recorded.</div> : null}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Path finder" eyebrow="Shortest typed path" icon={<Waypoints size={13} />} />
            <div className="p-4">
              <label>
                <span className="label-micro">Destination entity</span>
                <select className="field mt-1.5 text-[10px]" value={pathTarget} onChange={(event) => setPathTarget(event.target.value)}>
                  <option value="">Select a destination…</option>
                  {entities.filter((entity) => entity.id !== selected?.id).map((entity) => (
                    <option key={entity.id} value={entity.id}>{entity.name} · {entity.code}</option>
                  ))}
                </select>
              </label>
              {pathTarget ? (
                path.length ? (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {path.map((id, index) => {
                      const entity = entities.find((candidate) => candidate.id === id)
                      return (
                        <span key={id} className="flex items-center gap-1.5">
                          {index > 0 ? <ChevronRight size={9} className="text-[var(--muted-2)]" /> : null}
                          <button
                            type="button"
                            className="border border-[var(--line)] bg-white/[0.02] px-2 py-1 font-mono text-[8px] text-[var(--text)] hover:border-[var(--cyan)]/40"
                            onClick={() => setSelectedId(id)}
                          >
                            {entity?.code ?? id}
                          </button>
                        </span>
                      )
                    })}
                  </div>
                ) : (
                  <p className="mt-3 border border-[var(--amber)]/20 bg-[var(--amber-dim)] p-2.5 text-[9px] leading-relaxed text-[var(--muted)]">No connected path is recorded between these entities in the current graph.</p>
                )
              ) : (
                <p className="mt-3 text-[9px] leading-relaxed text-[var(--muted-2)]">Select a destination to trace the shortest recorded relationship path.</p>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Linked incidents" eyebrow="Operational context" icon={<ShieldCheck size={13} />} action={<span className="badge badge-muted">{linkedIncidents.length}</span>} />
            <div className="divide-y divide-[var(--line)]">
              {linkedIncidents.slice(0, 4).map((incident) => (
                <button key={incident.id} type="button" className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-white/[0.025]" onClick={() => navigate(`/incidents/${incident.id}`)}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10px] text-[var(--text)]">{incident.title}</span>
                    <span className="mt-0.5 block font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{incident.reference} · {incident.status}</span>
                  </span>
                  <ChevronRight size={10} className="text-[var(--muted-2)]" />
                </button>
              ))}
              {linkedIncidents.length === 0 ? <div className="px-4 py-6 text-center text-[9px] text-[var(--muted-2)]">No incidents reference this entity.</div> : null}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
