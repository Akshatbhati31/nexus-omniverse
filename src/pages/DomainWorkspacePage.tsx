import { useMemo } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  FilterX,
  GitBranch,
  Layers3,
  Network,
  Search,
  ShieldAlert,
  Siren,
  Crosshair,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ChartFrame } from '../components/charts/ChartFrame'
import { SeriesChart } from '../components/charts/SeriesChart'
import { Breadcrumbs } from '../components/layout/Breadcrumbs'
import { WorkspaceNav } from '../components/layout/WorkspaceNav'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel, PanelHeader } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { EntityStatusBadge, IncidentStatusBadge, SeverityBadge } from '../components/ui/StatusBadge'
import { DISTRICTS, DISTRICTS_BY_ID } from '../data/constants'
import { getDataset } from '../data/datasets'
import { getEntityKindLabel } from '../data/entities'
import {
  getDomain,
  getWorkspaceById,
  getWorkspaceEntities,
  getWorkspaceHref,
  type DomainWorkspace,
  type WorkspaceTone,
} from '../data/workspaces'
import { useQueryState } from '../hooks/useQueryState'
import { formatRelative, titleCase } from '../lib/format'
import { cn, csvFromRows, downloadFile } from '../lib/utils'
import { usePlatformStore } from '../store/usePlatformStore'
import type { Entity } from '../types'

const STATUS_OPTIONS = ['all', 'operational', 'degraded', 'offline', 'maintenance', 'unknown'] as const
const CRITICALITY_OPTIONS = ['all', 'critical', 'high', 'moderate', 'low'] as const
const SORT_OPTIONS = ['priority', 'name', 'updated', 'district'] as const
const DISTRICT_FILTERS = ['all', ...DISTRICTS.map((district) => district.id)] as const

const TONE_COLORS: Record<WorkspaceTone, string> = {
  cyan: 'var(--cyan)',
  green: 'var(--green)',
  amber: 'var(--amber)',
  red: 'var(--red)',
  violet: 'var(--violet)',
}

const statusRank = (entity: Entity) => {
  if (entity.status === 'offline') return 0
  if (entity.status === 'degraded') return 1
  if (entity.status === 'maintenance') return 2
  if (entity.status === 'unknown') return 3
  return 4
}

const criticalityRank = (entity: Entity) => {
  if (entity.criticality === 'critical') return 0
  if (entity.criticality === 'high') return 1
  if (entity.criticality === 'moderate') return 2
  return 3
}

