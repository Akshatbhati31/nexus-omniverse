import { useMemo, useState } from 'react'
import {
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  FlaskConical,
  Gauge,
  GitCompare,
  Play,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  Waypoints,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel, PanelHeader } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { SeriesChart } from '../components/charts/SeriesChart'
import { defaultParameters, runSimulation, SIMULATION_MODELS } from '../lib/simulation'
import { formatRelative } from '../lib/format'
import { cn, downloadFile } from '../lib/utils'
import { usePlatformStore } from '../store/usePlatformStore'
import { usePermission } from '../store/useSessionStore'
import { useUIStore } from '../store/useUIStore'
import type { ChartDataset, SimulationKind, SimulationParameters, SimulationResult } from '../types'

const MODEL_ORDER: SimulationKind[] = ['route_closure', 'power_shortage', 'supply_chain', 'rainfall', 'population_growth']

interface CommittedRun {
  kind: SimulationKind
  parameters: SimulationParameters
  result: SimulationResult
}

export default function SimulationPage() {
  const simulations = usePlatformStore((state) => state.simulations)
  const saveSimulation = usePlatformStore((state) => state.saveSimulation)
  const deleteSimulation = usePlatformStore((state) => state.deleteSimulation)
  const pushToast = useUIStore((state) => state.pushToast)
  const canSave = usePermission('simulation:save')

  const initialKind: SimulationKind = 'route_closure'
  const initialParameters = defaultParameters(initialKind)
  const [kind, setKind] = useState<SimulationKind>(initialKind)
  const [parameters, setParameters] = useState<SimulationParameters>(initialParameters)
  const [committed, setCommitted] = useState<CommittedRun>({
    kind: initialKind,
    parameters: initialParameters,
    result: runSimulation(initialKind, initialParameters),
  })
  const [name, setName] = useState('Tidal corridor stress test')
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null)
  const [compareId, setCompareId] = useState<string>('')

  const model = SIMULATION_MODELS[kind]
  const dirty = JSON.stringify(parameters) !== JSON.stringify(committed.parameters) || kind !== committed.kind
  const result = committed.result
  const comparison = simulations.find((simulation) => simulation.id === compareId)
  const peakPrimary = result.series.reduce((peak, point) => Math.max(peak, point.primary), 0)
  const comparisonPeak = comparison ? comparison.result.series.reduce((peak, point) => Math.max(peak, point.primary), 0) : 0

  const chartDataset = useMemo<ChartDataset>(() => {
    const secondaryScale = result.kind === 'power_shortage' ? 1_000 : 1
    return {
      id: `simulation-${result.kind}`,
      title: result.title,
      source: 'Deterministic simulation engine · hypothetical',
      unit: 'mixed',
      data: result.series.map((point) => ({
        time: point.label,
        primary: point.primary,
        secondary: Number((point.secondary / secondaryScale).toFixed(1)),
        tertiary: point.tertiary,
      })),
      series: [
        { key: 'primary', label: model.primaryLabel, color: model.accent },
        { key: 'secondary', label: result.kind === 'power_shortage' ? `${model.secondaryLabel} (k)` : model.secondaryLabel, color: '#8f7cff' },
        { key: 'tertiary', label: model.tertiaryLabel, color: '#5ce1a4' },
      ],
    }
  }, [model, result])

  const selectModel = (next: SimulationKind) => {
    const nextParameters = defaultParameters(next)
    setKind(next)
    setParameters(nextParameters)
    setCommitted({ kind: next, parameters: nextParameters, result: runSimulation(next, nextParameters) })
    setSelectedSavedId(null)
    setName(`${SIMULATION_MODELS[next].label} scenario`)
  }

  const updateParameter = <K extends keyof SimulationParameters>(key: K, value: SimulationParameters[K]) => {
    setParameters((current) => ({ ...current, [key]: value }))
  }

  const commitRun = () => {
    setCommitted({ kind, parameters, result: runSimulation(kind, parameters) })
    setSelectedSavedId(null)
    pushToast({ title: 'Scenario executed', message: `${model.label} recomputed deterministically.`, tone: 'success' })
  }

  const saveRun = () => {
    if (!canSave) {
      pushToast({ title: 'Insufficient permission', message: 'Your role cannot save simulation runs.', tone: 'danger' })
      return
    }
    if (!name.trim()) {
      pushToast({ title: 'Scenario name required', message: 'Give the scenario a name before saving.', tone: 'warning' })
      return
    }
    const saveResult = saveSimulation({
      name: name.trim(),
      kind: committed.kind,
      parameters: committed.parameters,
      result: committed.result,
    })
    if (!saveResult.ok) {
      pushToast({ title: 'Scenario not saved', message: saveResult.message, tone: 'danger' })
      return
    }
    pushToast({ title: 'Scenario saved', message: saveResult.message, tone: 'success' })
  }

  const loadSaved = (id: string) => {
    const saved = simulations.find((simulation) => simulation.id === id)
    if (!saved) return
    setKind(saved.kind)
    setParameters(saved.parameters)
    setCommitted({ kind: saved.kind, parameters: saved.parameters, result: saved.result })
    setSelectedSavedId(saved.id)
    setName(saved.name)
    pushToast({ title: 'Scenario loaded', message: saved.name, tone: 'info' })
  }

  const removeSaved = (id: string) => {
    const removeResult = deleteSimulation(id)
    if (!removeResult.ok) {
      pushToast({ title: 'Scenario not removed', message: removeResult.message, tone: 'danger' })
      return
    }
    if (selectedSavedId === id) setSelectedSavedId(null)
    if (compareId === id) setCompareId('')
    pushToast({ title: 'Scenario removed', message: removeResult.message, tone: 'success' })
  }

  const exportRun = () => {
    downloadFile(
      `nexus-simulation-${committed.kind}.json`,
      JSON.stringify(
        {
          model: SIMULATION_MODELS[committed.kind],
          parameters: committed.parameters,
          result: committed.result,
          provenance: 'Deterministic local simulation — hypothetical decision support only.',
        },
        null,
        2,
      ),
      'application/json;charset=utf-8',
    )
  }

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        kicker="Operations // Simulation laboratory"
        title="Test the system before it fails."
        subtitle="Run deterministic, hypothetical stress scenarios across the Aurelia operating model. Outputs are decision-support illustrations, not real-world predictions."
        meta={
          <>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <FlaskConical size={10} className="text-[var(--violet)]" /> 5 scenario models
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <ShieldCheck size={10} className="text-[var(--green)]" /> deterministic engine
            </span>
            <span className="badge badge-amber">Hypothetical output</span>
          </>
        }
        actions={
          <>
            <button type="button" className="btn" onClick={exportRun}>
              <Download size={12} /> Export run
            </button>
            <button type="button" className="btn btn-primary" onClick={commitRun}>
              <Play size={12} /> Run scenario
            </button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-start gap-2 border border-[var(--amber)]/20 bg-[var(--amber-dim)] px-3 py-2.5">
        <TriangleAlert size={13} className="mt-0.5 flex-none text-[var(--amber)]" />
        <p className="text-[9.5px] leading-relaxed text-[var(--muted)]">
          <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--amber)]">Model boundary · </span>
          Scenarios use deterministic graph propagation with bounded capacity assumptions. They do not connect to live systems, forecast real events or replace operational judgment.
        </p>
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-4">
          <Panel>
            <PanelHeader title="Scenario model" eyebrow="Select hypothesis" icon={<FlaskConical size={13} />} />
            <div className="p-2">
              {MODEL_ORDER.map((modelId) => {
                const definition = SIMULATION_MODELS[modelId]
                const active = kind === modelId
                return (
                  <button
                    key={modelId}
                    type="button"
                    className={cn('flex w-full items-start gap-2.5 border border-transparent px-2.5 py-2.5 text-left transition-colors', active ? 'bg-white/[0.035]' : 'opacity-65 hover:bg-white/[0.02] hover:opacity-100')}
                    onClick={() => selectModel(modelId)}
                    aria-pressed={active}
                  >
                    <span className="mt-0.5 h-1.5 w-1.5 flex-none" style={{ background: active ? definition.accent : 'var(--muted-2)' }} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[10.5px] text-[var(--text)]">{definition.label}</span>
                        <span className="font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{definition.code}</span>
                      </span>
                      <span className="mt-1 block text-[9px] leading-relaxed text-[var(--muted-2)]">{definition.description}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Parameters" eyebrow={model.code} icon={<SlidersHorizontal size={13} />} action={dirty ? <span className="badge badge-amber">uncommitted</span> : <span className="badge badge-green">committed</span>} />
            <div className="space-y-4 p-4">
              <label className="block">
                <span className="flex items-center justify-between">
                  <span className="label-micro">Horizon</span>
                  <span className="font-mono text-[9px] text-[var(--text)]">{parameters.duration}h</span>
                </span>
                <input type="range" min={4} max={96} step={2} value={parameters.duration} onChange={(event) => updateParameter('duration', Number(event.target.value))} className="mt-2 w-full accent-[var(--cyan)]" aria-label="Scenario horizon in hours" />
              </label>

              <label className="block">
                <span className="flex items-center justify-between">
                  <span className="label-micro">Intensity</span>
                  <span className="font-mono text-[9px] text-[var(--text)]">{parameters.intensity}%</span>
                </span>
                <input type="range" min={10} max={100} step={1} value={parameters.intensity} onChange={(event) => updateParameter('intensity', Number(event.target.value))} className="mt-2 w-full accent-[var(--cyan)]" aria-label="Scenario intensity" />
              </label>

              {kind === 'rainfall' ? (
                <label className="block">
                  <span className="flex items-center justify-between">
                    <span className="label-micro">Rainfall</span>
                    <span className="font-mono text-[9px] text-[var(--text)]">{parameters.rainfall} mm</span>
                  </span>
                  <input type="range" min={4} max={120} step={2} value={parameters.rainfall} onChange={(event) => updateParameter('rainfall', Number(event.target.value))} className="mt-2 w-full accent-[var(--cyan)]" aria-label="Rainfall in millimetres" />
                </label>
              ) : null}

              {kind === 'population_growth' ? (
                <label className="block">
                  <span className="flex items-center justify-between">
                    <span className="label-micro">Population change</span>
                    <span className="font-mono text-[9px] text-[var(--text)]">+{parameters.populationChange}%</span>
                  </span>
                  <input type="range" min={1} max={30} step={1} value={parameters.populationChange} onChange={(event) => updateParameter('populationChange', Number(event.target.value))} className="mt-2 w-full accent-[var(--cyan)]" aria-label="Population change percentage" />
                </label>
              ) : null}

              <label className="block">
                <span className="label-micro">{model.nodeLabel}</span>
                <select className="field mt-1.5" value={parameters.affectedNode} onChange={(event) => updateParameter('affectedNode', event.target.value)}>
                  {model.nodeOptions.map((node) => <option key={node} value={node}>{node}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="flex items-center justify-between">
                  <span className="label-micro">Cascade depth</span>
                  <span className="font-mono text-[9px] text-[var(--text)]">{parameters.cascadeDepth}</span>
                </span>
                <input type="range" min={1} max={5} step={1} value={parameters.cascadeDepth} onChange={(event) => updateParameter('cascadeDepth', Number(event.target.value))} className="mt-2 w-full accent-[var(--cyan)]" aria-label="Cascade depth" />
              </label>

              <button type="button" className="flex w-full items-center justify-between border border-[var(--line)] px-3 py-2.5 text-left" onClick={() => updateParameter('redundancy', !parameters.redundancy)} aria-pressed={parameters.redundancy}>
                <span>
                  <span className="block text-[10px] text-[var(--text)]">Redundancy available</span>
                  <span className="mt-0.5 block text-[8.5px] text-[var(--muted-2)]">Alternate capacity absorbs part of the disruption.</span>
                </span>
                <span className={cn('relative h-4 w-8 flex-none border', parameters.redundancy ? 'border-[var(--cyan)] bg-[var(--cyan-dim)]' : 'border-[var(--line-strong)] bg-black/20')}>
                  <span className={cn('absolute top-0.5 h-2.5 w-2.5 transition-all', parameters.redundancy ? 'left-[17px] bg-[var(--cyan)]' : 'left-0.5 bg-[var(--muted-2)]')} />
                </span>
              </button>

              <div className="flex gap-2">
                <button type="button" className="btn flex-1" onClick={() => setParameters(committed.parameters)} disabled={!dirty}>
                  <RotateCcw size={11} /> Reset
                </button>
                <button type="button" className="btn btn-primary flex-1" onClick={commitRun}>
                  <Play size={11} /> Run
                </button>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-3 xl:col-span-8">
          <Panel>
            <PanelHeader
              title={result.title}
              eyebrow={`${model.code} · ${result.horizonHours}h horizon · deterministic`}
              icon={<Waypoints size={13} />}
              action={<span className="badge badge-violet">{result.confidence}% confidence</span>}
            />
            <div className="grid gap-0 md:grid-cols-[1fr_200px]">
              <div className="border-b border-[var(--line)] p-4 md:border-b-0 md:border-r">
                <p className="text-[11px] leading-relaxed text-[var(--muted)]">{result.summary}</p>
                <div className="mt-4 grid grid-cols-2 gap-px bg-[var(--line)] sm:grid-cols-4">
                  {result.impacts.map((impact) => (
                    <div key={impact.label} className="bg-[rgba(8,13,19,0.9)] px-3 py-2.5">
                      <div className="label-micro">{impact.label}</div>
                      <div className="data-value mt-1 text-[17px]" style={{ color: impact.severity === 'critical' ? 'var(--red)' : impact.severity === 'high' ? 'var(--amber)' : impact.severity === 'moderate' ? 'var(--cyan)' : 'var(--green)' }}>{impact.value}</div>
                      <div className="mt-1 font-mono text-[7.5px] uppercase tracking-[0.06em] text-[var(--muted-2)]">{impact.direction} · {impact.severity}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4">
                <div className="label-micro">Model confidence</div>
                <div className="mt-2 flex items-end gap-2">
                  <span className="data-value text-[30px]">{result.confidence}</span>
                  <span className="mb-1 font-mono text-[9px] text-[var(--muted-2)]">/ 100</span>
                </div>
                <ProgressBar value={result.confidence} color="var(--violet)" className="mt-2" />
                <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-3">
                  <div className="flex items-center justify-between text-[9px]"><span className="text-[var(--muted-2)]">Affected nodes</span><span className="font-mono text-[var(--text)]">{result.affectedNodes.length}</span></div>
                  <div className="flex items-center justify-between text-[9px]"><span className="text-[var(--muted-2)]">Peak primary</span><span className="font-mono text-[var(--text)]">{peakPrimary.toFixed(1)}</span></div>
                  <div className="flex items-center justify-between text-[9px]"><span className="text-[var(--muted-2)]">Cascade depth</span><span className="font-mono text-[var(--text)]">{committed.parameters.cascadeDepth}</span></div>
                  <div className="flex items-center justify-between text-[9px]"><span className="text-[var(--muted-2)]">Redundancy</span><span className="font-mono" style={{ color: committed.parameters.redundancy ? 'var(--green)' : 'var(--red)' }}>{committed.parameters.redundancy ? 'enabled' : 'disabled'}</span></div>
                </div>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Projected response curves" eyebrow="Hypothetical telemetry" icon={<Gauge size={13} />} action={<span className="font-mono text-[8px] text-[var(--muted-2)]">17 samples</span>} />
            <div className="p-3 pt-4">
              <SeriesChart dataset={chartDataset} type="line" height={280} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] px-4 py-2.5">
              <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">Deterministic seed · same parameters produce identical curves</span>
              <span className="font-mono text-[8px] text-[var(--amber)]">not a forecast</span>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Model notes" eyebrow="Interpretation boundary" icon={<CircleAlert size={13} />} />
            <div className="grid gap-2 p-4 md:grid-cols-2">
              {result.modelNotes.map((note) => (
                <div key={note} className="flex items-start gap-2 border border-[var(--line)] px-2.5 py-2">
                  <span className="mt-1 h-1 w-1 flex-none bg-[var(--amber)]" />
                  <span className="text-[9px] leading-relaxed text-[var(--muted)]">{note}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Save scenario" eyebrow="Persist to workspace" icon={<Save size={13} />} action={!canSave ? <span className="badge badge-muted">read-only</span> : null} />
            <div className="flex flex-wrap items-center gap-2 p-4">
              <input className="field h-8 min-h-0 min-w-[200px] flex-1 text-[10px]" value={name} onChange={(event) => setName(event.target.value)} placeholder="Scenario name" disabled={!canSave} />
              <button type="button" className="btn btn-primary h-8" onClick={saveRun} disabled={!canSave}>
                <Save size={11} /> Save current run
              </button>
            </div>
          </Panel>
        </div>

        <Panel className="xl:col-span-7">
          <PanelHeader title="Saved scenarios" eyebrow="Persistent workspace records" icon={<FlaskConical size={13} />} action={<span className="font-mono text-[8px] text-[var(--muted-2)]">{simulations.length} runs</span>} />
          <div className="divide-y divide-[var(--line)]">
            {simulations.map((simulation) => {
              const definition = SIMULATION_MODELS[simulation.kind]
              return (
                <div key={simulation.id} className={cn('flex flex-wrap items-center gap-3 px-4 py-3 transition-colors', selectedSavedId === simulation.id && 'bg-white/[0.025]')}>
                  <span className="flex h-8 w-8 flex-none items-center justify-center border border-[var(--line)]" style={{ color: definition.accent }}><FlaskConical size={13} /></span>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => loadSaved(simulation.id)}>
                    <span className="block truncate text-[10.5px] text-[var(--text-bright)]">{simulation.name}</span>
                    <span className="mt-0.5 block font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">
                      {definition.code} · {simulation.result.horizonHours}h · {simulation.result.confidence}% confidence · {simulation.owner} · {formatRelative(simulation.createdAt)}
                    </span>
                  </button>
                  <div className="flex items-center gap-1">
                    <button type="button" className="btn btn-sm" onClick={() => setCompareId(simulation.id)} title="Compare with current run">
                      <GitCompare size={10} /> Compare
                    </button>
                    <button type="button" className="icon-btn h-6 w-6" onClick={() => removeSaved(simulation.id)} disabled={!canSave} aria-label={`Delete ${simulation.name}`}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              )
            })}
            {simulations.length === 0 ? <div className="px-4 py-8 text-center text-[10px] text-[var(--muted-2)]">No saved scenarios yet.</div> : null}
          </div>
        </Panel>

        <Panel className="xl:col-span-5">
          <PanelHeader title="Scenario comparison" eyebrow="Current vs saved" icon={<GitCompare size={13} />} action={comparison ? <button type="button" className="btn btn-sm" onClick={() => setCompareId('')}>Clear</button> : null} />
          <div className="p-4">
            {comparison ? (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
                  <div className="min-w-0">
                    <div className="label-micro">Baseline</div>
                    <div className="mt-1 truncate text-[10.5px] text-[var(--text)]">{comparison.name}</div>
                  </div>
                  <span className="badge badge-violet">{SIMULATION_MODELS[comparison.kind].code}</span>
                </div>
                <div className="mt-3 space-y-3">
                  {[
                    { label: 'Confidence', current: `${result.confidence}%`, baseline: `${comparison.result.confidence}%`, delta: result.confidence - comparison.result.confidence },
                    { label: 'Horizon', current: `${result.horizonHours}h`, baseline: `${comparison.result.horizonHours}h`, delta: result.horizonHours - comparison.result.horizonHours },
                    { label: 'Peak primary', current: peakPrimary.toFixed(1), baseline: comparisonPeak.toFixed(1), delta: Number((peakPrimary - comparisonPeak).toFixed(1)) },
                    { label: 'Affected nodes', current: String(result.affectedNodes.length), baseline: String(comparison.result.affectedNodes.length), delta: result.affectedNodes.length - comparison.result.affectedNodes.length },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-2 border-b border-[var(--line)] pb-2.5 last:border-0 last:pb-0">
                      <span className="text-[9.5px] text-[var(--muted)]">{row.label}</span>
                      <span className="flex items-center gap-3 font-mono text-[9px]">
                        <span className="text-[var(--muted-2)]">{row.baseline}</span>
                        <ChevronRight size={9} className="text-[var(--muted-2)]" />
                        <span className="text-[var(--text-bright)]">{row.current}</span>
                        <span className={row.delta > 0 ? 'text-[var(--amber)]' : row.delta < 0 ? 'text-[var(--green)]' : 'text-[var(--muted-2)]'}>
                          {row.delta > 0 ? '+' : ''}{row.delta}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-start gap-2 border border-[var(--line)] bg-white/[0.015] p-2.5">
                  <Clock3 size={11} className="mt-0.5 flex-none text-[var(--violet)]" />
                  <p className="text-[8.5px] leading-relaxed text-[var(--muted-2)]">Select “Compare” on any saved run to inspect differences. Comparison is descriptive only; scenarios may use different models and assumptions.</p>
                </div>
              </>
            ) : (
              <div className="flex min-h-[160px] flex-col items-center justify-center text-center">
                <GitCompare size={20} className="text-[var(--muted-2)]" />
                <p className="mt-3 max-w-xs text-[10px] leading-relaxed text-[var(--muted)]">Choose a saved scenario below to compare it against the current committed run.</p>
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}
