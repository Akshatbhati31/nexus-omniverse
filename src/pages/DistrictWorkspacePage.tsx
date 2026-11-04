import { useMemo } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  GitBranch,
  Globe2,
  History,
  Layers3,
  MapPin,
  Network,
  Search,
  ShieldAlert,
  Siren,
} from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { CityMap2D } from '../components/map/CityMap2D'
import { Breadcrumbs } from '../components/layout/Breadcrumbs'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel, PanelHeader } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { EntityStatusBadge, IncidentStatusBadge, SeverityBadge } from '../components/ui/StatusBadge'
import { CATEGORY_LABELS, DISTRICTS_BY_ID } from '../data/constants'
import { DISTRICT_METRICS } from '../data/datasets'
import { getEntityKindLabel } from '../data/entities'
import { getDomain, getWorkspaceById } from '../data/workspaces'
import { useQueryState } from '../hooks/useQueryState'
import { formatDateTime, formatRelative } from '../lib/format'
import { cn, csvFromRows, downloadFile } from '../lib/utils'
import { usePlatformStore } from '../store/usePlatformStore'
import type { CityLayer, Entity } from '../types'

const DISTRICT_TABS = ['posture', 'assets', 'response', 'history'] as const
const ASSET_STATUS = ['all', 'operational', 'degraded', 'offline', 'maintenance', 'unknown'] as const
const ASSET_CRITICALITY = ['all', 'critical', 'high', 'moderate', 'low'] as const

const DISTRICT_LAYERS: Set<CityLayer> = new Set(['transport', 'population', 'infrastructure', 'incidents', 'energy', 'water', 'environment'])

const DISTRICT_WORKSPACES = [
  { id: 'dependency-analysis', note: 'Critical dependencies rooted in this district.' },
  { id: 'air-quality', note: 'Environmental mesh and industrial exposure.' },
  { id: 'water-stress', note: 'Reclamation, pressure and tidal interface.' },
  { id: 'supply-chain', note: 'Port, freight and industrial movement.' },
  { id: 'corridor-flow', note: 'Arterial and transit constraints.' },
  { id: 'grid-resilience', note: 'Reserve margin and protected load.' },
]

const HISTORY_COLORS: Record<string, string> = {
  system: 'var(--cyan)',
  incident: 'var(--red)',
  maintenance: 'var(--violet)',
  economic: 'var(--amber)',
  environmental: 'var(--green)',
  observation: 'var(--blue)',
}

const assetStatusRank = (entity: Entity) => {
  if (entity.status === 'offline') return 0
  if (entity.status === 'degraded') return 1
  if (entity.status === 'maintenance') return 2
  if (entity.status === 'unknown') return 3
  return 4
}

const assetCriticalityRank = (entity: Entity) => {
  if (entity.criticality === 'critical') return 0
  if (entity.criticality === 'high') return 1
  if (entity.criticality === 'moderate') return 2
  return 3
}

