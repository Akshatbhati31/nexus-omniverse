import {
  Activity,
  ArrowUpRight,
  Bot,
  Building2,
  ChevronRight,
  CircleAlert,
  Crosshair,
  Gauge,
  Globe2,
  RadioTower,
  ShieldCheck,
  Siren,
  Sparkles,
  TrendingUp,
  Waves,
  Zap,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { CityMap2D } from '../components/map/CityMap2D'
import { ChartFrame } from '../components/charts/ChartFrame'
import { SeriesChart } from '../components/charts/SeriesChart'
import { HeatmapView } from '../components/charts/HeatmapView'
import { TreemapView } from '../components/charts/TreemapView'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel, PanelHeader } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Sparkline } from '../components/ui/Sparkline'
import { IncidentStatusBadge, SeverityBadge } from '../components/ui/StatusBadge'
import { DISTRICTS } from '../data/constants'
import { DATASETS, DISTRICT_METRICS, INCIDENT_HEATMAP, MARKET_SECTORS } from '../data/datasets'
import { generateSeries } from '../lib/seeded'
import { formatRelative } from '../lib/format'
import { usePlatformStore } from '../store/usePlatformStore'
import { useUIStore } from '../store/useUIStore'
import { useCurrentUser } from '../store/useSessionStore'

const readinessTrend = generateSeries({ seed: 'readiness-overview', points: 28, base: 79.2, amplitude: 2.1, trend: 2.5 }).map((point) => point.value)

