import { useMemo, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  BatteryCharging,
  ChevronRight,
  CircleAlert,
  Download,
  Gauge,
  RadioTower,
  ShieldCheck,
  Siren,
  TrendingDown,
  Zap,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ChartFrame } from '../components/charts/ChartFrame'
import { DonutChart } from '../components/charts/DonutChart'
import { RadialGauge } from '../components/charts/RadialGauge'
import { SeriesChart } from '../components/charts/SeriesChart'
import { WorkspaceNav } from '../components/layout/WorkspaceNav'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel, PanelHeader } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Sparkline } from '../components/ui/Sparkline'
import { EntityStatusBadge, IncidentStatusBadge, SeverityBadge } from '../components/ui/StatusBadge'
import { DISTRICTS } from '../data/constants'
import { DATASETS, GENERATION_MIX } from '../data/datasets'
import { formatRelative } from '../lib/format'
import { generateSeries } from '../lib/seeded'
import { cn, csvFromRows, downloadFile } from '../lib/utils'
import { usePlatformStore } from '../store/usePlatformStore'
import { useUIStore } from '../store/useUIStore'

const energyDataset = DATASETS.energy_demand

const RANGES = [
  { id: '6h', label: '6h', points: 7 },
  { id: '12h', label: '12h', points: 13 },
  { id: '24h', label: '24h', points: 25 },
  { id: '32h', label: '32h', points: 33 },
] as const

const GRID_NODES = [
  { id: 'fac-lumen-grid', role: 'Eastern substation', load: 87, capacity: '1.8 GW', color: 'var(--amber)' },
  { id: 'fac-solace-solar', role: 'Renewable generation', load: 64, capacity: '420 MW', color: 'var(--green)' },
  { id: 'fac-nexus-dc', role: 'Priority data load', load: 78, capacity: '96 MW', color: 'var(--violet)' },
  { id: 'fac-foundry-plant', role: 'Industrial offtake', load: 84, capacity: '210 MW', color: 'var(--red)' },
  { id: 'fac-kestrel-hospital', role: 'Protected medical load', load: 71, capacity: '38 MW', color: 'var(--cyan)' },
  { id: 'fac-north-pump', role: 'Water pumping load', load: 67, capacity: '14 MW', color: 'var(--blue)' },
]

