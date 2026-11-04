import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  LayoutDashboard,
  LayoutGrid,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { HeatmapView } from '../components/charts/HeatmapView'
import { RadarView } from '../components/charts/RadarView'
import { SankeyView } from '../components/charts/SankeyView'
import { SeriesChart } from '../components/charts/SeriesChart'
import { TreemapView } from '../components/charts/TreemapView'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel, PanelHeader } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import {
  DATASETS,
  DISTRICT_METRICS,
  GENERATION_MIX,
  INCIDENT_HEATMAP,
  MARKET_SECTORS,
  RADAR_METRICS,
  SUPPLY_CHAIN_LINKS,
} from '../data/datasets'
import { formatRelative, titleCase } from '../lib/format'
import { cn, csvFromRows, downloadFile, uid } from '../lib/utils'
import { usePlatformStore } from '../store/usePlatformStore'
import { usePermission } from '../store/useSessionStore'
import { useUIStore } from '../store/useUIStore'
import type { ChartDataset, Dashboard, DashboardWidget, WidgetType } from '../types'

const districtLoadDataset: ChartDataset = {
  id: 'district_load',
  title: 'District load and risk',
  source: 'Aurelia district model · simulated',
  unit: 'index',
  data: DISTRICT_METRICS.map((district) => ({
    time: district.name,
    load: district.load,
    risk: district.risk,
    resilience: district.resilience,
  })),
  series: [
    { key: 'load', label: 'Infrastructure load', color: '#56e1ff' },
    { key: 'risk', label: 'Risk index', color: '#ff5d73' },
    { key: 'resilience', label: 'Resilience', color: '#5ce1a4' },
  ],
}

const generationMixDataset: ChartDataset = {
  id: 'generation_mix',
  title: 'Generation mix',
  source: 'Helios grid telemetry · simulated',
  unit: '%',
  data: GENERATION_MIX.map((source) => ({ time: source.name, share: source.value })),
  series: [{ key: 'share', label: 'Generation share', color: '#f3b85a' }],
}

interface WidgetSpec {
  datasetId: string
  label: string
  type: WidgetType
  description: string
  source: string
  metricLabel?: string
  metricValue?: string
}

const WIDGET_LIBRARY: WidgetSpec[] = [
  { datasetId: 'metro_load', label: 'Metropolitan load', type: 'timeseries', description: 'Grid, water and transit load in one operating series.', source: 'NEXUS telemetry synthesis' },
  { datasetId: 'incident_velocity', label: 'Incident velocity', type: 'area', description: 'Detected versus resolved incidents across seven days.', source: 'Incident command ledger' },
  { datasetId: 'air_quality', label: 'Air quality by mesh', type: 'timeseries', description: 'AQI traces for central, foundry and vantage meshes.', source: 'Environmental observation network' },
  { datasetId: 'energy_demand', label: 'Grid demand and reserve', type: 'area', description: 'Demand, renewable supply and reserve margin.', source: 'Helios grid telemetry' },
  { datasetId: 'mobility_flow', label: 'Mobility throughput', type: 'bar', description: 'Arterial, rail and freight trip volume.', source: 'Aurelia Transit control' },
  { datasetId: 'economic_index', label: 'Economic composite', type: 'timeseries', description: 'Composite, trade momentum and volatility.', source: 'Aurelia Exchange / simulated' },
  { datasetId: 'water_quality', label: 'Tidal water quality', type: 'timeseries', description: 'Quality index, turbidity and dissolved oxygen.', source: 'Tidal Water Sentinel' },
  { datasetId: 'climate_trend', label: 'Climate reference', type: 'area', description: 'Temperature, rainfall and humidity reference series.', source: 'Solace Climate Observatory' },
  { datasetId: 'district_load', label: 'District load and risk', type: 'bar', description: 'Load, risk and resilience across all eight districts.', source: 'Aurelia district model' },
  { datasetId: 'generation_mix', label: 'Generation mix', type: 'bar', description: 'Current share by generation source.', source: 'Helios grid telemetry' },
  { datasetId: 'distribution', label: 'Response distribution', type: 'distribution', description: 'Incident response-time buckets.', source: 'Incident command ledger' },
  { datasetId: 'radar_resilience', label: 'District resilience', type: 'radar', description: 'Six-axis comparison for three operating districts.', source: 'Resilience model · simulated' },
  { datasetId: 'market_sectors', label: 'Market sectors', type: 'treemap', description: 'Sector weight and directional change.', source: 'Aurelia Exchange / simulated' },
  { datasetId: 'supply_chain', label: 'Supply chain flow', type: 'sankey', description: 'Logistics dependency flow across the theater.', source: 'Supply chain graph · simulated' },
  { datasetId: 'incident_heatmap', label: 'Incident heatmap', type: 'heatmap', description: 'Detection, resolution and severity by district.', source: 'Incident command ledger' },
  { datasetId: 'metric_readiness', label: 'Readiness metric', type: 'metric', description: 'Single-value operational readiness indicator.', source: 'NEXUS composite', metricLabel: 'Readiness', metricValue: '81.7' },
  { datasetId: 'metric_incidents', label: 'Active incidents metric', type: 'metric', description: 'Single-value active incident count.', source: 'Incident command ledger', metricLabel: 'Active incidents', metricValue: '8' },
  { datasetId: 'metric_reserve', label: 'Reserve margin metric', type: 'metric', description: 'Single-value grid reserve indicator.', source: 'Helios grid telemetry', metricLabel: 'Reserve margin', metricValue: '11.4%' },
]