export default function DistrictWorkspacePage() {
  const { districtId } = useParams<{ districtId: string }>()
  const location = useLocation()
  const allEntities = usePlatformStore((state) => state.entities)
  const allIncidents = usePlatformStore((state) => state.incidents)
  const district = DISTRICTS_BY_ID[districtId ?? '']
  const origin = location.pathname.startsWith('/geoint') ? 'geoint' : 'overview'

  const [tab, setTab] = useQueryState('tab', 'posture', DISTRICT_TABS)
  const [assetQuery, setAssetQuery] = useQueryState<string>('q', '')
  const [assetStatus, setAssetStatus] = useQueryState('assetStatus', 'all', ASSET_STATUS)
  const [assetCriticality, setAssetCriticality] = useQueryState('assetCriticality', 'all', ASSET_CRITICALITY)
  const [selectedId, setSelectedId] = useQueryState<string>('entity', '')

  const districtEntity = useMemo(() => allEntities.find((entity) => entity.id === district?.id), [allEntities, district])
  const districtMetrics = useMemo(() => DISTRICT_METRICS.find((metric) => metric.name === district?.code), [district])
  const districtAssets = useMemo(() => (district ? allEntities.filter((entity) => entity.districtId === district.id) : []), [allEntities, district])
  const districtIncidents = useMemo(
    () =>
      district
        ? allIncidents
            .filter((incident) => incident.districtId === district.id)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        : [],
    [allIncidents, district],
  )
  const filteredAssets = useMemo(
    () =>
      districtAssets.filter((entity) => {
        if (assetStatus !== 'all' && entity.status !== assetStatus) return false
        if (assetCriticality !== 'all' && entity.criticality !== assetCriticality) return false
        if (assetQuery.trim()) {
          const haystack = `${entity.name} ${entity.code} ${entity.tags.join(' ')} ${entity.description}`.toLowerCase()
          if (!haystack.includes(assetQuery.trim().toLowerCase())) return false
        }
        return true
      }),
    [assetCriticality, assetQuery, assetStatus, districtAssets],
  )
  const rankedAssets = useMemo(
    () =>
      [...filteredAssets].sort(
        (a, b) =>
          assetStatusRank(a) - assetStatusRank(b) ||
          assetCriticalityRank(a) - assetCriticalityRank(b) ||
          a.name.localeCompare(b.name),
      ),
    [filteredAssets],
  )
  const selected = rankedAssets.find((entity) => entity.id === selectedId) ?? districtAssets.find((entity) => entity.id === selectedId) ?? rankedAssets[0] ?? districtAssets[0]
  const activeIncidents = districtIncidents.filter((incident) => !['resolved', 'archived'].includes(incident.status))
  const resolvedIncidents = districtIncidents.filter((incident) => ['resolved', 'archived'].includes(incident.status))
  const selectedRelations = useMemo(() => {
    if (!selected) return []
    return selected.relations
      .map((relation) => ({ relation, target: allEntities.find((entity) => entity.id === relation.targetId) }))
      .filter((entry): entry is { relation: Entity['relations'][number]; target: Entity } => Boolean(entry.target))
      .sort((a, b) => b.relation.strength - a.relation.strength)
      .slice(0, 3)
  }, [allEntities, selected])
  const selectedIncidents = useMemo(
    () =>
      selected
        ? allIncidents
            .filter((incident) => incident.primaryEntityId === selected.id || incident.relatedEntityIds.includes(selected.id))
            .sort((a, b) => b.impactScore - a.impactScore)
            .slice(0, 3)
        : [],
    [allIncidents, selected],
  )
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const incident of districtIncidents) counts.set(incident.category, (counts.get(incident.category) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [districtIncidents])
  const history = useMemo(() => {
    if (!districtEntity) return []
    const entityEvents = districtEntity.timeline.map((event) => ({
      id: event.id,
      at: event.at,
      title: event.title,
      detail: event.detail,
      kind: event.kind,
    }))
    const incidentEvents = districtIncidents
      .filter((incident) => incident.resolvedAt)
      .map((incident) => ({
        id: `${incident.id}-resolved`,
        at: incident.resolvedAt ?? incident.updatedAt,
        title: `${incident.reference} resolved`,
        detail: incident.resolution ?? 'Resolution recorded by incident command.',
        kind: 'incident' as const,
      }))
    return [...entityEvents, ...incidentEvents].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [districtEntity, districtIncidents])

  if (!district) {
    return (
      <div className="p-4 lg:p-6">
        <Breadcrumbs items={[{ label: 'Global overview', to: '/overview' }, { label: 'Unknown district' }]} />
        <Panel>
          <EmptyState
            icon={Network}
            title="District workspace not found"
            description="The regional model has no district with this identifier. Return to the global overview and select a valid district."
            action={<Link to="/overview" className="btn btn-primary"><ArrowLeft size={12} /> Return to overview</Link>}
          />
        </Panel>
      </div>
    )
  }

  const degradedAssets = districtAssets.filter((entity) => ['degraded', 'offline', 'maintenance'].includes(entity.status))
  const criticalAssets = districtAssets.filter((entity) => entity.criticality === 'critical')
  const hasAssetFilters = assetQuery.trim() !== '' || assetStatus !== 'all' || assetCriticality !== 'all'
  const resilience = districtMetrics?.resilience ?? 78
  const load = districtMetrics?.load ?? 64

  const assetHref = (entity: Entity) => `/entity/${entity.id}?from=${origin}&district=${district.id}`
  const incidentHref = (incidentId: string) => `/incidents/${incidentId}?from=${origin}&district=${district.id}`
  const workspaceHref = (workspaceId: string) => {
    const workspace = getWorkspaceById(workspaceId)
    const workspaceDomain = workspace ? getDomain(workspace.domain) : undefined
    return workspace && workspaceDomain ? `${workspaceDomain.path}/workspace/${workspace.id}?district=${district.id}` : '/overview'
  }

  const exportDistrict = () => {
    downloadFile(
      `${district.code.toLowerCase()}-district-workspace.csv`,
      csvFromRows([
        ...districtAssets.map((entity) => ({
          record: 'asset',
          id: entity.id,
          name: entity.name,
          kind: entity.kind,
          status: entity.status,
          criticality: entity.criticality,
        })),
        ...districtIncidents.map((incident) => ({
          record: 'incident',
          id: incident.id,
          name: incident.reference,
          kind: incident.category,
          status: incident.status,
          criticality: incident.severity,
        })),
      ]),
    )
  }

  return (
    <div className="p-4 lg:p-6">
      <Breadcrumbs
        items={[
          { label: 'Global overview', to: '/overview' },
          ...(origin === 'geoint' ? [{ label: 'Geographic intelligence', to: '/geoint' }] : []),
          { label: 'Regional workspace' },
          { label: district.name },
        ]}
      />

      <PageHeader
        kicker={`${origin === 'geoint' ? 'GEO' : 'CMD'} // Level 2 regional workspace`}
        title={district.name}
        subtitle={district.description}
        meta={
          <>
            <span className="badge badge-cyan">Level 2 · regional workspace</span>
            <span className="badge badge-amber">Deterministic simulation</span>
            <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">{district.code}</span>
            <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--muted-2)]">
              {districtAssets.length} linked assets · {activeIncidents.length} active events
            </span>
          </>
        }
        actions={
          <>
            <Link to={origin === 'geoint' ? '/geoint' : '/overview'} className="btn"><ArrowLeft size={12} /> Back to module</Link>
            <button type="button" className="btn btn-primary" onClick={exportDistrict}><Download size={12} /> Export district</button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)]">
        <div className="flex overflow-x-auto" role="tablist" aria-label="District workspace sections">
          {DISTRICT_TABS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={tab === item}
              className={cn('tab', tab === item && 'border-[var(--cyan)] text-[var(--cyan)]')}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <span className="hidden flex-none font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)] sm:block">
          Level 2 · regional workspace
        </span>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Population', value: (district.population / 1_000_000).toFixed(2), unit: 'M residents', tone: 'var(--cyan)' },
              { label: 'Composite risk', value: String(district.risk), unit: '/ 100', tone: district.risk >= 70 ? 'var(--red)' : 'var(--amber)' },
              { label: 'Resilience', value: resilience.toFixed(1), unit: 'index', tone: 'var(--green)' },
              { label: 'Active incidents', value: String(activeIncidents.length), unit: 'events', tone: activeIncidents.length > 0 ? 'var(--amber)' : 'var(--green)' },
            ].map((item) => (
              <Panel key={item.label} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="label-micro">{item.label}</span>
                  <span className="mt-1 h-1 w-1 flex-none" style={{ background: item.tone, boxShadow: `0 0 8px ${item.tone}66` }} />
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="data-value text-[24px]" style={{ color: item.tone }}>{item.value}</span>
                  <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{item.unit}</span>
                </div>
                <div className="mt-1 font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--muted-2)]">simulated district model</div>
              </Panel>
            ))}
          </div>

          {tab === 'posture' ? (
            <>
              <Panel className="overflow-hidden">
                <PanelHeader
                  title="District map"
                  eyebrow={`${district.name} · ${district.code}`}
                  icon={<MapPin size={13} />}
                  action={<span className="badge badge-muted">{districtAssets.length} assets</span>}
                />
                <div className="relative h-[360px]">
                  <CityMap2D
                    layers={DISTRICT_LAYERS}
                    entities={allEntities}
                    incidents={districtIncidents}
                    selectedEntityId={selected?.id ?? districtEntity?.id}
                    onSelectEntity={setSelectedId}
                    compact
                  />
                  <div className="pointer-events-none absolute left-3 top-3 border border-[var(--line)] bg-[rgba(5,10,16,0.78)] px-2.5 py-1.5 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-1 w-1 bg-[var(--green)] shadow-[0_0_8px_var(--green)]" />
                      <span className="font-mono text-[7px] uppercase tracking-[0.12em] text-[var(--text)]">Regional twin active</span>
                    </div>
                    <div className="mt-1 font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--muted-2)]">Select an asset marker to focus it</div>
                  </div>
                  <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between border border-[var(--line)] bg-[rgba(5,10,16,0.78)] px-2.5 py-1.5 backdrop-blur-sm">
                    <span className="font-mono text-[7px] uppercase tracking-[0.1em] text-[var(--muted)]">{selected?.name ?? 'District scope'} · synthetic geometry</span>
                    <span className="flex items-center gap-1 font-mono text-[7px] text-[var(--amber)]"><Siren size={8} /> {activeIncidents.length} active signals</span>
                  </div>
                </div>
              </Panel>

              <div className="grid gap-3 lg:grid-cols-2">
                <Panel>
                  <PanelHeader title="District profile" eyebrow="Operating context" icon={<Globe2 size={13} />} />
                  <div className="p-4">
                    <p className="text-[10px] leading-relaxed text-[var(--muted)]">{district.description}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {[
                        ['Code', district.code],
                        ['Population', district.population.toLocaleString()],
                        ['Risk index', `${district.risk}/100`],
                        ['Resilience', resilience.toFixed(1)],
                        ['Linked assets', String(districtAssets.length)],
                        ['Critical assets', String(criticalAssets.length)],
                      ].map(([label, value]) => (
                        <div key={label} className="border border-[var(--line)] px-2.5 py-2">
                          <div className="label-micro">{label}</div>
                          <div className="data-value mt-1 text-[13px]">{value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="label-micro">Resilience posture</span>
                        <span className="font-mono text-[9px] text-[var(--muted)]">{resilience.toFixed(1)} / 100</span>
                      </div>
                      <ProgressBar value={resilience} color={resilience < 60 ? 'var(--amber)' : 'var(--green)'} />
                    </div>
                  </div>
                </Panel>

                <Panel>
                  <PanelHeader title="Operational constraints" eyebrow="Cross-domain signals" icon={<Siren size={13} />} />
                  <div className="divide-y divide-[var(--line)]">
                    {[
                      { label: 'Degraded assets', value: String(degradedAssets.length), detail: 'Maintenance, degraded or offline', tone: degradedAssets.length > 0 ? 'var(--amber)' : 'var(--green)' },
                      { label: 'Critical dependencies', value: String(criticalAssets.length), detail: 'Assets requiring continuity coverage', tone: 'var(--red)' },
                      { label: 'Infrastructure load', value: `${load}%`, detail: 'Composite district load index', tone: load >= 80 ? 'var(--red)' : 'var(--cyan)' },
                      { label: 'Open response', value: String(activeIncidents.length), detail: 'Incidents not yet resolved', tone: activeIncidents.length > 0 ? 'var(--amber)' : 'var(--green)' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-3 px-4 py-3">
                        <span className="h-1.5 w-1.5 flex-none" style={{ background: item.tone }} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] text-[var(--text)]">{item.label}</span>
                          <span className="mt-0.5 block text-[8.5px] text-[var(--muted-2)]">{item.detail}</span>
                        </span>
                        <span className="data-value text-[16px]" style={{ color: item.tone }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>

              <Panel>
                <PanelHeader title="District workspace routes" eyebrow="Specialized analysis" icon={<GitBranch size={13} />} />
                <div className="grid gap-px bg-[var(--line)] sm:grid-cols-2">
                  {DISTRICT_WORKSPACES.map((route) => {
                    const workspace = getWorkspaceById(route.id)
                    const workspaceDomain = workspace ? getDomain(workspace.domain) : undefined
                    if (!workspace) return null
                    return (
                      <Link key={route.id} to={workspaceHref(route.id)} className="group bg-[rgba(8,13,19,0.92)] px-4 py-3 transition-colors hover:bg-white/[0.025]">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-[var(--text)]">{workspace.label}</span>
                          <span className="font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{workspaceDomain?.shortLabel ?? workspace.domain}</span>
                        </span>
                        <span className="mt-1 flex items-center justify-between gap-2">
                          <span className="text-[8.5px] leading-relaxed text-[var(--muted-2)]">{route.note}</span>
                          <ArrowUpRight size={10} className="flex-none text-[var(--muted-2)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </Panel>
            </>
          ) : null}

          {tab === 'assets' ? (
            <Panel>
              <PanelHeader
                title="District asset register"
                eyebrow={`${district.name} · ${district.code}`}
                icon={<Layers3 size={13} />}
                action={<span className="font-mono text-[8px] text-[var(--muted-2)]">{rankedAssets.length} / {districtAssets.length} records</span>}
              />
              <div className="flex flex-col gap-2 border-b border-[var(--line)] p-3 lg:flex-row lg:items-center">
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">Filter district assets</span>
                  <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-2)]" />
                  <input
                    className="field pl-8 text-[10.5px]"
                    value={assetQuery}
                    onChange={(event) => setAssetQuery(event.target.value)}
                    placeholder="Filter by name, code, tag or description"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <label>
                    <span className="sr-only">Filter by asset status</span>
                    <select className="field w-[126px] text-[9px]" value={assetStatus} onChange={(event) => setAssetStatus(event.target.value as typeof assetStatus)}>
                      {ASSET_STATUS.map((option) => <option key={option} value={option}>{option === 'all' ? 'All statuses' : option}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="sr-only">Filter by criticality</span>
                    <select className="field w-[130px] text-[9px]" value={assetCriticality} onChange={(event) => setAssetCriticality(event.target.value as typeof assetCriticality)}>
                      {ASSET_CRITICALITY.map((option) => <option key={option} value={option}>{option === 'all' ? 'All criticality' : option}</option>)}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={!hasAssetFilters}
                    onClick={() => {
                      setAssetQuery('')
                      setAssetStatus('all')
                      setAssetCriticality('all')
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="max-h-[560px] overflow-y-auto">
                {rankedAssets.map((entity) => (
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
                        {getEntityKindLabel(entity.kind)} · {entity.tags.slice(0, 3).join(' / ')}
                      </span>
                    </button>
                    <div className="flex flex-none items-center gap-2">
                      <EntityStatusBadge status={entity.status} />
                      <span className="hidden font-mono text-[8px] text-[var(--muted)] lg:inline">
                        {entity.vitals[0] ? `${entity.vitals[0].value.toLocaleString()} ${entity.vitals[0].unit}` : 'No vital'}
                      </span>
                      <Link to={assetHref(entity)} className="btn btn-sm h-6" aria-label={`Open ${entity.name} dossier`}>
                        Dossier <ArrowUpRight size={9} />
                      </Link>
                    </div>
                  </div>
                ))}
                {rankedAssets.length === 0 ? <div className="px-4 py-10 text-center text-[10px] text-[var(--muted)]">No district assets match the current query.</div> : null}
              </div>
            </Panel>
          ) : null}

          {tab === 'response' ? (
            <>
              <div className="grid gap-3 lg:grid-cols-2">
                <Panel>
                  <PanelHeader title="Active response" eyebrow="Open district incidents" icon={<Siren size={13} />} action={<span className="badge badge-amber">{activeIncidents.length}</span>} />
                  <div className="divide-y divide-[var(--line)]">
                    {activeIncidents.map((incident) => (
                      <Link key={incident.id} to={incidentHref(incident.id)} className="group flex items-start gap-2.5 px-4 py-3 transition-colors hover:bg-white/[0.025]">
                        <SeverityBadge severity={incident.severity} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] text-[var(--text)]">{incident.title}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{incident.reference}</span>
                            <IncidentStatusBadge status={incident.status} />
                            <span className="font-mono text-[7px] text-[var(--muted-2)]">{formatRelative(incident.updatedAt)}</span>
                          </span>
                        </span>
                        <ArrowUpRight size={10} className="mt-1 flex-none text-[var(--muted-2)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </Link>
                    ))}
                    {activeIncidents.length === 0 ? <div className="px-4 py-10 text-center text-[10px] text-[var(--muted)]">No active incidents in this district.</div> : null}
                  </div>
                </Panel>

                <Panel>
                  <PanelHeader title="Incident ledger" eyebrow="Retained district records" icon={<History size={13} />} action={<span className="badge badge-muted">{districtIncidents.length}</span>} />
                  <div className="max-h-[360px] divide-y divide-[var(--line)] overflow-y-auto">
                    {districtIncidents.map((incident) => (
                      <Link key={incident.id} to={incidentHref(incident.id)} className="flex items-start gap-2.5 px-4 py-2.5 transition-colors hover:bg-white/[0.025]">
                        <SeverityBadge severity={incident.severity} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[10px] text-[var(--text)]">{incident.title}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{incident.reference}</span>
                            <IncidentStatusBadge status={incident.status} />
                          </span>
                        </span>
                      </Link>
                    ))}
                    {districtIncidents.length === 0 ? <div className="px-4 py-10 text-center text-[10px] text-[var(--muted)]">No incident records retained for this district.</div> : null}
                  </div>
                </Panel>
              </div>

              <Panel>
                <PanelHeader title="Incident category distribution" eyebrow="District response profile" icon={<Layers3 size={13} />} />
                <div className="space-y-3 p-4">
                  {categoryCounts.map(([category, count]) => (
                    <div key={category}>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-[var(--text)]">{CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category}</span>
                        <span className="font-mono text-[8px] text-[var(--muted)]">{count}</span>
                      </div>
                      <ProgressBar value={(count / Math.max(1, districtIncidents.length)) * 100} color="var(--cyan)" />
                    </div>
                  ))}
                  {categoryCounts.length === 0 ? <div className="text-[10px] text-[var(--muted)]">No category data is available for this district.</div> : null}
                </div>
              </Panel>
            </>
          ) : null}

          {tab === 'history' ? (
            <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
              <Panel>
                <PanelHeader title="District timeline" eyebrow="Retained observations and resolutions" icon={<History size={13} />} action={<span className="font-mono text-[8px] text-[var(--muted-2)]">{history.length} events</span>} />
                <div className="max-h-[560px] overflow-y-auto p-4">
                  <div className="relative space-y-4 before:absolute before:bottom-1 before:left-[3px] before:top-1 before:w-px before:bg-[var(--line-strong)]">
                    {history.map((event) => (
                      <div key={event.id} className="relative pl-5">
                        <span className="absolute left-0 top-1.5 h-1.5 w-1.5" style={{ background: HISTORY_COLORS[event.kind] ?? 'var(--muted)' }} />
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10.5px] text-[var(--text)]">{event.title}</span>
                          <span className="badge badge-muted">{event.kind}</span>
                        </div>
                        <p className="mt-1 text-[9.5px] leading-relaxed text-[var(--muted)]">{event.detail}</p>
                        <div className="mt-1 font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{formatDateTime(event.at)}</div>
                      </div>
                    ))}
                    {history.length === 0 ? <div className="pl-5 text-[9px] text-[var(--muted-2)]">No history is retained for this district.</div> : null}
                  </div>
                </div>
              </Panel>

              <div className="space-y-3">
                <Panel>
                  <PanelHeader title="Historical snapshot" eyebrow="District metrics" icon={<Globe2 size={13} />} />
                  <div className="space-y-3 p-4">
                    {[
                      { label: 'Resilience index', value: resilience, max: 100, color: 'var(--green)' },
                      { label: 'Risk index', value: district.risk, max: 100, color: district.risk >= 70 ? 'var(--red)' : 'var(--amber)' },
                      { label: 'Infrastructure load', value: load, max: 100, color: 'var(--cyan)' },
                      { label: 'Critical asset share', value: (criticalAssets.length / Math.max(1, districtAssets.length)) * 100, max: 100, color: 'var(--violet)' },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="label-micro">{item.label}</span>
                          <span className="font-mono text-[8px] text-[var(--muted)]">{item.value.toFixed(1)}</span>
                        </div>
                        <ProgressBar value={(item.value / item.max) * 100} color={item.color} />
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel>
                  <PanelHeader title="Resolved records" eyebrow="Closure history" icon={<ShieldAlert size={13} />} action={<span className="badge badge-muted">{resolvedIncidents.length}</span>} />
                  <div className="divide-y divide-[var(--line)]">
                    {resolvedIncidents.map((incident) => (
                      <Link key={incident.id} to={incidentHref(incident.id)} className="block px-4 py-2.5 transition-colors hover:bg-white/[0.025]">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-[10px] text-[var(--text)]">{incident.title}</span>
                          <IncidentStatusBadge status={incident.status} />
                        </span>
                        <span className="mt-1 block font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">
                          {incident.reference} · {incident.resolvedAt ? formatDateTime(incident.resolvedAt) : 'resolution retained'}
                        </span>
                      </Link>
                    ))}
                    {resolvedIncidents.length === 0 ? <div className="px-4 py-8 text-center text-[9px] text-[var(--muted-2)]">No resolved records in this district.</div> : null}
                  </div>
                </Panel>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="space-y-3">
          <Panel>
            <PanelHeader title="District facts" eyebrow="Modeled geography" icon={<Globe2 size={13} />} />
            <div className="divide-y divide-[var(--line)]">
              {[
                ['District code', district.code],
                ['Population', district.population.toLocaleString()],
                ['Risk index', `${district.risk}/100`],
                ['Resilience', resilience.toFixed(1)],
                ['Linked assets', String(districtAssets.length)],
                ['Active incidents', String(activeIncidents.length)],
                ['Last update', districtEntity ? formatRelative(districtEntity.updatedAt) : 'model time'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="label-micro">{label}</span>
                  <span className="text-right text-[10px] text-[var(--text)]">{value}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-[var(--line)] p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="label-micro">Risk posture</span>
                <span className="font-mono text-[8px] text-[var(--muted)]">{district.risk}/100</span>
              </div>
              <ProgressBar value={district.risk} color={district.risk >= 70 ? 'var(--red)' : 'var(--amber)'} />
            </div>
          </Panel>

          {selected ? (
            <Panel>
              <PanelHeader
                title={selected.name}
                eyebrow="Focused asset"
                icon={<MapPin size={13} />}
                action={<Link to={assetHref(selected)} className="btn btn-sm h-6">Dossier <ArrowUpRight size={9} /></Link>}
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
                    <Link key={`${target.id}-${relation.type}`} to={assetHref(target)} className="flex items-center justify-between gap-2 py-1 text-[9px] text-[var(--muted)] transition-colors hover:text-[var(--cyan)]">
                      <span className="truncate">{target.name}</span>
                      <span className="flex-none font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{relation.type.replaceAll('_', ' ')}</span>
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
            <PanelHeader title="Cross-module routes" eyebrow="From this district" icon={<GitBranch size={13} />} />
            <div className="divide-y divide-[var(--line)]">
              {DISTRICT_WORKSPACES.map((route) => {
                const workspace = getWorkspaceById(route.id)
                const workspaceDomain = workspace ? getDomain(workspace.domain) : undefined
                if (!workspace) return null
                return (
                  <Link key={route.id} to={workspaceHref(route.id)} className="block px-3 py-2.5 transition-colors hover:bg-white/[0.025]">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-[var(--text)]">{workspace.label}</span>
                      <span className="font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{workspaceDomain?.shortLabel ?? workspace.domain}</span>
                    </span>
                    <span className="mt-0.5 block text-[8.5px] leading-relaxed text-[var(--muted-2)]">{route.note}</span>
                  </Link>
                )
              })}
            </div>
            <div className="border-t border-[var(--line)] px-3 py-2 font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">
              District filter carried into each route
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Model provenance" eyebrow="Demo boundary" icon={<ShieldAlert size={13} />} />
            <div className="p-3">
              <p className="text-[9px] leading-relaxed text-[var(--muted)]">
                District posture, assets and incident history are deterministic local fixtures. The map is a procedural schematic, not a live
                geospatial feed. Workspace tab and filters are URL-backed for reproducible review.
              </p>
              <div className="mt-2 flex items-center gap-1.5 font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--amber)]">
                <span className="h-1 w-1 bg-[var(--amber)]" /> simulated regional model
              </div>
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  )
}
