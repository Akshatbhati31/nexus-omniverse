import { useReducedMotion } from 'framer-motion'
import {
  Boxes,
  Camera,
  ChevronRight,
  Crosshair,
  Eye,
  EyeOff,
  Globe2,
  Layers3,
  LocateFixed,
  Map,
  Maximize2,
  Rotate3d,
  ScanLine,
  ShieldCheck,
  Siren,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CityMap2D } from '../components/map/CityMap2D'
import { CityCanvas } from '../components/three/CityCanvas'
import { WorkspaceNav } from '../components/layout/WorkspaceNav'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel, PanelHeader } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { SeverityBadge, IncidentStatusBadge, EntityStatusBadge } from '../components/ui/StatusBadge'
import { CITY_LAYERS, DISTRICTS } from '../data/constants'
import { DISTRICT_METRICS } from '../data/datasets'
import { getEntityKindLabel } from '../data/entities'
import { formatRelative } from '../lib/format'
import { cn } from '../lib/utils'
import { usePlatformStore } from '../store/usePlatformStore'
import { useUIStore } from '../store/useUIStore'
import type { CameraMode, CityLayer } from '../types'

const DEFAULT_LAYERS: CityLayer[] = ['infrastructure', 'incidents', 'transport', 'energy', 'environment']

const CAMERA_MODES: Array<{ id: CameraMode; label: string }> = [
  { id: 'orbit', label: 'Orbit' },
  { id: 'top', label: 'Top-down' },
  { id: 'street', label: 'Street' },
  { id: 'cinematic', label: 'Cinematic' },
]

