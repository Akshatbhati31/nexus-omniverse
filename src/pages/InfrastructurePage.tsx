import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Boxes,
  ChevronRight,
  CircleAlert,
  Download,
  GitBranch,
  Network,
  Search,
  ShieldCheck,
  Waypoints,
  Wrench,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ChartFrame } from '../components/charts/ChartFrame'
import { SeriesChart } from '../components/charts/SeriesChart'
import { WorkspaceNav } from '../components/layout/WorkspaceNav'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel, PanelHeader } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Sparkline } from '../components/ui/Sparkline'
import { EntityStatusBadge } from '../components/ui/StatusBadge'
import { DEMO_EPOCH, DISTRICTS, TEAMS } from '../data/constants'
import { getEntityKindLabel } from '../data/entities'
import { formatRelative } from '../lib/format'
import { generateMultiSeries, generateSeries } from '../lib/seeded'
import { csvFromRows, downloadFile } from '../lib/utils'
import { usePlatformStore } from '../store/usePlatformStore'
import type { ChartDataset, EntityKind } from '../types'

const loadDataset: ChartDataset = {
  id: 'infrastructure_load',
  title: 'Critical asset load',
  source: 'NEXUS infrastructure telemetry · simulated',
  unit: 'load index',
  data: generateMultiSeries({
    seed: 'infrastructure-load',
    points: 28,
    endTime: DEMO_EPOCH,
    intervalHours: 1,
    series: [
      { key: 'grid', base: 74, amplitude: 12, trend: 5 },
      { key: 'water', base: 58, amplitude: 8, trend: 1.2 },
      { key: 'network', base: 66, amplitude: 5, trend: -2 },
    ],
  }),
  series: [
    { key: 'grid', label: 'Grid nodes', color: '#f3b85a' },
    { key: 'water', label: 'Water nodes', color: '#5ce1a4' },
    { key: 'network', label: 'Digital nodes', color: '#56e1ff' },
  ],
}

const chain = [
  { id: 'fac-lumen-grid', label: 'Lumen Grid Node', role: 'Power origin', value: '87% load', color: 'var(--amber)' },
  { id: 'fac-nexus-dc', label: 'Meridian Data Vault', role: 'Dependent service', value: 'backup cooling', color: 'var(--violet)' },
  { id: 'fac-arc', label: 'Aurelia Response Center', role: 'Command dependency', value: 'protected feed', color: 'var(--cyan)' },
]

