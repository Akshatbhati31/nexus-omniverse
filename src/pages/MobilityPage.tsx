import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Bike,
  BusFront,
  CarFront,
  ChevronRight,
  CircleAlert,
  Clock3,
  Gauge,
  MapPin,
  Route as RouteIcon,
  Ship,
  TrainFront,
  TriangleAlert,
  Waypoints,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ChartFrame } from '../components/charts/ChartFrame'
import { DonutChart } from '../components/charts/DonutChart'
import { SeriesChart } from '../components/charts/SeriesChart'
import { CityMap2D } from '../components/map/CityMap2D'
import { WorkspaceNav } from '../components/layout/WorkspaceNav'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel, PanelHeader } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { EntityStatusBadge } from '../components/ui/StatusBadge'
import { DATASETS } from '../data/datasets'
import { DISTRICTS } from '../data/constants'
import { formatRelative } from '../lib/format'
import { usePlatformStore } from '../store/usePlatformStore'
import { useUIStore } from '../store/useUIStore'

const modeSplit = [
  { name: 'Rail', value: 46, color: '#8f7cff' },
  { name: 'Bus', value: 22, color: '#56e1ff' },
  { name: 'Freight', value: 17, color: '#f3b85a' },
  { name: 'Active', value: 9, color: '#5ce1a4' },
  { name: 'Private', value: 6, color: '#7b8da4' },
]

const routeMetrics = [
  { id: 'route-transit-01', code: 'TRN-01', corridor: 'Meridian Loop', status: 'operational' as const, speed: 48, load: 74, color: 'var(--cyan)' },
  { id: 'route-transit-02', code: 'TRN-02', corridor: 'Cross-City Line', status: 'degraded' as const, speed: 32, load: 86, color: 'var(--violet)' },
  { id: 'route-bridge-tidal', code: 'BRG-04', corridor: 'Tidal Bridge', status: 'degraded' as const, speed: 40, load: 91, color: 'var(--amber)' },
  { id: 'route-arterial-north', code: 'ART-07', corridor: 'Arterial N-7', status: 'operational' as const, speed: 56, load: 68, color: 'var(--green)' },
  { id: 'route-freight-09', code: 'FRT-09', corridor: 'Port Freight Corridor', status: 'operational' as const, speed: 62, load: 77, color: 'var(--cyan)' },
]

const transitLines = [
  { line: 'Meridian Loop', headway: '4 min', status: 'nominal', color: 'var(--green)' },
  { line: 'Cross-City Line', headway: '8 min', status: 'degraded', color: 'var(--amber)' },
  { line: 'Tidal Express', headway: '12 min', status: 'restricted', color: 'var(--red)' },
  { line: 'Kestrel Connector', headway: '9 min', status: 'nominal', color: 'var(--green)' },
]