const SPAN_CLASS: Record<number, string> = {
  3: 'xl:col-span-3',
  4: 'xl:col-span-4',
  5: 'xl:col-span-5',
  6: 'xl:col-span-6',
  7: 'xl:col-span-7',
  8: 'xl:col-span-8',
  9: 'xl:col-span-9',
  10: 'xl:col-span-10',
  12: 'xl:col-span-12',
}

const WIDTH_OPTIONS = [4, 6, 8, 12]

function datasetFor(widget: DashboardWidget): ChartDataset | null {
  if (widget.datasetId === 'district_load') return districtLoadDataset
  if (widget.datasetId === 'generation_mix') return generationMixDataset
  return DATASETS[widget.datasetId] ?? null
}

function defaultWidth(type: WidgetType) {
  if (type === 'metric') return 3
  if (type === 'heatmap' || type === 'sankey') return 6
  return 6
}

function defaultHeight(type: WidgetType) {
  if (type === 'metric') return 3
  if (type === 'heatmap' || type === 'sankey' || type === 'treemap') return 4
  return 4
}

function widgetValue(widget: DashboardWidget) {
  if (widget.datasetId === 'metric_readiness') return 81.7
  if (widget.datasetId === 'metric_incidents') return 40
  if (widget.datasetId === 'metric_reserve') return 11.4
  return 50
}

