import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Calendar,
  ChevronRight,
  CircleAlert,
  Download,
  FileText,
  GitCompare,
  History,
  Search,
  Siren,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ChartFrame } from '../components/charts/ChartFrame'
import { SeriesChart } from '../components/charts/SeriesChart'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel, PanelHeader } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { SeverityBadge } from '../components/ui/StatusBadge'
import { ARCHIVE_EVENTS } from '../data/constants'
import { formatDate, formatRelative, titleCase } from '../lib/format'
import { cn, csvFromRows, downloadFile } from '../lib/utils'
import { usePlatformStore } from '../store/usePlatformStore'
import type { ChartDataset } from '../types'

const TYPE_COLORS: Record<string, string> = {
  energy: '#f3b85a',
  water: '#5ce1a4',
  mobility: '#56e1ff',
  incident: '#ff5d73',
  environment: '#8f7cff',
  infrastructure: '#5b8def',
  economy: '#c2a8ff',
}

function snapshotMetrics(event: (typeof ARCHIVE_EVENTS)[number]) {
  return {
    readiness: Number((92 - event.impact * 0.35).toFixed(1)),
    resilience: Number((88 - event.impact * 0.28).toFixed(1)),
    exposure: event.impact,
    continuity: Number((100 - event.impact * 0.22).toFixed(1)),
  }
}

