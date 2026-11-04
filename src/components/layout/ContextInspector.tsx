import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  ArrowUpRight,
  Bot,
  Building2,
  ChevronRight,
  Crosshair,
  ExternalLink,
  Gauge,
  MapPin,
  RadioTower,
  Siren,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getEntityKindLabel } from '../../data/entities'
import { formatRelative, titleCase } from '../../lib/format'
import { usePlatformStore } from '../../store/usePlatformStore'
import { useUIStore } from '../../store/useUIStore'
import { EntityStatusBadge, IncidentStatusBadge, SeverityBadge } from '../ui/StatusBadge'
import { ProgressBar } from '../ui/ProgressBar'
import { Sparkline } from '../ui/Sparkline'
import { generateSeries } from '../../lib/seeded'

export function ContextInspector() {
  const navigate = useNavigate()
  const open = useUIStore((state) => state.inspectorOpen)
  const target = useUIStore((state) => state.inspectorTarget)
  const close = useUIStore((state) => state.closeInspector)
  const openInspector = useUIStore((state) => state.openInspector)
  const entities = usePlatformStore((state) => state.entities)
  const incidents = usePlatformStore((state) => state.incidents)
  const notifications = usePlatformStore((state) => state.notifications)

  const entity = target.kind === 'entity' ? entities.find((item) => item.id === target.id) : undefined
  const incident = target.kind === 'incident' ? incidents.find((item) => item.id === target.id) : undefined
  const activeIncidents = incidents.filter((item) => !['resolved', 'archived'].includes(item.status))

  // Dynamically derive city readiness from active operational entities and incidents
  const readiness = useMemo(() => {
    if (!entities.length) return 81.7
    const opCount = entities.filter((e) => e.status === 'operational').length
    const degCount = entities.filter((e) => e.status === 'degraded').length
    const entityHealth = (opCount * 1.0 + degCount * 0.5) / entities.length
    const criticalIncidents = activeIncidents.filter((i) => i.severity === 'critical').length
    const incidentPenalty = Math.min(25, activeIncidents.length * 1.8 + criticalIncidents * 4)
    const raw = (entityHealth * 100) - incidentPenalty
    return Math.max(15, Math.min(99.4, Math.round(raw * 10) / 10))
  }, [entities, activeIncidents])

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 318, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          className="relative hidden flex-none overflow-hidden border-l border-[var(--line)] bg-[rgba(6,10,15,0.55)] xl:block"
        >
          <div className="flex h-full w-[318px] flex-col">
            <div className="flex h-[42px] flex-none items-center justify-between border-b border-[var(--line)] px-3">
              <div className="flex items-center gap-2">
                <Crosshair size={12} className="text-[var(--cyan)]" />
                <span className="label-micro">Context inspector</span>
                <span className="h-1 w-1 bg-[var(--cyan)]" />
              </div>
              <button type="button" className="icon-btn h-6 w-6" onClick={close} aria-label="Close context inspector">
                <X size={13} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {entity ? (
                <div>
                  <div className="border-b border-[var(--line)] p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="badge badge-muted">{getEntityKindLabel(entity.kind)}</span>
                      <EntityStatusBadge status={entity.status} />
                    </div>
                    <h2 className="font-display text-xl leading-tight tracking-[-0.03em] text-[var(--text-bright)]">{entity.name}</h2>
                    <div className="mt-2 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">
                      <span>{entity.code}</span>
                      <span className="h-1 w-1 bg-[var(--muted-2)]" />
                      <span>{entity.districtId?.replace('dist-', '') ?? entity.kind}</span>
                    </div>
                    <p className="mt-3 text-[10.5px] leading-relaxed text-[var(--muted)]">{entity.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-px border-b border-[var(--line)] bg-[var(--line)]">
                    {entity.vitals.slice(0, 4).map((vital) => (
                      <div key={vital.label} className="bg-[rgba(7,12,18,0.96)] px-3 py-3">
                        <div className="label-micro">{vital.label}</div>
                        <div className="mt-1 flex items-baseline gap-1">
                          <span className="data-value text-[17px]">{vital.value.toLocaleString()}</span>
                          <span className="font-mono text-[8px] text-[var(--muted)]">{vital.unit}</span>
                        </div>
                        <div className={`mt-1 font-mono text-[8px] ${vital.delta >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                          {vital.delta >= 0 ? '+' : ''}
                          {vital.delta}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-b border-[var(--line)] p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="label-micro">Recent signal</span>
                      <Activity size={11} className="text-[var(--cyan)]" />
                    </div>
                    <Sparkline
                      data={generateSeries({ seed: entity.id, points: 24, base: 62, amplitude: 12, trend: 3 }).map((point) => point.value)}
                      width={270}
                      height={42}
                      color={entity.status === 'degraded' ? '#f3b85a' : '#56e1ff'}
                      className="w-full"
                    />
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-mono text-[8px] text-[var(--muted-2)]">24h synthesized telemetry</span>
                      <span className="font-mono text-[8px] text-[var(--green)]">NOMINAL TREND</span>
                    </div>
                  </div>

                  <div className="border-b border-[var(--line)] p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="label-micro">Linked incidents</span>
                      <Siren size={11} className="text-[var(--muted)]" />
                    </div>
                    <div className="space-y-1.5">
                      {incidents
                        .filter((item) => item.primaryEntityId === entity.id || item.relatedEntityIds.includes(entity.id))
                        .slice(0, 3)
                        .map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="flex w-full items-center gap-2 border border-[var(--line)] bg-white/[0.018] px-2.5 py-2 text-left transition-colors hover:border-[var(--line-strong)] hover:bg-white/[0.03]"
                            onClick={() => openInspector('incident', item.id)}
                          >
                            <SeverityBadge severity={item.severity} />
                            <span className="min-w-0 flex-1 truncate text-[10px] text-[var(--text)]">{item.title}</span>
                            <ChevronRight size={11} className="text-[var(--muted-2)]" />
                          </button>
                        ))}
                      {incidents.filter((item) => item.primaryEntityId === entity.id || item.relatedEntityIds.includes(entity.id)).length === 0 ? (
                        <div className="text-[10px] text-[var(--muted-2)]">No linked incidents in the current ledger.</div>
                      ) : null}
                    </div>
                  </div>

                  <div className="p-4">
                    <button
                      type="button"
                      className="btn btn-primary w-full"
                      onClick={() => navigate(`/entity/${entity.id}`)}
                    >
                      Open full dossier
                      <ArrowUpRight size={12} />
                    </button>
                    <button type="button" className="btn btn-ghost mt-1.5 w-full" onClick={() => navigate('/geoint')}>
                      <MapPin size={12} />
                      Locate in digital twin
                    </button>
                  </div>
                </div>
              ) : incident ? (
                <div>
                  <div className="border-b border-[var(--line)] p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <SeverityBadge severity={incident.severity} />
                      <IncidentStatusBadge status={incident.status} />
                    </div>
                    <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--muted-2)]">{incident.reference}</div>
                    <h2 className="mt-1.5 font-display text-xl leading-tight tracking-[-0.03em] text-[var(--text-bright)]">{incident.title}</h2>
                    <p className="mt-3 text-[10.5px] leading-relaxed text-[var(--muted)]">{incident.summary}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-px border-b border-[var(--line)] bg-[var(--line)]">
                    <div className="bg-[rgba(7,12,18,0.96)] px-3 py-3">
                      <div className="label-micro">Impact score</div>
                      <div className="data-value mt-1 text-[18px]">{incident.impactScore}<span className="text-[9px] text-[var(--muted)]">/100</span></div>
                      <ProgressBar value={incident.impactScore} className="mt-2" color={incident.severity === 'critical' ? 'var(--red)' : 'var(--amber)'} />
                    </div>
                    <div className="bg-[rgba(7,12,18,0.96)] px-3 py-3">
                      <div className="label-micro">Confidence</div>
                      <div className="data-value mt-1 text-[18px]">{incident.confidence}%</div>
                      <ProgressBar value={incident.confidence} className="mt-2" color="var(--cyan)" />
                    </div>
                  </div>
                  <div className="border-b border-[var(--line)] p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="label-micro">Response elements</span>
                      <RadioTower size={11} className="text-[var(--muted)]" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {incident.teams.length ? incident.teams.map((team) => <span key={team} className="badge badge-cyan">{team}</span>) : <span className="text-[10px] text-[var(--muted-2)]">No teams assigned</span>}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[9px]">
                      <div>
                        <div className="label-micro">Commander</div>
                        <div className="mt-1 text-[var(--text)]">{incident.commander}</div>
                      </div>
                      <div>
                        <div className="label-micro">Last update</div>
                        <div className="mt-1 text-[var(--text)]">{formatRelative(incident.updatedAt)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="border-b border-[var(--line)] p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="label-micro">Latest ledger events</span>
                      <Gauge size={11} className="text-[var(--muted)]" />
                    </div>
                    <div className="space-y-2.5">
                      {incident.timeline.slice(-3).reverse().map((event) => (
                        <div key={event.id} className="relative border-l border-[var(--line-strong)] pl-3">
                          <span className="absolute -left-[2.5px] top-1 h-1 w-1 bg-[var(--cyan)]" />
                          <div className="text-[10px] text-[var(--text)]">{event.title}</div>
                          <div className="mt-0.5 text-[9px] text-[var(--muted-2)]">{formatRelative(event.at)} · {event.actor ?? 'System'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4">
                    <button type="button" className="btn btn-primary w-full" onClick={() => navigate(`/incidents/${incident.id}`)}>
                      Open command dossier
                      <ExternalLink size={12} />
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="border-b border-[var(--line)] p-4">
                    <div className="flex items-center justify-between">
                      <span className="label-micro">Operational context</span>
                      <span className="badge badge-green">Live synthesis</span>
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <div className="data-value text-[34px] leading-none">{readiness}</div>
                        <div className="label-micro mt-2">Readiness index</div>
                      </div>
                      <div className="mb-1 flex items-center gap-1 font-mono text-[8px] text-[var(--green)]">
                        <span className="h-1 w-1 bg-[var(--green)]" />
                        +0.6
                      </div>
                    </div>
                    <ProgressBar value={readiness} color="var(--cyan)" className="mt-4" />
                  </div>

                  <div className="border-b border-[var(--line)] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="label-micro">Active incident load</span>
                      <span className="font-mono text-[9px] text-[var(--red)]">{String(activeIncidents.length).padStart(2, '0')}</span>
                    </div>
                    <div className="space-y-1.5">
                      {activeIncidents.slice(0, 4).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="flex w-full items-center gap-2 border border-[var(--line)] bg-white/[0.018] px-2 py-2 text-left hover:bg-white/[0.03]"
                          onClick={() => openInspector('incident', item.id)}
                        >
                          <span className={`h-1.5 w-1.5 flex-none ${item.severity === 'critical' ? 'bg-[var(--red)]' : item.severity === 'high' ? 'bg-[var(--amber)]' : 'bg-[var(--cyan)]'}`} />
                          <span className="min-w-0 flex-1 truncate text-[9.5px] text-[var(--text)]">{item.reference} · {item.title}</span>
                          <span className="font-mono text-[7px] text-[var(--muted-2)]">{formatRelative(item.updatedAt)}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-b border-[var(--line)] p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Bot size={12} className="text-[var(--violet)]" />
                      <span className="label-micro">Nexus intelligence</span>
                    </div>
                    <p className="text-[10px] leading-relaxed text-[var(--muted)]">
                      Eastern grid reserve remains the dominant cross-domain risk. Tidal Bridge vibration and Foundry air quality are compounding
                      local constraints. Recommend holding protected feeds until reserve exceeds 18% for two consecutive hours.
                    </p>
                    <button type="button" className="mt-3 flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--cyan)]" onClick={() => navigate('/ai')}>
                      Open intelligence thread <ChevronRight size={10} />
                    </button>
                  </div>

                  <div className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="label-micro">Latest signals</span>
                      <Activity size={11} className="text-[var(--muted)]" />
                    </div>
                    <div className="space-y-2">
                      {notifications.slice(0, 4).map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          className="block w-full border-l border-[var(--line-strong)] pl-2.5 text-left hover:border-[var(--cyan)]"
                          onClick={() => notification.href && navigate(notification.href)}
                        >
                          <div className="line-clamp-1 text-[9.5px] text-[var(--text)]">{notification.title}</div>
                          <div className="mt-0.5 font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{titleCase(notification.category)} · {formatRelative(notification.createdAt)}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mx-4 mb-4 border border-[var(--line)] bg-white/[0.02] p-3">
                    <div className="flex items-center gap-2">
                      <Building2 size={12} className="text-[var(--muted)]" />
                      <span className="text-[9px] text-[var(--muted)]">Select a building, entity or incident to load a dossier into this inspector.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  )
}