function DashboardWidgetCard({
  widget,
  dataset,
  editing,
  canEdit,
  onChangeWidth,
  onMove,
  onRemove,
}: {
  widget: DashboardWidget
  dataset: ChartDataset | null
  editing: boolean
  canEdit: boolean
  onChangeWidth: (width: number) => void
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
}) {
  const chartHeight = Math.max(148, Math.min(258, widget.h * 54))
  const exportData = () => {
    if (!dataset) return
    downloadFile(`${widget.datasetId}.csv`, csvFromRows(dataset.data))
  }

  return (
    <Panel className={cn('col-span-12 min-w-0', SPAN_CLASS[widget.w] ?? 'xl:col-span-6')}>
      <PanelHeader
        title={widget.title}
        eyebrow={dataset?.source ?? 'NEXUS composite metric'}
        compact
        action={
          <>
            {dataset ? (
              <button type="button" className="icon-btn h-6 w-6" onClick={exportData} aria-label={`Export ${widget.title} data`} title="Export widget CSV">
                <Download size={11} />
              </button>
            ) : null}
            {editing && canEdit ? (
              <>
                <select
                  className="field h-6 min-h-0 w-auto px-1 py-0 text-[8px]"
                  value={widget.w}
                  onChange={(event) => onChangeWidth(Number(event.target.value))}
                  aria-label={`Width for ${widget.title}`}
                >
                  {WIDTH_OPTIONS.map((width) => (
                    <option key={width} value={width}>{width}/12</option>
                  ))}
                </select>
                <button type="button" className="icon-btn h-6 w-6" onClick={() => onMove(-1)} aria-label={`Move ${widget.title} earlier`}>
                  <ChevronUp size={11} />
                </button>
                <button type="button" className="icon-btn h-6 w-6" onClick={() => onMove(1)} aria-label={`Move ${widget.title} later`}>
                  <ChevronDown size={11} />
                </button>
                <button type="button" className="icon-btn h-6 w-6 text-[var(--red)]" onClick={onRemove} aria-label={`Remove ${widget.title}`}>
                  <X size={11} />
                </button>
              </>
            ) : null}
          </>
        }
      />
      <div className="p-3">
        {widget.type === 'metric' ? (
          <div className="flex min-h-[120px] flex-col justify-between py-2">
            <div>
              <div className="label-micro">{widget.metricLabel ?? 'Composite indicator'}</div>
              <div className="data-value mt-3 text-[42px] leading-none text-[var(--text-bright)]">{widget.metricValue ?? '—'}</div>
              <div className="mt-2 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--green)]">stable · simulated feed</div>
            </div>
            <ProgressBar value={widgetValue(widget)} color="var(--cyan)" className="mt-4" />
          </div>
        ) : widget.type === 'radar' ? (
          <RadarView
            data={RADAR_METRICS}
            series={[
              { key: 'Meridian', label: 'Meridian', color: '#56e1ff' },
              { key: 'Foundry', label: 'Foundry', color: '#ff5d73' },
              { key: 'Tidal', label: 'Tidal', color: '#5ce1a4' },
            ]}
            height={chartHeight}
          />
        ) : widget.type === 'treemap' ? (
          <TreemapView items={MARKET_SECTORS} />
        ) : widget.type === 'sankey' ? (
          <SankeyView links={SUPPLY_CHAIN_LINKS} height={Math.max(220, chartHeight)} />
        ) : widget.type === 'heatmap' ? (
          <HeatmapView data={INCIDENT_HEATMAP} />
        ) : dataset ? (
          <SeriesChart
            dataset={widget.type === 'distribution' ? DATASETS.distribution : dataset}
            type={widget.type === 'area' ? 'area' : widget.type === 'bar' || widget.type === 'distribution' ? 'bar' : 'line'}
            height={chartHeight}
          />
        ) : (
          <div className="flex h-32 items-center justify-center text-[10px] text-[var(--muted-2)]">Dataset unavailable.</div>
        )}
      </div>
    </Panel>
  )
}

function CreateDashboardDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (name: string) => void
}) {
  const [name, setName] = useState('')
  if (!open) return null

  return (
    <div className="overlay-backdrop fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 pt-[8vh]" onClick={onClose}>
      <div className="panel w-full max-w-md" onClick={(event) => event.stopPropagation()}>
        <PanelHeader title="Create analytical workspace" eyebrow="Saved dashboard" icon={<LayoutDashboard size={13} />} action={<button type="button" className="icon-btn h-6 w-6" onClick={onClose} aria-label="Close"><X size={12} /></button>} />
        <div className="p-4">
          <label>
            <span className="label-micro">Workspace name</span>
            <input
              className="field mt-1.5 text-[11px]"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Tidal corridor watch"
              autoFocus
            />
          </label>
          <p className="mt-3 text-[9px] leading-relaxed text-[var(--muted-2)]">
            The new workspace starts empty. Add widgets from the library, arrange their width, then save the layout to local demo persistence.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (!name.trim()) return
                onCreate(name.trim())
                setName('')
              }}
            >
              <Plus size={11} /> Create workspace
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const dashboards = usePlatformStore((state) => state.dashboards)
  const createDashboard = usePlatformStore((state) => state.createDashboard)
  const saveDashboard = usePlatformStore((state) => state.saveDashboard)
  const deleteDashboard = usePlatformStore((state) => state.deleteDashboard)
  const pushToast = useUIStore((state) => state.pushToast)
  const canEdit = usePermission('analytics:edit')

  const [selectedId, setSelectedId] = useState(dashboards[0]?.id ?? '')
  const [draftWidgets, setDraftWidgets] = useState<DashboardWidget[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Dashboard | null>(null)

  const selected = dashboards.find((dashboard) => dashboard.id === selectedId) ?? dashboards[0]
  const widgets = draftWidgets ?? selected?.widgets ?? []
  const dirty = draftWidgets !== null

  const stats = useMemo(() => {
    const widgetCount = dashboards.reduce((sum, dashboard) => sum + dashboard.widgets.length, 0)
    const datasets = new Set(dashboards.flatMap((dashboard) => dashboard.widgets.map((widget) => widget.datasetId)))
    return { widgetCount, datasets: datasets.size }
  }, [dashboards])

  const setWidgets = (next: DashboardWidget[]) => {
    setDraftWidgets(next.map((widget, index) => ({ ...widget, y: index * 4 })))
  }

  const startEditing = () => {
    if (!canEdit) {
      pushToast({ title: 'Insufficient permission', message: 'Your role cannot edit analytical workspaces.', tone: 'danger' })
      return
    }
    setDraftWidgets(selected?.widgets ?? [])
    setEditing(true)
  }

  const discard = () => {
    setDraftWidgets(null)
    setEditing(false)
    setLibraryOpen(false)
  }

  const save = () => {
    if (!selected) return
    if (!canEdit) {
      pushToast({ title: 'Insufficient permission', message: 'Your role cannot save analytical workspaces.', tone: 'danger' })
      return
    }
    const result = saveDashboard({ ...selected, widgets })
    if (!result.ok) {
      pushToast({ title: 'Save rejected', message: result.message, tone: 'danger' })
      return
    }
    setDraftWidgets(null)
    setEditing(false)
    setLibraryOpen(false)
    pushToast({ title: 'Workspace saved', message: `${selected.name} layout persisted for this demo session.`, tone: 'success' })
  }

  const addWidget = (spec: WidgetSpec) => {
    if (!canEdit) {
      pushToast({ title: 'Insufficient permission', message: 'Your role cannot add widgets.', tone: 'danger' })
      return
    }
    if (!draftWidgets) setDraftWidgets(selected?.widgets ?? [])
    const base = draftWidgets ?? selected?.widgets ?? []
    const next: DashboardWidget = {
      id: uid('widget'),
      type: spec.type,
      title: spec.label,
      datasetId: spec.datasetId,
      metricLabel: spec.metricLabel,
      metricValue: spec.metricValue,
      x: 0,
      y: base.length * 4,
      w: defaultWidth(spec.type),
      h: defaultHeight(spec.type),
    }
    setWidgets([...base, next])
    setLibraryOpen(true)
    pushToast({ title: 'Widget appended', message: `${spec.label} is staged. Save the workspace to persist it.`, tone: 'info' })
  }

  const removeWidget = (id: string) => {
    setWidgets(widgets.filter((widget) => widget.id !== id))
  }

  const moveWidget = (id: string, direction: -1 | 1) => {
    const index = widgets.findIndex((widget) => widget.id === id)
    if (index < 0) return
    const target = index + direction
    if (target < 0 || target >= widgets.length) return
    const next = [...widgets]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    setWidgets(next)
  }

  const changeWidth = (id: string, width: number) => {
    setWidgets(widgets.map((widget) => (widget.id === id ? { ...widget, w: width } : widget)))
  }

  const handleCreate = (name: string) => {
    const result = createDashboard(name)
    if (!result.ok || !result.id) {
      pushToast({ title: 'Creation rejected', message: result.message, tone: 'danger' })
      return
    }
    setSelectedId(result.id)
    setDraftWidgets([])
    setEditing(true)
    setCreateOpen(false)
    pushToast({ title: 'Workspace created', message: `${name} is ready for widgets.`, tone: 'success' })
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    const result = deleteDashboard(deleteTarget.id)
    if (!result.ok) {
      pushToast({ title: 'Delete rejected', message: result.message, tone: 'danger' })
      return
    }
    if (deleteTarget.id === selectedId) {
      const fallback = dashboards.find((dashboard) => dashboard.id !== deleteTarget.id)
      setSelectedId(fallback?.id ?? '')
    }
    setDeleteTarget(null)
    setDraftWidgets(null)
    setEditing(false)
    pushToast({ title: 'Workspace removed', message: `${deleteTarget.name} deleted from local persistence.`, tone: 'success' })
  }

  const exportLayout = () => {
    if (!selected) return
    downloadFile(
      `${selected.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`,
      JSON.stringify({ ...selected, widgets }, null, 2),
      'application/json;charset=utf-8',
    )
  }

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        kicker="Analysis & knowledge // Analytics studio"
        title="Build the picture that matters."
        subtitle="Compose cross-domain dashboards from deterministic datasets, save analytical layouts and export the underlying records. No chart is randomized at render time."
        meta={
          <>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <LayoutGrid size={10} className="text-[var(--cyan)]" /> {dashboards.length} saved workspaces
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <Database size={10} className="text-[var(--violet)]" /> {stats.widgetCount} widgets · {stats.datasets} datasets
            </span>
            <span className="badge badge-amber">Simulated analytical data</span>
          </>
        }
        actions={
          <>
            <button type="button" className="btn" onClick={exportLayout} disabled={!selected}>
              <Download size={12} /> Export layout
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (!canEdit) {
                  pushToast({ title: 'Insufficient permission', message: 'Your role cannot create analytical workspaces.', tone: 'danger' })
                  return
                }
                setCreateOpen(true)
              }}
            >
              <Plus size={12} /> New workspace
            </button>
          </>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Saved workspaces', value: String(dashboards.length), detail: 'local demo persistence', color: 'var(--cyan)' },
          { label: 'Staged widgets', value: String(widgets.length), detail: dirty ? 'unsaved layout changes' : 'current layout committed', color: dirty ? 'var(--amber)' : 'var(--green)' },
          { label: 'Dataset coverage', value: String(stats.datasets), detail: 'distinct analytical sources', color: 'var(--violet)' },
          { label: 'Last updated', value: selected ? formatRelative(selected.updatedAt) : '—', detail: selected?.owner ?? 'no workspace selected', color: 'var(--blue)' },
        ].map((metric) => (
          <Panel key={metric.label} className="p-4">
            <div className="label-micro">{metric.label}</div>
            <div className="data-value mt-2 text-[26px]" style={{ color: metric.color }}>{metric.value}</div>
            <div className="mt-1 text-[9px] text-[var(--muted-2)]">{metric.detail}</div>
          </Panel>
        ))}
      </div>

      <Panel className="mb-3">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {dashboards.map((dashboard) => (
              <button
                key={dashboard.id}
                type="button"
                className={cn('btn btn-sm h-7 border-transparent bg-transparent px-2.5 text-[9px]', selected?.id === dashboard.id && 'border-[var(--cyan)]/30 bg-[var(--cyan-dim)] text-[var(--cyan)]')}
                onClick={() => {
                  if (dirty && !window.confirm('Discard unsaved layout changes?')) return
                  setSelectedId(dashboard.id)
                  setDraftWidgets(null)
                  setEditing(false)
                  setLibraryOpen(false)
                }}
              >
                {dashboard.name}
                <span className="font-mono text-[8px] text-[var(--muted-2)]">{String(dashboard.widgets.length).padStart(2, '0')}</span>
              </button>
            ))}
            {dashboards.length === 0 ? <span className="text-[10px] text-[var(--muted-2)]">No saved workspaces yet.</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {selected ? (
              <button
                type="button"
                className="icon-btn h-7 w-7 text-[var(--muted)] hover:text-[var(--red)]"
                onClick={() => setDeleteTarget(selected)}
                aria-label={`Delete ${selected.name}`}
                disabled={!canEdit}
                title={canEdit ? 'Delete workspace' : 'Edit permission required'}
              >
                <Trash2 size={12} />
              </button>
            ) : null}
            {editing ? (
              <>
                <button type="button" className="btn h-7" onClick={() => setLibraryOpen((open) => !open)}>
                  <Plus size={11} /> Widget library
                </button>
                <button type="button" className="btn h-7" onClick={discard}>
                  <RotateCcw size={11} /> Discard
                </button>
                <button type="button" className="btn btn-primary h-7" onClick={save} disabled={!dirty && !editing}>
                  <Save size={11} /> Save layout
                </button>
              </>
            ) : (
              <button type="button" className="btn h-7" onClick={startEditing} disabled={!selected || !canEdit}>
                <Pencil size={11} /> {canEdit ? 'Edit layout' : 'Read-only'}
              </button>
            )}
          </div>
        </div>
      </Panel>

      {libraryOpen && editing ? (
        <Panel className="mb-3">
          <PanelHeader
            title="Widget library"
            eyebrow="Deterministic analytical sources"
            icon={<Database size={13} />}
            action={<button type="button" className="icon-btn h-6 w-6" onClick={() => setLibraryOpen(false)} aria-label="Close widget library"><X size={11} /></button>}
          />
          <div className="grid max-h-[310px] gap-px overflow-y-auto bg-[var(--line)] sm:grid-cols-2 xl:grid-cols-3">
            {WIDGET_LIBRARY.map((spec) => (
              <button
                key={spec.datasetId}
                type="button"
                className="group bg-[rgba(8,13,19,0.94)] p-3 text-left transition-colors hover:bg-white/[0.035]"
                onClick={() => addWidget(spec)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10.5px] text-[var(--text-bright)]">{spec.label}</span>
                  <Plus size={11} className="flex-none text-[var(--muted-2)] transition-colors group-hover:text-[var(--cyan)]" />
                </div>
                <div className="mt-1.5 text-[9px] leading-relaxed text-[var(--muted-2)]">{spec.description}</div>
                <div className="mt-2 flex items-center gap-2 font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">
                  <span className="badge badge-muted">{titleCase(spec.type)}</span>
                  <span className="truncate">{spec.source}</span>
                </div>
              </button>
            ))}
          </div>
        </Panel>
      ) : null}

      {selected ? (
        <>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl tracking-[-0.03em] text-[var(--text-bright)]">{selected.name}</h2>
                {dirty ? <span className="badge badge-amber">Unsaved changes</span> : <span className="badge badge-green">Committed</span>}
                {!canEdit ? <span className="badge badge-muted">Read-only role</span> : null}
              </div>
              <p className="mt-1 max-w-2xl text-[10px] leading-relaxed text-[var(--muted)]">{selected.description}</p>
              <div className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--muted-2)]">
                Owner {selected.owner} · Updated {formatRelative(selected.updatedAt)} · {widgets.length} widgets
              </div>
            </div>
            {dirty ? (
              <button type="button" className="btn btn-sm" onClick={() => setDraftWidgets(null)}>
                <RotateCcw size={10} /> Revert staged changes
              </button>
            ) : null}
          </div>

          {widgets.length ? (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
              {widgets.map((widget) => (
                <DashboardWidgetCard
                  key={widget.id}
                  widget={widget}
                  dataset={datasetFor(widget)}
                  editing={editing}
                  canEdit={canEdit}
                  onChangeWidth={(width) => changeWidth(widget.id, width)}
                  onMove={(direction) => moveWidget(widget.id, direction)}
                  onRemove={() => removeWidget(widget.id)}
                />
              ))}
            </div>
          ) : (
            <Panel>
              <EmptyState
                icon={LayoutGrid}
                title="This workspace is empty"
                description="Open the widget library and append deterministic datasets. Each widget can be resized, reordered or removed before the layout is saved."
                action={
                  <button type="button" className="btn btn-primary" onClick={() => { if (!editing) startEditing(); setLibraryOpen(true) }}>
                    <Plus size={11} /> Add first widget
                  </button>
                }
              />
            </Panel>
          )}
        </>
      ) : (
        <Panel>
          <EmptyState
            icon={LayoutDashboard}
            title="No analytical workspace selected"
            description="Create a workspace to begin composing dashboards from the platform's deterministic datasets."
            action={<button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}><Plus size={11} /> New workspace</button>}
          />
        </Panel>
      )}

      <div className="mt-3 flex items-start gap-2 border border-[var(--line)] bg-white/[0.015] px-3 py-2.5">
        <Database size={11} className="mt-0.5 flex-none text-[var(--violet)]" />
        <p className="text-[9px] leading-relaxed text-[var(--muted-2)]">
          Dashboards, widget positions and saved layouts persist to versioned localStorage in demo mode. Charts are derived from fixed seeds and incident records; they do not represent live Aurelia telemetry. Production deployments should persist layouts through authenticated Supabase tables.
        </p>
      </div>

      <CreateDashboardDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreate} />

      {deleteTarget ? (
        <div className="overlay-backdrop fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[12vh]" onClick={() => setDeleteTarget(null)}>
          <div className="panel w-full max-w-sm" onClick={(event) => event.stopPropagation()}>
            <PanelHeader title="Delete workspace" eyebrow="Local persistence" icon={<Trash2 size={13} />} action={<button type="button" className="icon-btn h-6 w-6" onClick={() => setDeleteTarget(null)} aria-label="Close"><X size={12} /></button>} />
            <div className="p-4">
              <p className="text-[10.5px] leading-relaxed text-[var(--muted)]">
                Delete <span className="text-[var(--text-bright)]">{deleteTarget.name}</span> and its {deleteTarget.widgets.length} widget definitions? This action is audit-logged and cannot be undone.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className="btn" onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button type="button" className="btn btn-danger" onClick={handleDelete}><Trash2 size={11} /> Delete workspace</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="sr-only" aria-live="polite">
        {dirty ? 'Layout has unsaved changes.' : 'Layout is committed.'}
      </div>
    </div>
  )
}