export default function OverviewPage() {
  const navigate = useNavigate()
  const user = useCurrentUser()
  const entities = usePlatformStore((state) => state.entities)
  const incidents = usePlatformStore((state) => state.incidents)
  const notifications = usePlatformStore((state) => state.notifications)
  const openInspector = useUIStore((state) => state.openInspector)
  const activeIncidents = incidents.filter((incident) => !['resolved', 'archived'].includes(incident.status))
  const criticalIncidents = activeIncidents.filter((incident) => incident.severity === 'critical')
  const priorityIncidents = [...activeIncidents].sort((a, b) => b.impactScore - a.impactScore).slice(0, 4)
  const allLayers = new Set(['infrastructure', 'incidents', 'transport', 'energy', 'population'] as const)
  const mapIncidents = incidents.slice(0, 8)

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        kicker="Command // Global overview"
        title="Aurelia Prime, in one frame."
        subtitle="A cross-domain synthesis of the metropolitan operating theater. Every incident, asset and signal resolves to the same live model."
        meta={
          <>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <RadioTower size={10} className="text-[var(--green)]" />
              Synthesis 14:32 UTC
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <Globe2 size={10} className="text-[var(--cyan)]" />
              8 / 8 districts covered
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <ShieldCheck size={10} className="text-[var(--violet)]" />
              Session {user?.clearance}
            </span>
            <span className="badge badge-amber">Deterministic simulation</span>
          </>
        }
        actions={
          <>
            <button type="button" className="btn" onClick={() => navigate('/geoint')}>
              <Crosshair size={12} />
              Digital twin
            </button>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/incidents')}>
              <Siren size={12} />
              Incident command
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <Panel className="overflow-hidden xl:col-span-8">
          <div className="grid min-h-[332px] md:grid-cols-[0.92fr_1.08fr]">
            <div className="flex flex-col justify-between border-b border-[var(--line)] p-5 md:border-b-0 md:border-r">
              <div>
                <div className="flex items-center justify-between">
                  <span className="kicker">Metropolitan condition</span>
                  <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--green)]">
                    <span className="status-dot status-dot-pulse" />
                    Holding
                  </span>
                </div>
                <h2 className="mt-4 max-w-sm font-display text-[26px] leading-[1.02] tracking-[-0.045em] text-[var(--text-bright)]">
                  The city is <span className="text-[var(--cyan)]">stable</span>, with two acute constraints.
                </h2>
                <div className="mt-5 flex items-end gap-4">
                  <div>
                    <AnimatedNumber value={81.7} format="decimal" className="data-value text-[48px] leading-[0.9]" />
                    <div className="label-micro mt-2">Composite readiness / 100</div>
                  </div>
                  <div className="mb-1">
                    <div className="flex items-center gap-1 font-mono text-[9px] text-[var(--green)]">
                      <TrendingUp size={11} />
                      +0.6 today
                    </div>
                    <Sparkline data={readinessTrend} width={120} height={36} color="#5ce1a4" className="mt-1" />
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-px bg-[var(--line)]">
                {[
                  { label: 'Active incidents', value: activeIncidents.length, suffix: 'events', trend: `${criticalIncidents.length} critical`, icon: Siren, color: 'var(--red)' },
                  { label: 'Grid reserve', value: 11.4, suffix: '%', trend: '-6.8%', icon: Zap, color: 'var(--amber)' },
                  { label: 'Twin coverage', value: 98.2, suffix: '%', trend: 'nominal', icon: Globe2, color: 'var(--cyan)' },
                  { label: 'Assets linked', value: entities.length, suffix: 'entities', trend: 'all resolved', icon: Building2, color: 'var(--violet)' },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.label} className="bg-[rgba(8,13,19,0.9)] px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="label-micro">{item.label}</span>
                        <Icon size={10} style={{ color: item.color }} />
                      </div>
                      <div className="mt-1.5 flex items-baseline gap-1.5">
                        <span className="data-value text-[18px]">{item.value}</span>
                        <span className="font-mono text-[8px] text-[var(--muted-2)]">{item.suffix}</span>
                      </div>
                      <div className="mt-1 font-mono text-[8px]" style={{ color: item.color }}>{item.trend}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="relative min-h-[300px]">
              <CityMap2D
                layers={allLayers}
                entities={entities}
                incidents={mapIncidents}
                onSelectEntity={(id) => openInspector('entity', id)}
                onSelectIncident={(id) => openInspector('incident', id)}
                compact
              />
              <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 border border-[var(--line)] bg-[rgba(5,10,16,0.78)] px-2.5 py-1.5 backdrop-blur-sm">
                <span className="h-1 w-1 bg-[var(--cyan)] shadow-[0_0_8px_var(--cyan)]" />
                <span className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-[var(--text)]">Live operational map</span>
              </div>
              <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between border border-[var(--line)] bg-[rgba(5,10,16,0.78)] px-2.5 py-1.5 backdrop-blur-sm">
                <span className="font-mono text-[7px] uppercase tracking-[0.1em] text-[var(--muted)]">Aurelia Prime · 38.4221 N / 0.3382 W</span>
                <span className="flex items-center gap-1 font-mono text-[7px] text-[var(--amber)]"><Activity size={8} /> 8 signals</span>
              </div>
            </div>
          </div>
        </Panel>

        <div className="grid gap-3 xl:col-span-4">
          <Panel className="flex flex-col">
            <PanelHeader
              title="Command priorities"
              eyebrow="Active response"
              icon={<Siren size={13} />}
              action={
                <button type="button" className="btn btn-sm" onClick={() => navigate('/incidents')}>
                  All events <ChevronRight size={10} />
                </button>
              }
            />
            <div className="flex-1 divide-y divide-[var(--line)]">
              {priorityIncidents.map((incident) => (
                <button
                  key={incident.id}
                  type="button"
                  className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.025]"
                  onClick={() => navigate(`/incidents/${incident.id}`)}
                >
                  <span className="mt-1 h-1.5 w-1.5 flex-none" style={{ background: incident.severity === 'critical' ? 'var(--red)' : incident.severity === 'high' ? 'var(--amber)' : 'var(--cyan)' }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">{incident.reference}</span>
                      <SeverityBadge severity={incident.severity} />
                    </span>
                    <span className="mt-1 block text-[11px] leading-snug text-[var(--text)]">{incident.title}</span>
                    <span className="mt-1.5 flex items-center gap-2">
                      <IncidentStatusBadge status={incident.status} />
                      <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{formatRelative(incident.updatedAt)}</span>
                    </span>
                  </span>
                  <ChevronRight size={13} className="mt-2 text-[var(--muted-2)] transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </Panel>

          <Panel className="relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(143,124,255,0.1),transparent_60%)]" />
            <div className="relative p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot size={14} className="text-[var(--violet)]" />
                  <span className="label-micro">Nexus intelligence brief</span>
                </div>
                <span className="badge badge-violet">Local engine</span>
              </div>
              <p className="mt-3 text-[11px] leading-[1.7] text-[var(--muted)]">
                Eastern grid reserve remains the dominant cross-domain risk. The Tidal Bridge vibration and Foundry air-quality inversion are
                compounding local constraints. Recommend holding protected feeds at Kestrel Medical and Meridian Data Vault until reserve exceeds
                18% for two consecutive hours.
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">3 records cited</span>
                <button type="button" className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--cyan)]" onClick={() => navigate('/ai')}>
                  Interrogate <ArrowUpRight size={10} />
                </button>
              </div>
            </div>
          </Panel>
        </div>

        <ChartFrame
          title="Metropolitan load profile"
          source="Cross-domain telemetry · simulated"
          dataset={DATASETS.metro_load}
          className="xl:col-span-7"
          footer={
            <div className="flex items-center justify-between">
              <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">Window · 32 hours · 1h resolution</span>
              <span className="font-mono text-[8px] text-[var(--muted)]">Peak grid load 86.4</span>
            </div>
          }
        >
          <SeriesChart dataset={DATASETS.metro_load} type="area" height={225} />
        </ChartFrame>

        <Panel className="xl:col-span-5">
          <PanelHeader
            title="Live signal ledger"
            eyebrow="Notification synthesis"
            icon={<RadioTower size={13} />}
            action={
              <button type="button" className="btn btn-sm" onClick={() => navigate('/incidents')}>
                Open ledger
              </button>
            }
          />
          <div className="divide-y divide-[var(--line)]">
            {notifications.slice(0, 5).map((notification) => (
              <button
                key={notification.id}
                type="button"
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.025]"
                onClick={() => notification.href && navigate(notification.href)}
              >
                <span
                  className="mt-1.5 h-1.5 w-1.5 flex-none"
                  style={{
                    background:
                      notification.priority === 'critical'
                        ? 'var(--red)'
                        : notification.priority === 'high'
                          ? 'var(--amber)'
                          : notification.priority === 'normal'
                            ? 'var(--cyan)'
                            : 'var(--muted)',
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-[10.5px] ${notification.read ? 'text-[var(--muted)]' : 'text-[var(--text)]'}`}>{notification.title}</span>
                    <span className="flex-none font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{formatRelative(notification.createdAt)}</span>
                  </span>
                  <span className="mt-1 line-clamp-1 text-[9.5px] text-[var(--muted-2)]">{notification.body}</span>
                </span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="xl:col-span-4">
          <PanelHeader title="District posture" eyebrow="Resilience weighting" icon={<Gauge size={13} />} />
          <div className="space-y-3 p-4">
            {DISTRICT_METRICS.slice(0, 6).map((district) => {
              const definition = DISTRICTS.find((item) => item.code === district.name)
              return (
                <button
                  key={district.name}
                  type="button"
                  className="group block w-full text-left"
                  onClick={() => definition && navigate(`/overview/district/${definition.id}`)}
                  aria-label={`Open ${district.fullName} regional workspace`}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-1 w-1" style={{ background: district.color }} />
                      <span className="text-[10px] text-[var(--text)]">{district.fullName}</span>
                    </div>
                    <span className="flex items-center gap-1 font-mono text-[9px] text-[var(--muted)]">
                      {district.resilience.toFixed(1)}
                      <ChevronRight size={9} className="text-[var(--muted-2)] transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                  <ProgressBar value={district.resilience} color={district.resilience < 60 ? 'var(--amber)' : district.color} />
                </button>
              )
            })}
          </div>
        </Panel>

        <Panel className="xl:col-span-4">
          <PanelHeader title="Market pulse" eyebrow="Aurelia exchange · simulated" icon={<TrendingUp size={13} />} />
          <div className="p-3">
            <TreemapView items={MARKET_SECTORS} />
          </div>
        </Panel>

        <Panel className="xl:col-span-4">
          <PanelHeader title="Incident density" eyebrow="7-day district ledger" icon={<CircleAlert size={13} />} />
          <div className="p-4">
            <HeatmapView data={INCIDENT_HEATMAP} />
          </div>
          <div className="mx-4 mb-4 flex items-center justify-between border-t border-[var(--line)] pt-3">
            <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">Foundry / Lumen remain elevated</span>
            <button type="button" className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--cyan)]" onClick={() => navigate('/environment')}>
              Environment <ChevronRight size={10} />
            </button>
          </div>
        </Panel>

        <Panel className="xl:col-span-12">
          <div className="grid gap-0 md:grid-cols-4">
            {[
              { icon: Zap, title: 'Eastern grid', value: '11.4%', label: 'Reserve margin', detail: 'Below 18% target', color: 'var(--amber)', path: '/energy' },
              { icon: Waves, title: 'Tidal corridor', value: '40 km/h', label: 'Bridge restriction', detail: 'Structural review active', color: 'var(--violet)', path: '/mobility' },
              { icon: Sparkles, title: 'Foundry air', value: '168', label: 'AQI · central mesh', detail: 'Sensitive-group advisory', color: 'var(--red)', path: '/environment' },
              { icon: ShieldCheck, title: 'Twin fidelity', value: '98.2%', label: 'Geometry reconciled', detail: 'All 8 districts linked', color: 'var(--green)', path: '/geoint' },
            ].map((item, index) => {
              const Icon = item.icon
              return (
                <button
                  key={item.title}
                  type="button"
                  className={`group flex items-start gap-3 p-4 text-left transition-colors hover:bg-white/[0.025] ${index !== 3 ? 'border-b border-[var(--line)] md:border-b-0 md:border-r' : ''}`}
                  onClick={() => navigate(item.path)}
                >
                  <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center border border-[var(--line)]">
                    <Icon size={14} style={{ color: item.color }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="label-micro">{item.title}</span>
                    <span className="mt-1 block data-value text-[19px]">{item.value}</span>
                    <span className="mt-0.5 block font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{item.label}</span>
                    <span className="mt-1.5 flex items-center justify-between gap-2 text-[9px] text-[var(--muted)]">
                      {item.detail}
                      <ArrowUpRight size={11} className="text-[var(--muted-2)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </Panel>
      </div>
    </div>
  )
}