export default function GeoIntPage() {
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const entities = usePlatformStore((state) => state.entities)
  const incidents = usePlatformStore((state) => state.incidents)
  const openInspector = useUIStore((state) => state.openInspector)
  const [mode, setMode] = useState<'3d' | '2d'>('3d')
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit')
  const [layers, setLayers] = useState<Set<CityLayer>>(new Set(DEFAULT_LAYERS))
  const [selectedEntityId, setSelectedEntityId] = useState<string>('fac-lumen-grid')
  const selectedEntity = entities.find((entity) => entity.id === selectedEntityId)
  const activeIncidents = incidents.filter((incident) => !['resolved', 'archived'].includes(incident.status))
  const linkedIncidents = incidents.filter(
    (incident) => incident.primaryEntityId === selectedEntityId || incident.relatedEntityIds.includes(selectedEntityId),
  )
  const rankedDistricts = useMemo(() => [...DISTRICT_METRICS].sort((a, b) => b.risk - a.risk), [])

  const toggleLayer = (layer: CityLayer) => {
    setLayers((current) => {
      const next = new Set(current)
      if (next.has(layer)) next.delete(layer)
      else next.add(layer)
      return next
    })
  }

  const selectEntity = (id: string) => {
    setSelectedEntityId(id)
    openInspector('entity', id)
  }

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        kicker="Intelligence network // Geographic twin"
        title="Aurelia, rendered as a system."
        subtitle="A procedural, deterministic digital twin of the metropolitan theater. Every district, asset and active response resolves to the same operating model."
        meta={
          <>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <Globe2 size={10} className="text-[var(--cyan)]" />
              8 districts / 42 linked assets
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <ScanLine size={10} className="text-[var(--violet)]" />
              Twin fidelity 98.2%
            </span>
            <span className="badge badge-amber">Procedural model · simulated</span>
          </>
        }
        actions={
          <>
            <div className="flex border border-[var(--line)] p-0.5">
              <button type="button" className={cn('btn btn-sm border-transparent bg-transparent', mode === '3d' && 'bg-[var(--cyan-dim)] text-[var(--cyan)]')} onClick={() => setMode('3d')}>
                <Boxes size={11} /> 3D twin
              </button>
              <button type="button" className={cn('btn btn-sm border-transparent bg-transparent', mode === '2d' && 'bg-[var(--cyan-dim)] text-[var(--cyan)]')} onClick={() => setMode('2d')}>
                <Map size={11} /> 2D schematic
              </button>
            </div>
            <button type="button" className="btn" onClick={() => navigate('/infrastructure')}>
              <Layers3 size={12} /> Asset inventory
            </button>
          </>
        }
      />

      <WorkspaceNav domain="geoint" />

      <div className="grid gap-3 xl:grid-cols-[240px_minmax(0,1fr)_290px]">
        <Panel className="order-2 xl:order-1">
          <PanelHeader title="Map layers" eyebrow="Signal composition" icon={<Layers3 size={13} />} action={<span className="font-mono text-[8px] text-[var(--muted-2)]">{layers.size}/8</span>} />
          <div className="p-2">
            {CITY_LAYERS.map((layer) => {
              const active = layers.has(layer.id)
              return (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => toggleLayer(layer.id)}
                  className={cn(
                    'group flex w-full items-start gap-2.5 border border-transparent px-2.5 py-2.5 text-left transition-colors',
                    active ? 'bg-white/[0.025]' : 'opacity-55 hover:bg-white/[0.02] hover:opacity-90',
                  )}
                  aria-pressed={active}
                >
                  <span className="mt-1 h-1.5 w-1.5 flex-none" style={{ background: active ? layer.color : 'var(--muted-2)', boxShadow: active ? `0 0 8px ${layer.color}66` : undefined }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn('text-[10.5px]', active ? 'text-[var(--text)]' : 'text-[var(--muted)]')}>{layer.label}</span>
                      <span className="font-mono text-[7px] text-[var(--muted-2)]">{layer.code}</span>
                    </span>
                    <span className="mt-1 block text-[9px] leading-relaxed text-[var(--muted-2)]">{layer.description}</span>
                  </span>
                  {active ? <Eye size={11} className="mt-1 flex-none text-[var(--muted)]" /> : <EyeOff size={11} className="mt-1 flex-none text-[var(--muted-2)]" />}
                </button>
              )
            })}
          </div>
          <div className="flex gap-1.5 border-t border-[var(--line)] p-2.5">
            <button type="button" className="btn btn-sm flex-1" onClick={() => setLayers(new Set(CITY_LAYERS.map((layer) => layer.id)))}>
              All
            </button>
            <button type="button" className="btn btn-sm flex-1" onClick={() => setLayers(new Set())}>
              Clear
            </button>
          </div>
          <div className="border-t border-[var(--line)] p-3">
            <div className="label-micro">Twin integrity</div>
            <div className="mt-2 flex items-center justify-between">
              <span className="data-value text-[22px]">98.2%</span>
              <span className="flex items-center gap-1 font-mono text-[8px] text-[var(--green)]"><ShieldCheck size={10} /> reconciled</span>
            </div>
            <ProgressBar value={98.2} color="var(--cyan)" className="mt-2" />
            <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[8px] text-[var(--muted-2)]">
              <span>Geometry 99.4%</span>
              <span>Telemetry 97.8%</span>
              <span>Entities {entities.length}</span>
              <span>Signals 42/42</span>
            </div>
          </div>
        </Panel>

        <div className="order-1 min-w-0 xl:order-2">
          <Panel className="relative overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
              <div className="flex items-center gap-2">
                <Crosshair size={12} className="text-[var(--cyan)]" />
                <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--text)]">
                  {mode === '3d' ? 'Aurelia prime / procedural digital twin' : 'Aurelia prime / operational schematic'}
                </span>
                <span className="badge badge-muted">38.4221 N · 0.3382 W</span>
              </div>
              <div className="flex items-center gap-1">
                {mode === '3d' ? (
                  <div className="flex items-center gap-1 border border-[var(--line)] p-0.5">
                    <Camera size={11} className="mx-1 text-[var(--muted-2)]" />
                    {CAMERA_MODES.map((camera) => (
                      <button
                        key={camera.id}
                        type="button"
                        className={cn('btn btn-sm h-5 border-transparent bg-transparent px-1.5 text-[8px]', cameraMode === camera.id && 'bg-[var(--cyan-dim)] text-[var(--cyan)]')}
                        onClick={() => setCameraMode(camera.id)}
                      >
                        {camera.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <button type="button" className="icon-btn h-7 w-7" onClick={() => setCameraMode('orbit')} aria-label="Reset view" title="Reset view">
                  <Rotate3d size={13} />
                </button>
              </div>
            </div>
            <div className="relative h-[470px] w-full sm:h-[520px] xl:h-[calc(100dvh-300px)] xl:min-h-[480px]">
              {mode === '3d' ? (
                <CityCanvas
                  className="h-full w-full"
                  entities={entities}
                  incidents={incidents}
                  layers={layers}
                  cameraMode={cameraMode}
                  selectedEntityId={selectedEntityId}
                  onSelectEntity={selectEntity}
                  onSelectIncident={(id) => openInspector('incident', id)}
                  reduceMotion={Boolean(reduceMotion)}
                />
              ) : (
                <CityMap2D
                  layers={layers}
                  entities={entities}
                  incidents={incidents}
                  selectedEntityId={selectedEntityId}
                  onSelectEntity={selectEntity}
                  onSelectIncident={(id) => openInspector('incident', id)}
                />
              )}

              <div className="pointer-events-none absolute left-3 top-3 border border-[var(--line)] bg-[rgba(5,10,16,0.78)] px-2.5 py-1.5 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <span className="h-1 w-1 bg-[var(--green)] shadow-[0_0_8px_var(--green)]" />
                  <span className="font-mono text-[7px] uppercase tracking-[0.12em] text-[var(--text)]">Digital twin active</span>
                </div>
                <div className="mt-1 font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--muted-2)]">
                  {mode === '3d' ? `Camera ${cameraMode} · procedural geometry` : 'Schematic · vector layers'}
                </div>
              </div>

              <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between border border-[var(--line)] bg-[rgba(5,10,16,0.78)] px-2.5 py-1.5 backdrop-blur-sm">
                <span className="font-mono text-[7px] uppercase tracking-[0.1em] text-[var(--muted)]">
                  {activeIncidents.length} active signals · {layers.size} layers · synthetic model
                </span>
                <span className="flex items-center gap-1 font-mono text-[7px] text-[var(--cyan)]"><Maximize2 size={8} /> drag to orbit · scroll to zoom</span>
              </div>

              <div className="pointer-events-none absolute right-3 top-3 hidden flex-col gap-1 border border-[var(--line)] bg-[rgba(5,10,16,0.82)] px-2.5 py-2 backdrop-blur-sm sm:flex">
                {CITY_LAYERS.filter((layer) => layers.has(layer.id)).map((layer) => (
                  <div key={layer.id} className="flex items-center gap-1.5">
                    <span className="h-1 w-2.5" style={{ background: layer.color }} />
                    <span className="font-mono text-[7px] uppercase tracking-[0.1em] text-[var(--muted)]">{layer.legend}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Panel>
              <PanelHeader
                title="Operational focus"
                eyebrow={selectedEntity ? getEntityKindLabel(selectedEntity.kind) : 'Theater context'}
                icon={<LocateFixed size={13} />}
                action={
                  selectedEntity ? (
                    <button type="button" className="btn btn-sm" onClick={() => navigate(`/entity/${selectedEntity.id}`)}>
                      Dossier <ChevronRight size={10} />
                    </button>
                  ) : null
                }
              />
              {selectedEntity ? (
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--muted-2)]">{selectedEntity.code}</div>
                      <h3 className="mt-1 font-display text-lg tracking-[-0.025em] text-[var(--text-bright)]">{selectedEntity.name}</h3>
                    </div>
                    <EntityStatusBadge status={selectedEntity.status} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-[var(--muted)]">{selectedEntity.description}</p>
                  <div className="mt-3 grid grid-cols-2 gap-px bg-[var(--line)]">
                    {selectedEntity.vitals.slice(0, 4).map((vital) => (
                      <div key={vital.label} className="bg-[rgba(8,13,19,0.9)] px-2.5 py-2">
                        <div className="label-micro">{vital.label}</div>
                        <div className="mt-1 font-mono text-[14px] text-[var(--text-bright)]">
                          {vital.value.toLocaleString()} <span className="text-[8px] text-[var(--muted)]">{vital.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-3">
                    <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">{linkedIncidents.length} linked incidents</span>
                    <button type="button" className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--cyan)]" onClick={() => openInspector('entity', selectedEntity.id)}>
                      Inspect <ChevronRight size={10} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-[10px] text-[var(--muted)]">Select a building or facility marker to load its dossier.</div>
              )}
            </Panel>

            <Panel>
              <PanelHeader title="Active signals" eyebrow="Geospatial response" icon={<Siren size={13} />} action={<button type="button" className="btn btn-sm" onClick={() => navigate('/incidents')}>Command</button>} />
              <div className="divide-y divide-[var(--line)]">
                {activeIncidents.slice(0, 4).map((incident) => (
                  <button
                    key={incident.id}
                    type="button"
                    className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.025]"
                    onClick={() => navigate(`/incidents/${incident.id}`)}
                  >
                    <SeverityBadge severity={incident.severity} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10px] text-[var(--text)]">{incident.title}</span>
                      <span className="mt-1 flex items-center gap-2">
                        <IncidentStatusBadge status={incident.status} />
                        <span className="font-mono text-[7px] text-[var(--muted-2)]">{formatRelative(incident.updatedAt)}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </Panel>
          </div>
        </div>

        <div className="order-3 space-y-3">
          <Panel>
            <PanelHeader title="District risk" eyebrow="Composite exposure" icon={<Globe2 size={13} />} />
            <div className="space-y-3 p-4">
              {rankedDistricts.map((district) => (
                <button
                  key={district.name}
                  type="button"
                  className="block w-full text-left"
                  onClick={() => {
                    const definition = DISTRICTS.find((item) => item.code === district.name)
                    if (definition) navigate(`/geoint/district/${definition.id}`)
                  }}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="h-1 w-1" style={{ background: district.color }} />
                      <span className="text-[10px] text-[var(--text)]">{district.fullName}</span>
                    </div>
                    <span className="font-mono text-[8px] text-[var(--muted)]">{district.risk}</span>
                  </div>
                  <ProgressBar value={district.risk} color={district.risk >= 70 ? 'var(--red)' : district.risk >= 55 ? 'var(--amber)' : district.color} />
                </button>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Selected geography" eyebrow="Model scope" icon={<Map size={13} />} />
            <div className="p-4">
              {DISTRICTS.filter((district) => selectedEntity?.districtId === district.id || selectedEntity?.id === district.id).map((district) => (
                <div key={district.id}>
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm text-[var(--text-bright)]">{district.name}</span>
                    <span className="badge" style={{ color: district.color, borderColor: `${district.color}33` }}>{district.code}</span>
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted)]">{district.description}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="border border-[var(--line)] px-2 py-1.5">
                      <div className="label-micro">Population</div>
                      <div className="data-value mt-1 text-[13px]">{(district.population / 1_000_000).toFixed(2)}M</div>
                    </div>
                    <div className="border border-[var(--line)] px-2 py-1.5">
                      <div className="label-micro">Risk</div>
                      <div className="data-value mt-1 text-[13px]">{district.risk}/100</div>
                    </div>
                  </div>
                  <button type="button" className="btn btn-sm mt-3 w-full" onClick={() => navigate(`/geoint/district/${district.id}`)}>
                    <Map size={10} /> Open regional workspace <ChevronRight size={10} />
                  </button>
                </div>
              ))}
              {!DISTRICTS.some((district) => selectedEntity?.districtId === district.id || selectedEntity?.id === district.id) ? (
                <div className="text-[10px] leading-relaxed text-[var(--muted)]">This asset is modeled at theater scale. Select a district-linked facility to inspect local geography.</div>
              ) : null}
            </div>
          </Panel>

          <Panel className="relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(86,225,255,0.08),transparent_65%)]" />
            <div className="relative p-4">
              <div className="flex items-center gap-2">
                <ScanLine size={12} className="text-[var(--violet)]" />
                <span className="label-micro">Twin advisory</span>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted)]">
                Geometry is generated locally from a deterministic seed. No live sensor or geospatial provider is connected in this demo. Layer
                composition and camera position are session-scoped and not persisted.
              </p>
              <div className="mt-3 flex items-center gap-2 font-mono text-[7px] uppercase tracking-[0.1em] text-[var(--muted-2)]">
                <span className="h-1 w-1 bg-[var(--amber)]" />
                simulated model · no external feed
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