export default function ArchivePage() {
  const navigate = useNavigate()
  const incidents = usePlatformStore((state) => state.incidents)
  const reports = usePlatformStore((state) => state.reports)
  const [query, setQuery] = useState('')
  const [type, setType] = useState<string>('all')
  const [selectedId, setSelectedId] = useState('evt-12')
  const [baselineId, setBaselineId] = useState('evt-01')
  const [compareId, setCompareId] = useState('evt-12')

  const types = Array.from(new Set(ARCHIVE_EVENTS.map((event) => event.type)))
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return [...ARCHIVE_EVENTS]
      .filter((event) => (type === 'all' || event.type === type) && (!normalized || `${event.title} ${event.description} ${event.type}`.toLowerCase().includes(normalized)))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [query, type])

  const selected = ARCHIVE_EVENTS.find((event) => event.id === selectedId) ?? filtered[0]
  const baseline = ARCHIVE_EVENTS.find((event) => event.id === baselineId)
  const comparison = ARCHIVE_EVENTS.find((event) => event.id === compareId)
  const closedIncidents = incidents.filter((incident) => ['resolved', 'archived'].includes(incident.status))
  const meanImpact = Math.round(ARCHIVE_EVENTS.reduce((sum, event) => sum + event.impact, 0) / ARCHIVE_EVENTS.length)
  const years = Array.from(new Set(ARCHIVE_EVENTS.map((event) => event.date.slice(0, 4)))).sort()

  const archiveDataset = useMemo<ChartDataset>(() => {
    const byYear = new Map<string, { impact: number; count: number }>()
    ARCHIVE_EVENTS.forEach((event) => {
      const year = event.date.slice(0, 4)
      const current = byYear.get(year) ?? { impact: 0, count: 0 }
      byYear.set(year, { impact: current.impact + event.impact, count: current.count + 1 })
    })
    return {
      id: 'archive_impact',
      title: 'Historical impact and resilience',
      source: 'Temporal archive · simulated historical record',
      unit: 'index',
      data: years.map((year) => {
        const value = byYear.get(year) ?? { impact: 0, count: 1 }
        const impact = Number((value.impact / Math.max(1, value.count)).toFixed(1))
        return {
          time: year,
          impact,
          readiness: Number((92 - impact * 0.35).toFixed(1)),
          resilience: Number((88 - impact * 0.28).toFixed(1)),
        }
      }),
      series: [
        { key: 'impact', label: 'Mean impact', color: '#ff5d73' },
        { key: 'readiness', label: 'Readiness', color: '#56e1ff' },
        { key: 'resilience', label: 'Resilience', color: '#5ce1a4' },
      ],
    }
  }, [years])

  const exportArchive = () => {
    downloadFile(
      'aurelia-temporal-archive.csv',
      csvFromRows(
        ARCHIVE_EVENTS.map((event) => ({
          date: event.date,
          title: event.title,
          type: event.type,
          impact: event.impact,
          description: event.description,
        })),
      ),
    )
  }

  const baselineMetrics = baseline ? snapshotMetrics(baseline) : null
  const comparisonMetrics = comparison ? snapshotMetrics(comparison) : null

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        kicker="Analysis & knowledge // Temporal archive"
        title="The city remembers."
        subtitle="Historical snapshots, infrastructure milestones and closed operational events. Compare how the theater’s modeled posture has shifted over time."
        meta={
          <>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <History size={10} className="text-[var(--violet)]" /> {ARCHIVE_EVENTS.length} archived events
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <Calendar size={10} className="text-[var(--cyan)]" /> {years[0]}–{years[years.length - 1]}
            </span>
            <span className="badge badge-amber">Synthetic historical record</span>
          </>
        }
        actions={
          <>
            <button type="button" className="btn" onClick={exportArchive}>
              <Download size={12} /> Export archive index
            </button>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/incidents')}>
              <Siren size={12} /> Current command
            </button>
          </>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Archive coverage', value: `${years.length} yrs`, detail: `${years[0]} to ${years[years.length - 1]}`, color: 'var(--violet)' },
          { label: 'Mean event impact', value: `${meanImpact}/100`, detail: 'across retained snapshots', color: 'var(--amber)' },
          { label: 'Closed incidents', value: String(closedIncidents.length), detail: 'resolved or archived in command', color: 'var(--green)' },
          { label: 'Published reports', value: String(reports.filter((report) => report.status === 'published').length), detail: 'available in the knowledge base', color: 'var(--cyan)' },
        ].map((metric) => (
          <Panel key={metric.label} className="p-4">
            <div className="label-micro">{metric.label}</div>
            <div className="data-value mt-2 text-[26px]" style={{ color: metric.color }}>{metric.value}</div>
            <div className="mt-1 text-[9px] text-[var(--muted-2)]">{metric.detail}</div>
          </Panel>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <ChartFrame
          title="Historical impact and resilience"
          source="Temporal archive · simulated historical record"
          dataset={archiveDataset}
          className="xl:col-span-7"
          footer={
            <div className="flex items-center justify-between">
              <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">Annual mean · derived from retained snapshots</span>
              <span className="font-mono text-[8px] text-[var(--muted-2)]">not a forecast</span>
            </div>
          }
        >
          <SeriesChart dataset={archiveDataset} type="line" height={252} />
        </ChartFrame>

        <Panel className="xl:col-span-5">
          <PanelHeader title="Snapshot comparison" eyebrow="Selected archive events" icon={<GitCompare size={13} />} />
          <div className="p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <label>
                <span className="label-micro">Baseline</span>
                <select className="field mt-1.5 text-[10px]" value={baselineId} onChange={(event) => setBaselineId(event.target.value)}>
                  {ARCHIVE_EVENTS.map((event) => <option key={event.id} value={event.id}>{event.date} · {event.title}</option>)}
                </select>
              </label>
              <label>
                <span className="label-micro">Comparison</span>
                <select className="field mt-1.5 text-[10px]" value={compareId} onChange={(event) => setCompareId(event.target.value)}>
                  {ARCHIVE_EVENTS.map((event) => <option key={event.id} value={event.id}>{event.date} · {event.title}</option>)}
                </select>
              </label>
            </div>
            {baselineMetrics && comparisonMetrics ? (
              <div className="mt-4 space-y-3">
                {[
                  { label: 'Readiness', key: 'readiness' as const },
                  { label: 'Resilience', key: 'resilience' as const },
                  { label: 'Exposure', key: 'exposure' as const },
                  { label: 'Continuity', key: 'continuity' as const },
                ].map((metric) => {
                  const delta = Number((comparisonMetrics[metric.key] - baselineMetrics[metric.key]).toFixed(1))
                  return (
                    <div key={metric.label}>
                      <div className="flex items-center justify-between gap-2 text-[9px]">
                        <span className="text-[var(--muted)]">{metric.label}</span>
                        <span className="font-mono text-[var(--muted-2)]">{baselineMetrics[metric.key]} → <span className="text-[var(--text-bright)]">{comparisonMetrics[metric.key]}</span> <span className={delta > 0 ? 'text-[var(--green)]' : delta < 0 ? 'text-[var(--red)]' : 'text-[var(--muted-2)]'}>{delta > 0 ? '+' : ''}{delta}</span></span>
                      </div>
                      <ProgressBar value={Math.max(0, Math.min(100, comparisonMetrics[metric.key]))} color={metric.key === 'exposure' ? 'var(--red)' : 'var(--cyan)'} className="mt-1.5" />
                    </div>
                  )
                })}
                <p className="border-t border-[var(--line)] pt-3 text-[8.5px] leading-relaxed text-[var(--muted-2)]">
                  Comparison metrics are deterministic derivatives of the retained event impact score. They are illustrative, not operational measurements.
                </p>
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel className="xl:col-span-5">
          <PanelHeader title="Archive timeline" eyebrow="Filtered historical events" icon={<History size={13} />} action={<span className="font-mono text-[8px] text-[var(--muted-2)]">{filtered.length} events</span>} />
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-2.5">
            <div className="relative min-w-[160px] flex-1">
              <Search size={11} className="absolute left-2.5 top-2.5 text-[var(--muted-2)]" />
              <input className="field h-8 min-h-0 pl-8 text-[10px]" placeholder="Search archive…" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <select className="field h-8 min-h-0 w-auto text-[10px]" value={type} onChange={(event) => setType(event.target.value)} aria-label="Filter archive type">
              <option value="all">All domains</option>
              {types.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
            </select>
          </div>
          <div className="max-h-[510px] overflow-y-auto">
            {filtered.map((event) => (
              <button
                key={event.id}
                type="button"
                className={cn('flex w-full items-start gap-3 border-b border-[var(--line)] px-4 py-3 text-left transition-colors last:border-0', selected?.id === event.id ? 'bg-white/[0.035]' : 'hover:bg-white/[0.02]')}
                onClick={() => setSelectedId(event.id)}
              >
                <span className="mt-1 h-1.5 w-1.5 flex-none" style={{ background: TYPE_COLORS[event.type] ?? 'var(--muted)' }} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{event.date}</span>
                    <span className="badge badge-muted">{event.type}</span>
                  </span>
                  <span className="mt-1 block text-[10.5px] text-[var(--text-bright)]">{event.title}</span>
                  <span className="mt-1 line-clamp-2 block text-[9px] leading-relaxed text-[var(--muted-2)]">{event.description}</span>
                </span>
                <ChevronRight size={11} className="mt-2 text-[var(--muted-2)]" />
              </button>
            ))}
            {filtered.length === 0 ? <div className="px-4 py-8 text-center text-[10px] text-[var(--muted-2)]">No archive events match the filter.</div> : null}
          </div>
        </Panel>

        <Panel className="xl:col-span-7">
          <PanelHeader title={selected?.title ?? 'Archive event'} eyebrow={selected ? `${formatDate(new Date(selected.date))} · ${titleCase(selected.type)}` : 'No selection'} icon={<FileText size={13} />} action={selected ? <span className="badge" style={{ color: TYPE_COLORS[selected.type], borderColor: `${TYPE_COLORS[selected.type]}44` }}>impact {selected.impact}</span> : null} />
          {selected ? (
            <div className="p-4">
              <p className="text-[10.5px] leading-relaxed text-[var(--muted)]">{selected.description}</p>
              <div className="mt-4 grid grid-cols-2 gap-px bg-[var(--line)] sm:grid-cols-4">
                {[
                  ['Readiness', `${snapshotMetrics(selected).readiness}`, 'var(--cyan)'],
                  ['Resilience', `${snapshotMetrics(selected).resilience}`, 'var(--green)'],
                  ['Exposure', `${snapshotMetrics(selected).exposure}`, 'var(--red)'],
                  ['Continuity', `${snapshotMetrics(selected).continuity}`, 'var(--violet)'],
                ].map(([label, value, color]) => (
                  <div key={label} className="bg-[rgba(8,13,19,0.9)] px-3 py-2.5">
                    <div className="label-micro">{label}</div>
                    <div className="data-value mt-1 text-[18px]" style={{ color }}>{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn" onClick={() => setBaselineId(selected.id)}>
                  Set as baseline
                </button>
                <button type="button" className="btn" onClick={() => setCompareId(selected.id)}>
                  Set as comparison
                </button>
                <button type="button" className="btn btn-primary" onClick={() => navigate('/geoint')}>
                  Open current twin <ArrowUpRight size={11} />
                </button>
              </div>
              <div className="mt-4 flex items-start gap-2 border border-[var(--line)] bg-white/[0.015] p-3">
                <CircleAlert size={12} className="mt-0.5 flex-none text-[var(--amber)]" />
                <p className="text-[9px] leading-relaxed text-[var(--muted)]">
                  Historical events and derived posture metrics are synthetic fixtures. They preserve the demonstration narrative but do not represent real Aurelia records.
                </p>
              </div>
            </div>
          ) : null}
        </Panel>

        <Panel className="xl:col-span-12">
          <PanelHeader title="Closed incident records" eyebrow="Command archive · retained resolutions" icon={<Siren size={13} />} action={<button type="button" className="btn btn-sm" onClick={() => navigate('/incidents')}>Open command ledger</button>} />
          <div className="grid gap-0 md:grid-cols-2">
            {closedIncidents.map((incident, index) => (
              <button
                key={incident.id}
                type="button"
                className={cn('group flex items-start gap-3 p-4 text-left transition-colors hover:bg-white/[0.025]', index < closedIncidents.length - 2 && 'border-b border-[var(--line)]', index % 2 === 0 && 'md:border-r md:border-[var(--line)]')}
                onClick={() => navigate(`/incidents/${incident.id}`)}
              >
                <SeverityBadge severity={incident.severity} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">{incident.reference}</span>
                    <span className="badge badge-green">{incident.status}</span>
                  </span>
                  <span className="mt-1 block text-[10.5px] text-[var(--text)]">{incident.title}</span>
                  <span className="mt-1 block text-[9px] leading-relaxed text-[var(--muted-2)]">{incident.resolution ?? 'Resolution retained in the command archive.'}</span>
                  <span className="mt-1.5 block font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{formatRelative(incident.updatedAt)} · {incident.teams.join(' + ') || 'no team'}</span>
                </span>
                <ChevronRight size={12} className="mt-2 text-[var(--muted-2)] transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
            {closedIncidents.length === 0 ? <div className="p-6 text-center text-[10px] text-[var(--muted-2)]">No closed incidents are retained in the current session.</div> : null}
          </div>
        </Panel>
      </div>
    </div>
  )
}