export default function DomainWorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const entities = usePlatformStore((state) => state.entities)
  const incidents = usePlatformStore((state) => state.incidents)
  const workspace = getWorkspaceById(workspaceId)
  const domain = workspace ? getDomain(workspace.domain) : undefined

  const [query, setQuery] = useQueryState<string>('q', '')
  const [status, setStatus] = useQueryState('status', 'all', STATUS_OPTIONS)
  const [criticality, setCriticality] = useQueryState('criticality', 'all', CRITICALITY_OPTIONS)
  const [district, setDistrict] = useQueryState('district', 'all', DISTRICT_FILTERS)
  const [sort, setSort] = useQueryState('sort', 'priority', SORT_OPTIONS)
  const [selectedId, setSelectedId] = useQueryState<string>('entity', '')

  const scoped = useMemo(() => (workspace ? getWorkspaceEntities(workspace, entities) : []), [entities, workspace])
  const filtered = useMemo(
    () =>
      scoped.filter((entity) => {
        if (status !== 'all' && entity.status !== status) return false
        if (criticality !== 'all' && entity.criticality !== criticality) return false
        if (district !== 'all' && entity.districtId !== district && entity.id !== district) return false
        if (query.trim()) {
          const haystack = `${entity.name} ${entity.code} ${entity.tags.join(' ')} ${entity.description}`.toLowerCase()
          if (!haystack.includes(query.trim().toLowerCase())) return false
        }
        return true
      }),
    [criticality, district, query, scoped, status],
  )
  const sorted = useMemo(() => {
    const next = [...filtered]
    next.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'updated') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      if (sort === 'district') {
        const left = DISTRICTS_BY_ID[a.districtId ?? '']?.name ?? 'Theater'
        const right = DISTRICTS_BY_ID[b.districtId ?? '']?.name ?? 'Theater'
        return left.localeCompare(right)
      }
      return statusRank(a) - statusRank(b) || criticalityRank(a) - criticalityRank(b) || a.name.localeCompare(b.name)
    })
    return next
  }, [filtered, sort])

  const selected = sorted.find((entity) => entity.id === selectedId) ?? scoped.find((entity) => entity.id === selectedId) ?? sorted[0] ?? scoped[0]

  const scopedIds = useMemo(() => new Set(scoped.map((entity) => entity.id)), [scoped])
  const linkedIncidents = useMemo(
    () =>
      incidents
        .filter((incident) => scopedIds.has(incident.primaryEntityId) || incident.relatedEntityIds.some((id) => scopedIds.has(id)))
        .sort((a, b) => {
          const activeA = !['resolved', 'archived'].includes(a.status) ? 1 : 0
          const activeB = !['resolved', 'archived'].includes(b.status) ? 1 : 0
          return activeB - activeA || b.impactScore - a.impactScore
        }),
    [incidents, scopedIds],
  )
  const activeLinked = linkedIncidents.filter((incident) => !['resolved', 'archived'].includes(incident.status))
  const selectedIncidents = selected
    ? linkedIncidents
        .filter((incident) => incident.primaryEntityId === selected.id || incident.relatedEntityIds.includes(selected.id))
        .slice(0, 3)
    : []
  const selectedRelations = useMemo(() => {
    if (!selected) return []
    return selected.relations
      .map((relation) => ({ relation, target: entities.find((entity) => entity.id === relation.targetId) }))
      .filter((entry): entry is { relation: Entity['relations'][number]; target: Entity } => Boolean(entry.target))
      .sort((a, b) => b.relation.strength - a.relation.strength)
      .slice(0, 3)
  }, [entities, selected])
  const districtCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const entity of scoped) {
      if (!entity.districtId) continue
      counts.set(entity.districtId, (counts.get(entity.districtId) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [scoped])
  const relatedWorkspaces = useMemo(
    () =>
      (workspace?.relatedWorkspaceIds ?? [])
        .map((id) => getWorkspaceById(id))
        .filter((item): item is DomainWorkspace => Boolean(item)),
    [workspace],
  )

  if (!workspace || !domain) {
    return (
      <div className="p-4 lg:p-6">
        <Breadcrumbs items={[{ label: 'Global overview', to: '/overview' }, { label: 'Unknown workspace' }]} />
        <Panel>
          <EmptyState
            icon={Network}
            title="Workspace not found"
            description="This specialized workspace is not registered in the current domain model. Return to the module overview to choose a valid Level 2 workspace."
            action={<Link to="/overview" className="btn btn-primary"><ArrowLeft size={12} /> Return to overview</Link>}
          />
        </Panel>
      </div>
    )
  }

  const dataset = getDataset(workspace.chartDatasetId)
  const hasFilters = query.trim() !== '' || status !== 'all' || criticality !== 'all' || district !== 'all'
  const criticalCount = filtered.filter((entity) => entity.criticality === 'critical').length

  const entityHref = (entity: Entity) => {
    const params = new URLSearchParams({ from: workspace.domain, workspace: workspace.id })
    if (entity.districtId) params.set('district', entity.districtId)
    return `/entity/${entity.id}?${params.toString()}`
  }

  const incidentHref = (incidentId: string) => {
    const params = new URLSearchParams({ from: workspace.domain, workspace: workspace.id })
    if (selected?.districtId) params.set('district', selected.districtId)
    if (selected) params.set('entity', selected.id)
    return `/incidents/${incidentId}?${params.toString()}`
  }

  const contextHref = (path: string) => {
    if (district === 'all') return path
    return `${path}?district=${encodeURIComponent(district)}`
  }

  const exportScope = () => {
    downloadFile(
      `${workspace.id}-workspace-scope.csv`,
      csvFromRows(
        sorted.map((entity) => ({
          id: entity.id,
          name: entity.name,
          code: entity.code,
          kind: entity.kind,
          status: entity.status,
          criticality: entity.criticality,
          district: DISTRICTS_BY_ID[entity.districtId ?? '']?.name ?? 'Theater',
          tags: entity.tags.join('|'),
        })),
      ),
    )
  }

  return (
    <div className="p-4 lg:p-6">
      <Breadcrumbs
        items={[
          { label: 'Global overview', to: '/overview' },
          { label: domain.label, to: domain.path },
          { label: workspace.label },
        ]}
      />

      <PageHeader
        kicker={`${domain.code} // Level 2 workspace`}
        title={workspace.label}
        subtitle={workspace.description}
        meta={
          <>
            <span className="badge badge-cyan">Level 2 · specialized workspace</span>
            <span className="badge badge-amber">Deterministic simulation</span>
            <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">{workspace.code}</span>
            <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{scoped.length} scoped records</span>
          </>
        }
        actions={
          <>
            <Link to={domain.path} className="btn"><ArrowLeft size={12} /> Module overview</Link>
            <button type="button" className="btn btn-primary" onClick={exportScope}><Download size={12} /> Export scope</button>
          </>
        }
      />

      <WorkspaceNav domain={workspace.domain} />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {workspace.metrics.map((metric) => {
              const color = TONE_COLORS[metric.tone]
              return (
                <Panel key={metric.label} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="label-micro">{metric.label}</span>
                    <span className="mt-1 h-1 w-1 flex-none" style={{ background: color, boxShadow: `0 0 8px ${color}66` }} />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="data-value text-[24px]" style={{ color }}>{metric.value}</span>
                    <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{metric.unit}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="font-mono text-[8px]" style={{ color }}>{metric.delta}</span>
                    <span className="font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--muted-2)]">simulated</span>
                  </div>
                  <div className="mt-1 text-[9px] leading-relaxed text-[var(--muted)]">{metric.detail}</div>
                </Panel>
              )
            })}
          </div>

          <ChartFrame
            title={workspace.chartTitle}
            source={`${dataset.source} · simulated`}
            dataset={dataset}
            exportName={`${workspace.id}-telemetry`}
            footer={
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">Scope · {scoped.length} records · deterministic fixture</span>
                <span className="font-mono text-[8px] text-[var(--muted)]">{workspace.chartType} view · no external feed</span>
              </div>
            }
          >
            <SeriesChart dataset={dataset} type={workspace.chartType} height={220} />
          </ChartFrame>

          <Panel>
            <PanelHeader
              title="Entity register"
              eyebrow={workspace.tagline}
              icon={<Layers3 size={13} />}
              action={<span className="font-mono text-[8px] text-[var(--muted-2)]">{sorted.length} / {scoped.length} records</span>}
            />
            <div className="flex flex-col gap-2 border-b border-[var(--line)] p-3 lg:flex-row lg:items-center">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Filter workspace records</span>
                <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-2)]" />
                <input
                  className="field pl-8 text-[10.5px]"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter by name, code, tag or description"
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <label>
                  <span className="sr-only">Filter by status</span>
                  <select className="field w-[126px] text-[9px]" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
                    {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option === 'all' ? 'All statuses' : titleCase(option)}</option>)}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Filter by criticality</span>
                  <select className="field w-[130px] text-[9px]" value={criticality} onChange={(event) => setCriticality(event.target.value as typeof criticality)}>
                    {CRITICALITY_OPTIONS.map((option) => <option key={option} value={option}>{option === 'all' ? 'All criticality' : titleCase(option)}</option>)}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Filter by district</span>
                  <select className="field w-[142px] text-[9px]" value={district} onChange={(event) => setDistrict(event.target.value as typeof district)}>
                    <option value="all">All districts</option>
                    {DISTRICTS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Sort workspace records</span>
                  <select className="field w-[124px] text-[9px]" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
                    <option value="priority">Priority</option>
                    <option value="name">Name</option>
                    <option value="updated">Recently updated</option>
                    <option value="district">District</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setQuery('')
                    setStatus('all')
                    setCriticality('all')
                    setDistrict('all')
                  }}
                  disabled={!hasFilters}
                >
                  <FilterX size={10} /> Clear
                </button>
              </div>
            </div>
            <div className="max-h-[480px] overflow-y-auto">
              {sorted.map((entity) => {
                const entityDistrict = DISTRICTS_BY_ID[entity.districtId ?? '']
                const primaryVital = entity.vitals[0]
                return (
                  <div
                    key={entity.id}
                    className={cn(
                      'flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--line)] px-3 py-2.5 transition-colors last:border-b-0',
                      selected?.id === entity.id ? 'bg-[rgba(86,225,255,0.04)]' : 'hover:bg-white/[0.025]',
                    )}
                  >
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedId(entity.id)}>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[10.5px] text-[var(--text)]">{entity.name}</span>
                        <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{entity.code}</span>
                      </span>
                      <span className="mt-0.5 block font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">
                        {getEntityKindLabel(entity.kind)} · {entityDistrict?.name ?? 'Theater scope'}
                      </span>
                    </button>
                    <div className="flex flex-none items-center gap-2">
                      <EntityStatusBadge status={entity.status} />
                      <span className="hidden font-mono text-[8px] text-[var(--muted)] lg:inline">
                        {primaryVital ? `${primaryVital.value.toLocaleString()} ${primaryVital.unit}` : 'No vital'}
                      </span>
                      <Link to={entityHref(entity)} className="btn btn-sm h-6" aria-label={`Open ${entity.name} dossier`}>
                        Dossier <ArrowUpRight size={9} />
                      </Link>
                    </div>
                  </div>
                )
              })}
              {sorted.length === 0 ? (
                <div className="px-4 py-10 text-center text-[10px] text-[var(--muted)]">No records match the current workspace query.</div>
              ) : null}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title={workspace.brief.title}
              eyebrow="Workspace assessment"
              icon={<ShieldAlert size={13} />}
              action={<span className="badge badge-amber">Modeled judgment</span>}
            />
            <div className="grid gap-4 p-4 lg:grid-cols-[1.35fr_0.65fr]">
              <p className="text-[11px] leading-[1.8] text-[var(--muted)]">{workspace.brief.body}</p>
              <div className="space-y-2">
                {workspace.brief.factors.map((factor, index) => (
                  <div key={factor} className="flex items-start gap-2 border border-[var(--line)] bg-black/20 px-2.5 py-2">
                    <span className="font-mono text-[8px] text-[var(--cyan)]">{String(index + 1).padStart(2, '0')}</span>
                    <span className="text-[9px] leading-relaxed text-[var(--muted)]">{factor}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>

        <aside className="space-y-3">
          <Panel>
            <PanelHeader title="Workspace scope" eyebrow="Current query" icon={<Layers3 size={13} />} />
            <div className="grid grid-cols-2 gap-px bg-[var(--line)]">
              {[
                { label: 'Visible records', value: String(sorted.length) },
                { label: 'Active incidents', value: String(activeLinked.length) },
                { label: 'Critical assets', value: String(criticalCount) },
                { label: 'Districts', value: String(districtCounts.length) },
              ].map((item) => (
                <div key={item.label} className="bg-[rgba(8,13,19,0.92)] px-3 py-2.5">
                  <div className="label-micro">{item.label}</div>
                  <div className="data-value mt-1 text-[17px]">{item.value}</div>
                </div>
              ))}
            </div>
            <div className="space-y-2.5 p-3">
              <div className="label-micro">Record distribution</div>
              {districtCounts.map(([districtId, count]) => {
                const definition = DISTRICTS_BY_ID[districtId]
                if (!definition) return null
                return (
                  <div key={districtId}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[9px] text-[var(--text)]">{definition.name}</span>
                      <span className="font-mono text-[8px] text-[var(--muted)]">{count}</span>
                    </div>
                    <ProgressBar value={(count / Math.max(1, scoped.length)) * 100} color={definition.color} />
                  </div>
                )
              })}
              {districtCounts.length === 0 ? <div className="text-[9px] text-[var(--muted-2)]">No district-linked records in scope.</div> : null}
            </div>
          </Panel>

          {selected ? (
            <Panel>
              <PanelHeader
                title={selected.name}
                eyebrow="Focused record"
                icon={<Crosshair size={13} />}
                action={<Link to={entityHref(selected)} className="btn btn-sm h-6">Dossier <ArrowUpRight size={9} /></Link>}
              />
              <div className="p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <EntityStatusBadge status={selected.status} />
                  <span className="badge badge-muted">{selected.criticality}</span>
                  <span className="badge badge-muted">{getEntityKindLabel(selected.kind)}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-px bg-[var(--line)]">
                  {selected.vitals.slice(0, 4).map((vital) => (
                    <div key={vital.label} className="bg-[rgba(8,13,19,0.92)] px-2.5 py-2">
                      <div className="label-micro">{vital.label}</div>
                      <div className="mt-1 font-mono text-[12px] text-[var(--text-bright)]">{vital.value.toLocaleString()} <span className="text-[7px] text-[var(--muted)]">{vital.unit}</span></div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 border-t border-[var(--line)] pt-2.5">
                  <div className="label-micro mb-1.5">Dependency edges</div>
                  {selectedRelations.map(({ relation, target }) => (
                    <Link key={`${target.id}-${relation.type}`} to={entityHref(target)} className="flex items-center justify-between gap-2 py-1 text-[9px] text-[var(--muted)] transition-colors hover:text-[var(--cyan)]">
                      <span className="truncate">{target.name}</span>
                      <span className="flex-none font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{titleCase(relation.type)}</span>
                    </Link>
                  ))}
                  {selectedRelations.length === 0 ? <div className="text-[9px] text-[var(--muted-2)]">No typed relations recorded.</div> : null}
                </div>

                <div className="mt-2 border-t border-[var(--line)] pt-2.5">
                  <div className="label-micro mb-1.5">Linked incidents</div>
                  {selectedIncidents.map((incident) => (
                    <Link key={incident.id} to={incidentHref(incident.id)} className="flex items-start gap-1.5 py-1">
                      <SeverityBadge severity={incident.severity} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[9px] text-[var(--muted)]">{incident.title}</span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          <IncidentStatusBadge status={incident.status} />
                          <span className="font-mono text-[7px] text-[var(--muted-2)]">{formatRelative(incident.updatedAt)}</span>
                        </span>
                      </span>
                    </Link>
                  ))}
                  {selectedIncidents.length === 0 ? <div className="text-[9px] text-[var(--muted-2)]">No linked incidents in the current model.</div> : null}
                </div>
              </div>
            </Panel>
          ) : null}

          <Panel>
            <PanelHeader title="Cross-module routes" eyebrow="Context preserved" icon={<GitBranch size={13} />} />
            <div className="divide-y divide-[var(--line)]">
              {relatedWorkspaces.map((related) => {
                const relatedDomain = getDomain(related.domain)
                return (
                  <Link key={related.id} to={getWorkspaceHref(related)} className="block px-3 py-2.5 transition-colors hover:bg-white/[0.025]">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-[var(--text)]">{related.label}</span>
                      <span className="font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{relatedDomain?.shortLabel ?? related.domain}</span>
                    </span>
                    <span className="mt-0.5 block text-[8.5px] leading-relaxed text-[var(--muted-2)]">{related.tagline}</span>
                  </Link>
                )
              })}
              {workspace.relatedModules.map((module) => (
                <Link key={module.path} to={contextHref(module.path)} className="block px-3 py-2.5 transition-colors hover:bg-white/[0.025]">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-[var(--text)]">{module.label}</span>
                    <ArrowUpRight size={10} className="text-[var(--muted-2)]" />
                  </span>
                  <span className="mt-0.5 block text-[8.5px] leading-relaxed text-[var(--muted-2)]">{module.note}</span>
                </Link>
              ))}
            </div>
            <div className="border-t border-[var(--line)] px-3 py-2 font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">
              District filter carried where supported
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Model provenance" eyebrow="Demo boundary" icon={<Siren size={13} />} />
            <div className="p-3">
              <p className="text-[9px] leading-relaxed text-[var(--muted)]">
                Workspace filters are stored in the URL, so this exact analytical view can be shared or reloaded. Metrics, entity records and incident
                relationships are deterministic local fixtures. No live sensor, exchange or external AI feed is connected.
              </p>
              <div className="mt-2 flex items-center gap-1.5 font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--amber)]">
                <span className="h-1 w-1 bg-[var(--amber)]" /> simulated workspace
              </div>
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  )
}