export default function MobilityPage() {
  const navigate = useNavigate()
  const entities = usePlatformStore((state) => state.entities)
  const incidents = usePlatformStore((state) => state.incidents)
  const openInspector = useUIStore((state) => state.openInspector)
  const [selectedRoute, setSelectedRoute] = useState('route-bridge-tidal')
  const routes = useMemo(() => entities.filter((entity) => entity.kind === 'route'), [entities])
  const activeIncidents = incidents.filter((incident) => !['resolved', 'archived'].includes(incident.status))
  const bridge = entities.find((entity) => entity.id === 'route-bridge-tidal')
  const bridgeIncident = incidents.find((incident) => incident.id === 'inc-2840')
  const layers = new Set(['transport', 'incidents', 'infrastructure'] as const)

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        kicker="Intelligence network // Mobility"
        title="Movement, and its constraints."
        subtitle="Transit throughput, corridor load and disruption exposure across the Aurelia mobility network. Corridor telemetry is deterministic and simulated."
        meta={
          <>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <TrainFront size={10} className="text-[var(--violet)]" /> 712k rail trips / day
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <TriangleAlert size={10} className="text-[var(--amber)]" /> Tidal Bridge restricted
            </span>
            <span className="badge badge-amber">Synthetic corridor data</span>
          </>
        }
        actions={
          <>
            <button type="button" className="btn" onClick={() => navigate('/geoint')}>
              <MapPin size={12} /> Corridor map
            </button>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/simulation')}>
              <Waypoints size={12} /> Simulate closure
            </button>
          </>
        }
      />

      <WorkspaceNav domain="mobility" />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Rail throughput', value: '712k', detail: 'trips per day', color: 'var(--violet)', icon: TrainFront },
          { label: 'Mean arterial speed', value: '38 km/h', detail: '-4.2 vs baseline', color: 'var(--amber)', icon: Gauge },
          { label: 'Freight availability', value: '96.4%', detail: 'port corridor nominal', color: 'var(--green)', icon: Ship },
          { label: 'Active disruptions', value: String(activeIncidents.filter((incident) => incident.category === 'transport_disruption' || incident.category === 'infrastructure_failure').length), detail: 'mobility-related events', color: 'var(--red)', icon: CircleAlert },
        ].map((metric) => {
          const Icon = metric.icon
          return (
            <Panel key={metric.label} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="label-micro">{metric.label}</div>
                  <div className="data-value mt-2 text-[25px]" style={{ color: metric.color }}>{metric.value}</div>
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
          title="Mobility throughput"
          source="Aurelia Transit control · simulated"
          dataset={DATASETS.mobility_flow}
          className="xl:col-span-7"
          footer={
            <div className="flex items-center justify-between">
              <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">Window · 32 hours · hourly resolution</span>
              <span className="font-mono text-[8px] text-[var(--amber)]">rail load elevated</span>
            </div>
          }
        >
          <SeriesChart dataset={DATASETS.mobility_flow} type="area" height={264} />
        </ChartFrame>

        <Panel className="relative min-h-[360px] overflow-hidden xl:col-span-5">
          <PanelHeader title="Southern corridor" eyebrow="Live schematic" icon={<RouteIcon size={13} />} action={<button type="button" className="btn btn-sm" onClick={() => navigate('/geoint')}>Expand</button>} />
          <div className="relative h-[300px]">
            <CityMap2D
              layers={layers}
              entities={entities}
              incidents={incidents}
              selectedEntityId={selectedRoute}
              onSelectEntity={(id) => {
                setSelectedRoute(id)
                openInspector('entity', id)
              }}
              onSelectIncident={(id) => openInspector('incident', id)}
              compact
            />
            <div className="pointer-events-none absolute left-2 top-2 border border-[var(--line)] bg-[rgba(5,10,16,0.82)] px-2 py-1 font-mono text-[7px] uppercase tracking-[0.1em] text-[var(--amber)]">
              Tidal Bridge · 40 km/h
            </div>
          </div>
        </Panel>

        <Panel className="xl:col-span-5">
          <PanelHeader title="Tidal Bridge review" eyebrow="Structural monitoring" icon={<TriangleAlert size={13} />} action={<span className="badge badge-amber">active</span>} />
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">{bridge?.code ?? 'BRG-04'}</div>
                <h3 className="mt-1 font-display text-xl tracking-[-0.03em] text-[var(--text-bright)]">Tidal Bridge</h3>
                <p className="mt-1 text-[9px] text-[var(--muted-2)]">{bridge ? formatRelative(bridge.updatedAt) : 'recently'} · structural engineering</p>
              </div>
              <EntityStatusBadge status={bridge?.status ?? 'degraded'} />
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-[var(--muted)]">
              Mid-span accelerometers recorded elevated vibration during a freight-heavy traffic window. Rail service is restricted to 40 km/h while
              structural engineering evaluates the expansion joint and bearing assembly.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-px bg-[var(--line)]">
              {[
                ['Vibration', '2.8σ', 'var(--red)'],
                ['Speed cap', '40', 'var(--amber)'],
                ['Closure risk', '18%', 'var(--violet)'],
              ].map(([label, value, color]) => (
                <div key={label} className="bg-[rgba(8,13,19,0.9)] px-2.5 py-2">
                  <div className="label-micro">{label}</div>
                  <div className="data-value mt-1 text-[16px]" style={{ color }}>{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-[9px] text-[var(--muted-2)]">
                <span>48-hour monitoring window</span>
                <span className="font-mono">68% elapsed</span>
              </div>
              <ProgressBar value={68} color="var(--amber)" className="mt-1.5" />
            </div>
            <button type="button" className="btn mt-3 w-full" onClick={() => bridgeIncident && navigate(`/incidents/${bridgeIncident.id}`)}>
              Open engineering incident <ArrowUpRight size={11} />
            </button>
          </div>
        </Panel>

        <Panel className="xl:col-span-4">
          <PanelHeader title="Mode split" eyebrow="Daily trips" icon={<BusFront size={13} />} />
          <div className="p-4">
            <DonutChart data={modeSplit} height={185} centerValue="1.54M" centerLabel="daily trips" />
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[var(--line)] pt-3">
              <div className="flex items-center gap-2 text-[9px] text-[var(--muted)]"><CarFront size={12} className="text-[var(--cyan)]" /> Arterial flow 78k</div>
              <div className="flex items-center gap-2 text-[9px] text-[var(--muted)]"><Bike size={12} className="text-[var(--green)]" /> Active travel 9%</div>
            </div>
          </div>
        </Panel>

        <Panel className="xl:col-span-8">
          <PanelHeader title="Route posture" eyebrow="Corridor load and speed" icon={<RouteIcon size={13} />} action={<span className="font-mono text-[8px] text-[var(--muted-2)]">{routes.length} routes</span>} />
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Corridor</th>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Mean speed</th>
                  <th>Load</th>
                  <th>Last signal</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {routeMetrics.map((route) => {
                  const entity = entities.find((item) => item.id === route.id)
                  return (
                    <tr key={route.id} className="cursor-pointer" onClick={() => setSelectedRoute(route.id)}>
                      <td>
                        <div className="text-[10.5px] text-[var(--text-bright)]">{route.corridor}</div>
                        <div className="mt-0.5 font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{DISTRICTS.find((district) => district.id === entity?.districtId)?.name ?? 'Theater'}</div>
                      </td>
                      <td className="font-mono text-[9px] text-[var(--muted)]">{route.code}</td>
                      <td><EntityStatusBadge status={route.status} /></td>
                      <td className="font-mono text-[10px]">{route.speed} km/h</td>
                      <td className="w-[130px]">
                        <div className="flex items-center gap-2">
                          <ProgressBar value={route.load} color={route.load > 85 ? 'var(--red)' : route.load > 75 ? 'var(--amber)' : route.color} className="w-16" />
                          <span className="font-mono text-[9px] text-[var(--muted)]">{route.load}%</span>
                        </div>
                      </td>
                      <td className="font-mono text-[8px] text-[var(--muted-2)]">{entity ? formatRelative(entity.updatedAt) : '—'}</td>
                      <td>
                        <button type="button" className="icon-btn h-6 w-6" onClick={(event) => { event.stopPropagation(); openInspector('entity', route.id) }} aria-label={`Inspect ${route.corridor}`}>
                          <ChevronRight size={11} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="xl:col-span-4">
          <PanelHeader title="Transit control" eyebrow="Line headway" icon={<Clock3 size={13} />} />
          <div className="p-4">
            <div className="space-y-3">
              {transitLines.map((line) => (
                <div key={line.line} className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-2.5 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5" style={{ background: line.color }} />
                    <span className="text-[10px] text-[var(--text)]">{line.line}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[9px] text-[var(--text)]">{line.headway}</div>
                    <div className="font-mono text-[7px] uppercase tracking-[0.08em]" style={{ color: line.color }}>{line.status}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 border border-[var(--amber)]/20 bg-[var(--amber-dim)] p-3">
              <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--amber)]"><TriangleAlert size={11} /> Displacement risk</div>
              <p className="mt-1.5 text-[9.5px] leading-relaxed text-[var(--muted)]">
                A bridge closure would displace an estimated 36k commuters per peak hour into adjacent corridors. Alternate capacity is modeled at 62%.
              </p>
            </div>
            <button type="button" className="btn mt-3 w-full" onClick={() => navigate('/mobility')}>
              View corridor ledger <ChevronRight size={11} />
            </button>
          </div>
        </Panel>
      </div>
    </div>
  )
}