export default function InfrastructurePage() {
  const navigate = useNavigate()
  const entities = usePlatformStore((state) => state.entities)
  const incidents = usePlatformStore((state) => state.incidents)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<EntityKind | 'all'>('all')
  const [status, setStatus] = useState<'all' | 'operational' | 'degraded' | 'maintenance'>('all')

  const assets = useMemo(
    () =>
      entities.filter(
        (entity) =>
          ['facility', 'route', 'organization'].includes(entity.kind) &&
          (kind === 'all' || entity.kind === kind) &&
          (status === 'all' || entity.status === status) &&
          (query.trim() === '' ||
            `${entity.name} ${entity.code} ${entity.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())),
      ),
    [entities, kind, query, status],
  )

  const facilities = entities.filter((entity) => ['facility', 'route'].includes(entity.kind))
  const degraded = facilities.filter((entity) => entity.status === 'degraded')
  const maintenance = facilities.filter((entity) => entity.status === 'maintenance')
  const critical = facilities.filter((entity) => entity.criticality === 'critical')
  const linkedIncidents = incidents.filter((incident) => !['resolved', 'archived'].includes(incident.status))
  const availability = 99.2 - degraded.length * 0.34

  const exportInventory = () => {
    const rows = assets.map((entity) => ({
      code: entity.code,
      name: entity.name,
      kind: entity.kind,
      status: entity.status,
      criticality: entity.criticality,
      district: DISTRICTS.find((district) => district.id === entity.districtId)?.name ?? 'Theater',
      updated: entity.updatedAt,
    }))
    downloadFile('aurelia-asset-inventory.csv', csvFromRows(rows))
  }

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        kicker="Intelligence network // Infrastructure"
        title="The dependencies beneath the city."
        subtitle="Asset posture, cross-system dependency chains and maintenance exposure across the Aurelia operating theater."
        meta={
          <>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <Boxes size={10} className="text-[var(--cyan)]" /> {facilities.length} modeled assets
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <GitBranch size={10} className="text-[var(--violet)]" /> {entities.reduce((sum, entity) => sum + entity.relations.length, 0)} dependency edges
            </span>
            <span className="badge badge-amber">Synthetic telemetry</span>
          </>
        }
        actions={
          <>
            <button type="button" className="btn" onClick={exportInventory}>
              <Download size={12} /> Export inventory
            </button>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/geoint')}>
              <Network size={12} /> Inspect in twin
            </button>
          </>
        }
      />

      <WorkspaceNav domain="infrastructure" />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Mean availability', value: `${availability.toFixed(1)}%`, detail: 'across modeled assets', color: 'var(--green)', icon: ShieldCheck },
          { label: 'Degraded assets', value: String(degraded.length), detail: `${critical.length} critical assets in theater`, color: 'var(--amber)', icon: CircleAlert },
          { label: 'Open dependencies', value: String(linkedIncidents.length), detail: 'active incidents linked', color: 'var(--red)', icon: Waypoints },
          { label: 'Maintenance window', value: String(maintenance.length), detail: 'assets under controlled work', color: 'var(--violet)', icon: Wrench },
        ].map((metric) => {
          const Icon = metric.icon
          return (
            <Panel key={metric.label} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="label-micro">{metric.label}</div>
                  <div className="data-value mt-2 text-[26px]" style={{ color: metric.color }}>{metric.value}</div>
                  <div className="mt-1 text-[9px] text-[var(--muted-2)]">{metric.detail}</div>
                </div>
                <Icon size={15} style={{ color: metric.color }} />
              </div>
            </Panel>
          )
        })}
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <ChartFrame
          title="Critical asset load"
          source="NEXUS infrastructure telemetry · simulated"
          dataset={loadDataset}
          className="xl:col-span-7"
          footer={
            <div className="flex items-center justify-between">
              <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">Window · 28 hours</span>
              <span className="font-mono text-[8px] text-[var(--muted)]">Digital nodes carrying the highest relative load</span>
            </div>
          }
        >
          <SeriesChart dataset={loadDataset} type="area" height={240} />
        </ChartFrame>

        <Panel className="xl:col-span-5">
          <PanelHeader title="Critical dependency chain" eyebrow="Lumen cascade path" icon={<GitBranch size={13} />} action={<span className="badge badge-red">elevated</span>} />
          <div className="p-4">
            <p className="text-[10.5px] leading-relaxed text-[var(--muted)]">
              The eastern grid remains the dominant dependency path. Reserve margin is below target, and the data vault is operating on backup
              cooling. Command and medical services remain protected.
            </p>
            <div className="mt-4 space-y-2">
              {chain.map((node, index) => {
                const entity = entities.find((item) => item.id === node.id)
                return (
                  <div key={node.id}>
                    <button
                      type="button"
                      className="group flex w-full items-center gap-3 border border-[var(--line)] bg-white/[0.015] px-3 py-2.5 text-left transition-colors hover:border-[var(--line-strong)] hover:bg-white/[0.03]"
                      onClick={() => navigate(`/entity/${node.id}`)}
                    >
                      <span className="flex h-6 w-6 flex-none items-center justify-center border font-mono text-[9px]" style={{ borderColor: `${node.color}44`, color: node.color }}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10.5px] text-[var(--text)]">{node.label}</span>
                        <span className="mt-0.5 block font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{node.role} · {node.value}</span>
                      </span>
                      <EntityStatusBadge status={entity?.status ?? 'unknown'} />
                      <ChevronRight size={11} className="text-[var(--muted-2)]" />
                    </button>
                    {index < chain.length - 1 ? <div className="ml-6 h-3 border-l border-dashed border-[var(--line-strong)]" /> : null}
                  </div>
                )
              })}
            </div>
            <div className="mt-4 border border-[var(--amber)]/20 bg-[var(--amber-dim)] p-3">
              <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--amber)]">
                <CircleAlert size={11} /> Recommendation
              </div>
              <p className="mt-1.5 text-[9.5px] leading-relaxed text-[var(--muted)]">
                Hold industrial curtailment until reserve exceeds 18% for two consecutive hours. Validate backup feed before the next peak window.
              </p>
            </div>
          </div>
        </Panel>

        <Panel className="xl:col-span-8">
          <PanelHeader
            title="Asset inventory"
            eyebrow="Infrastructure ledger"
            icon={<Boxes size={13} />}
            action={<span className="font-mono text-[8px] text-[var(--muted-2)]">{assets.length} records</span>}
          />
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-2.5">
            <div className="relative min-w-[180px] flex-1">
              <Search size={11} className="absolute left-2.5 top-2.5 text-[var(--muted-2)]" />
              <input className="field h-8 min-h-0 pl-8 text-[10px]" placeholder="Search code, asset or tag…" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <select className="field h-8 min-h-0 w-auto text-[10px]" value={kind} onChange={(event) => setKind(event.target.value as EntityKind | 'all')} aria-label="Filter asset kind">
              <option value="all">All asset types</option>
              <option value="facility">Facilities</option>
              <option value="route">Routes</option>
              <option value="organization">Organizations</option>
            </select>
            <select className="field h-8 min-h-0 w-auto text-[10px]" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} aria-label="Filter asset status">
              <option value="all">All statuses</option>
              <option value="operational">Operational</option>
              <option value="degraded">Degraded</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Type</th>
                  <th>District</th>
                  <th>Criticality</th>
                  <th>Posture</th>
                  <th>Last signal</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {assets.slice(0, 12).map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <div className="font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{asset.code}</div>
                      <div className="mt-0.5 text-[10.5px] text-[var(--text-bright)]">{asset.name}</div>
                    </td>
                    <td className="text-[10px] text-[var(--muted)]">{getEntityKindLabel(asset.kind)}</td>
                    <td className="text-[10px] text-[var(--muted)]">{DISTRICTS.find((district) => district.id === asset.districtId)?.name ?? 'Theater'}</td>
                    <td>
                      <span className={asset.criticality === 'critical' ? 'badge badge-red' : asset.criticality === 'high' ? 'badge badge-amber' : 'badge badge-muted'}>
                        {asset.criticality}
                      </span>
                    </td>
                    <td><EntityStatusBadge status={asset.status} /></td>
                    <td className="font-mono text-[8px] text-[var(--muted-2)]">{formatRelative(asset.updatedAt)}</td>
                    <td>
                      <button type="button" className="icon-btn h-6 w-6" onClick={() => navigate(`/entity/${asset.id}`)} aria-label={`Open ${asset.name}`}>
                        <ArrowUpRight size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {assets.length === 0 ? <div className="p-8 text-center text-[10px] text-[var(--muted-2)]">No assets match the active filters.</div> : null}
        </Panel>

        <Panel className="xl:col-span-4">
          <PanelHeader title="Response readiness" eyebrow="Teams and maintenance" icon={<Wrench size={13} />} />
          <div className="p-4">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <div className="data-value text-[28px]">81.7</div>
                <div className="label-micro mt-1">Composite readiness</div>
              </div>
              <Sparkline data={generateSeries({ seed: 'infra-readiness', points: 20, base: 79, amplitude: 2.5, trend: 3 }).map((point) => point.value)} width={112} height={32} color="#5ce1a4" />
            </div>
            <div className="space-y-3">
              {TEAMS.slice(0, 5).map((team) => (
                <div key={team.id}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[var(--text)]">{team.name}</span>
                    <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{team.status}</span>
                  </div>
                  <ProgressBar
                    value={team.status === 'deployed' ? 82 : team.status === 'available' ? 64 : 48}
                    color={team.status === 'deployed' ? 'var(--amber)' : team.status === 'available' ? 'var(--green)' : 'var(--violet)'}
                    className="mt-1.5"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-[var(--line)] pt-3">
              <div className="label-micro">Maintenance posture</div>
              <div className="mt-2 space-y-2">
                {facilities.filter((facility) => facility.status !== 'operational').slice(0, 3).map((facility) => (
                  <button key={facility.id} type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => navigate(`/entity/${facility.id}`)}>
                    <span className="truncate text-[9.5px] text-[var(--muted)]">{facility.name}</span>
                    <EntityStatusBadge status={facility.status} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