export default function EnergyPage() {
  const navigate = useNavigate()
  const entities = usePlatformStore((state) => state.entities)
  const incidents = usePlatformStore((state) => state.incidents)
  const openInspector = useUIStore((state) => state.openInspector)
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('24h')
  const [selectedNode, setSelectedNode] = useState('fac-lumen-grid')
  const [reserveThreshold, setReserveThreshold] = useState(18)

  const chartDataset = useMemo(() => {
    const points = RANGES.find((item) => item.id === range)?.points ?? 33
    return { ...energyDataset, data: energyDataset.data.slice(-points) }
  }, [range])

  const selected = entities.find((entity) => entity.id === selectedNode)
  const gridIncidents = incidents
    .filter((incident) => ['power_outage', 'infrastructure_failure'].includes(incident.category))
    .sort((a, b) => b.impactScore - a.impactScore)
  const activeGridIncidents = gridIncidents.filter((incident) => !['resolved', 'archived'].includes(incident.status))
  const reserve = 11.4
  const reserveGap = reserveThreshold - reserve
  const reserveColor = reserve < reserveThreshold ? 'var(--red)' : reserve < reserveThreshold + 5 ? 'var(--amber)' : 'var(--green)'
  const reserveTrend = generateSeries({ seed: 'energy-reserve-trend', points: 24, base: 18, amplitude: 3.4, trend: -6.8 }).map((point) => point.value)

  const exportGridSnapshot = () => {
    const rows = GRID_NODES.map((node) => {
      const entity = entities.find((item) => item.id === node.id)
      return {
        code: entity?.code ?? node.id,
        asset: entity?.name ?? node.role,
        role: node.role,
        status: entity?.status ?? 'unknown',
        load_pct: node.load,
        capacity: node.capacity,
        district: DISTRICTS.find((district) => district.id === entity?.districtId)?.name ?? 'Theater',
      }
    })
    downloadFile('aurelia-grid-snapshot.csv', csvFromRows(rows))
  }

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        kicker="Intelligence network // Energy"
        title="The grid, under load."
        subtitle="Generation, demand, storage and protected-load posture across the Helios eastern grid. All telemetry is deterministic and simulated for this demonstration."
        meta={
          <>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <RadioTower size={10} className="text-[var(--amber)]" /> 6 monitored nodes
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <Activity size={10} className="text-[var(--red)]" /> Frequency 49.81 Hz
            </span>
            <span className="badge badge-amber">Simulated grid telemetry</span>
          </>
        }
        actions={
          <>
            <button type="button" className="btn" onClick={exportGridSnapshot}>
              <Download size={12} /> Export grid snapshot
            </button>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/simulation')}>
              <Zap size={12} /> Simulate power deficit
            </button>
          </>
        }
      />

      <WorkspaceNav domain="energy" />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Current demand', value: '2,284', detail: 'MW · +4.9% vs 24h mean', color: 'var(--amber)', icon: Zap },
          { label: 'Renewable supply', value: '986', detail: 'MW · 43.2% of generation', color: 'var(--green)', icon: BatteryCharging },
          { label: 'Reserve margin', value: `${reserve}%`, detail: `${reserveGap.toFixed(1)} pts below target`, color: reserveColor, icon: Gauge },
          { label: 'Protected loads', value: '4', detail: 'medical · command · water · data', color: 'var(--cyan)', icon: ShieldCheck },
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
          title="Grid demand and renewable supply"
          source="Helios grid telemetry · simulated"
          dataset={chartDataset}
          className="xl:col-span-8"
          actions={
            <div className="flex border border-[var(--line)] p-0.5">
              {RANGES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={cn('btn btn-sm h-5 border-transparent bg-transparent px-2 text-[8px]', range === item.id && 'bg-[var(--cyan-dim)] text-[var(--cyan)]')}
                  onClick={() => setRange(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          }
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">Demand · renewable · reserve · 1h resolution</span>
              <span className="flex items-center gap-1 font-mono text-[8px] text-[var(--amber)]"><TrendingDown size={9} /> reserve trending below target</span>
            </div>
          }
        >
          <SeriesChart dataset={chartDataset} type="area" height={276} />
        </ChartFrame>

        <Panel className="xl:col-span-4">
          <PanelHeader title="Reserve posture" eyebrow="Operating envelope" icon={<Gauge size={13} />} action={<span className={reserveGap > 0 ? 'badge badge-red' : 'badge badge-green'}>{reserveGap > 0 ? 'below target' : 'within target'}</span>} />
          <div className="flex flex-col items-center px-4 pb-3 pt-4">
            <RadialGauge value={reserve} max={30} size={152} label="reserve margin" color={reserveColor} sublabel={`${reserveGap > 0 ? '-' : '+'}${Math.abs(reserveGap).toFixed(1)} pts vs policy`} />
            <Sparkline data={reserveTrend} width={210} height={38} color={reserveColor} className="mt-1" />
            <div className="mt-4 w-full">
              <div className="flex items-center justify-between">
                <span className="label-micro">Policy threshold</span>
                <span className="font-mono text-[9px] text-[var(--text)]">{reserveThreshold}%</span>
              </div>
              <input
                type="range"
                min={12}
                max={26}
                step={1}
                value={reserveThreshold}
                onChange={(event) => setReserveThreshold(Number(event.target.value))}
                className="mt-2 w-full accent-[var(--cyan)]"
                aria-label="Policy reserve threshold"
              />
              <div className="mt-1 flex justify-between font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--muted-2)]">
                <span>12%</span>
                <span>26%</span>
              </div>
            </div>
          </div>
          <div className="border-t border-[var(--line)] p-4">
            <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--amber)]">
              <CircleAlert size={11} /> Dispatch posture
            </div>
            <p className="mt-1.5 text-[9.5px] leading-relaxed text-[var(--muted)]">
              Fast reserve is active. Industrial curtailment remains in force until reserve exceeds the configured policy threshold for two
              consecutive hours.
            </p>
          </div>
        </Panel>

        <Panel className="xl:col-span-4">
          <PanelHeader title="Generation mix" eyebrow="Current dispatch" icon={<BatteryCharging size={13} />} />
          <div className="p-4">
            <DonutChart data={GENERATION_MIX} height={190} centerValue="2.28" centerLabel="GW dispatched" />
          </div>
          <div className="border-t border-[var(--line)] px-4 py-3">
            <div className="flex items-center justify-between text-[9px]">
              <span className="text-[var(--muted)]">Renewable share</span>
              <span className="font-mono text-[var(--green)]">43.2%</span>
            </div>
            <ProgressBar value={43.2} color="var(--green)" className="mt-2" />
          </div>
        </Panel>

        <Panel className="xl:col-span-8">
          <PanelHeader
            title="Grid node ledger"
            eyebrow="Load and protection status"
            icon={<Zap size={13} />}
            action={<span className="font-mono text-[8px] text-[var(--muted-2)]">{GRID_NODES.length} nodes</span>}
          />
          <div className="grid gap-0 md:grid-cols-2">
            {GRID_NODES.map((node, index) => {
              const entity = entities.find((item) => item.id === node.id)
              return (
                <button
                  key={node.id}
                  type="button"
                  className={cn(
                    'group flex items-start gap-3 p-4 text-left transition-colors hover:bg-white/[0.025]',
                    index < GRID_NODES.length - 2 && 'border-b border-[var(--line)]',
                    index % 2 === 0 && 'md:border-r md:border-[var(--line)]',
                    selectedNode === node.id && 'bg-white/[0.025]',
                  )}
                  onClick={() => setSelectedNode(node.id)}
                >
                  <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center border border-[var(--line)]" style={{ color: node.color }}>
                    <Zap size={13} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[10.5px] text-[var(--text-bright)]">{entity?.name ?? node.id}</span>
                      {entity ? <EntityStatusBadge status={entity.status} /> : null}
                    </span>
                    <span className="mt-0.5 block font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{node.role} · {node.capacity}</span>
                    <span className="mt-2 flex items-center gap-2">
                      <ProgressBar value={node.load} color={node.load > 84 ? 'var(--red)' : node.load > 74 ? 'var(--amber)' : node.color} className="flex-1" />
                      <span className="w-8 text-right font-mono text-[9px] text-[var(--muted)]">{node.load}%</span>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </Panel>

        <Panel className="xl:col-span-5">
          <PanelHeader title="Selected node" eyebrow="Asset dossier" icon={<Activity size={13} />} action={selected ? <button type="button" className="btn btn-sm" onClick={() => navigate(`/entity/${selected.id}`)}>Dossier <ChevronRight size={10} /></button> : null} />
          {selected ? (
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">{selected.code}</div>
                  <h3 className="mt-1 font-display text-lg tracking-[-0.025em] text-[var(--text-bright)]">{selected.name}</h3>
                  <div className="mt-1 text-[9px] text-[var(--muted-2)]">{selected.districtId ? DISTRICTS.find((district) => district.id === selected.districtId)?.name : 'Theater scale'}</div>
                </div>
                <EntityStatusBadge status={selected.status} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-px bg-[var(--line)]">
                {selected.vitals.slice(0, 4).map((vital) => (
                  <div key={vital.label} className="bg-[rgba(8,13,19,0.9)] px-2.5 py-2">
                    <div className="label-micro">{vital.label}</div>
                    <div className="mt-1 font-mono text-[14px] text-[var(--text-bright)]">
                      {vital.value.toLocaleString()} <span className="text-[8px] text-[var(--muted)]">{vital.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" className="btn flex-1" onClick={() => openInspector('entity', selected.id)}>
                  <Activity size={11} /> Inspect telemetry
                </button>
                <button type="button" className="btn flex-1" onClick={() => navigate(`/entity/${selected.id}`)}>
                  Open dossier <ArrowUpRight size={11} />
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 text-[10px] text-[var(--muted)]">Select a node from the grid ledger.</div>
          )}
        </Panel>

        <Panel className="xl:col-span-7">
          <PanelHeader
            title="Grid event ledger"
            eyebrow="Power and infrastructure"
            icon={<Siren size={13} />}
            action={<button type="button" className="btn btn-sm" onClick={() => navigate('/incidents')}>All incidents</button>}
          />
          <div className="divide-y divide-[var(--line)]">
            {gridIncidents.slice(0, 5).map((incident) => (
              <button
                key={incident.id}
                type="button"
                className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.025]"
                onClick={() => navigate(`/incidents/${incident.id}`)}
              >
                <SeverityBadge severity={incident.severity} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">{incident.reference}</span>
                    <IncidentStatusBadge status={incident.status} />
                  </span>
                  <span className="mt-1 block text-[10.5px] text-[var(--text)]">{incident.title}</span>
                  <span className="mt-1 block font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">Impact {incident.impactScore}/100 · {formatRelative(incident.updatedAt)}</span>
                </span>
                <ChevronRight size={12} className="mt-2 text-[var(--muted-2)] transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
            {gridIncidents.length === 0 ? <div className="p-6 text-center text-[10px] text-[var(--muted-2)]">No grid incidents in the ledger.</div> : null}
          </div>
          <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-2.5">
            <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">{activeGridIncidents.length} active grid events</span>
            <button type="button" className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--cyan)]" onClick={() => navigate('/simulation')}>
              Model cascade <ChevronRight size={10} />
            </button>
          </div>
        </Panel>
      </div>
    </div>
  )
}
