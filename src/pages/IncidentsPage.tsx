import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Download,
  Gauge,
  Plus,
  RadioTower,
  Search,
  ShieldAlert,
  Siren,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel, PanelHeader } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { IncidentStatusBadge, SeverityBadge } from '../components/ui/StatusBadge'
import { ACTIVE_INCIDENT_STATUSES, CATEGORY_LABELS, DISTRICTS, SEVERITY_LABELS } from '../data/constants'
import { formatRelative } from '../lib/format'
import { incidentDurationLabel } from '../lib/incidents'
import { csvFromRows, downloadFile } from '../lib/utils'
import { usePlatformStore } from '../store/usePlatformStore'
import { usePermission } from '../store/useSessionStore'
import { useUIStore } from '../store/useUIStore'
import type { IncidentCategory, IncidentSeverity } from '../types'

type StatusFilter = 'all' | 'active' | 'critical' | 'resolved'
type SortMode = 'impact' | 'recent' | 'severity'

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'All events' },
  { id: 'active', label: 'Active' },
  { id: 'critical', label: 'Critical' },
  { id: 'resolved', label: 'Closed' },
]

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS) as Array<[IncidentCategory, string]>
const SEVERITY_OPTIONS = Object.entries(SEVERITY_LABELS) as Array<[IncidentSeverity, string]>

export default function IncidentsPage() {
  const navigate = useNavigate()
  const incidents = usePlatformStore((state) => state.incidents)
  const entities = usePlatformStore((state) => state.entities)
  const createIncident = usePlatformStore((state) => state.createIncident)
  const pushToast = useUIStore((state) => state.pushToast)
  const canCreate = usePermission('incident:create')

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [severity, setSeverity] = useState<IncidentSeverity | 'all'>('all')
  const [category, setCategory] = useState<IncidentCategory | 'all'>('all')
  const [sort, setSort] = useState<SortMode>('impact')
  const [showCreate, setShowCreate] = useState(false)

  const [form, setForm] = useState({
    title: '',
    category: 'infrastructure_failure' as IncidentCategory,
    severity: 'high' as IncidentSeverity,
    districtId: 'dist-lumen',
    primaryEntityId: 'fac-lumen-grid',
    summary: '',
  })

  const active = incidents.filter((incident) => ACTIVE_INCIDENT_STATUSES.includes(incident.status))
  const critical = active.filter((incident) => incident.severity === 'critical')
  const resolved = incidents.filter((incident) => ['resolved', 'archived'].includes(incident.status))
  const meanImpact = Math.round(active.reduce((sum, incident) => sum + incident.impactScore, 0) / Math.max(1, active.length))
  const districtsInvolved = new Set(active.map((incident) => incident.districtId)).size

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return incidents
      .filter((incident) => {
        if (statusFilter === 'active' && !ACTIVE_INCIDENT_STATUSES.includes(incident.status)) return false
        if (statusFilter === 'critical' && (incident.severity !== 'critical' || !ACTIVE_INCIDENT_STATUSES.includes(incident.status))) return false
        if (statusFilter === 'resolved' && !['resolved', 'archived'].includes(incident.status)) return false
        if (severity !== 'all' && incident.severity !== severity) return false
        if (category !== 'all' && incident.category !== category) return false
        if (
          normalized &&
          !`${incident.reference} ${incident.title} ${incident.summary} ${incident.commander} ${incident.teams.join(' ')}`
            .toLowerCase()
            .includes(normalized)
        )
          return false
        return true
      })
      .sort((a, b) => {
        if (sort === 'recent') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        if (sort === 'severity') {
          const weight = { critical: 4, high: 3, moderate: 2, low: 1 }
          return weight[b.severity] - weight[a.severity] || b.impactScore - a.impactScore
        }
        return b.impactScore - a.impactScore
      })
  }, [category, incidents, query, severity, sort, statusFilter])

  const districtEntities = entities.filter((entity) => entity.districtId === form.districtId && ['facility', 'route', 'environmental'].includes(entity.kind))

  const openCreate = () => {
    if (!canCreate) {
      pushToast({ title: 'Insufficient permission', message: 'Your current role cannot open new incident records.', tone: 'danger' })
      return
    }
    setShowCreate(true)
  }

  const setDistrict = (districtId: string) => {
    const first = entities.find((entity) => entity.districtId === districtId && ['facility', 'route', 'environmental'].includes(entity.kind))
    setForm((current) => ({ ...current, districtId, primaryEntityId: first?.id ?? current.primaryEntityId }))
  }

  const submit = () => {
    if (!form.title.trim() || !form.summary.trim() || !form.primaryEntityId) {
      pushToast({ title: 'Incomplete record', message: 'Title, summary and primary entity are required.', tone: 'warning' })
      return
    }
    const result = createIncident({
      title: form.title.trim(),
      category: form.category,
      severity: form.severity,
      districtId: form.districtId,
      primaryEntityId: form.primaryEntityId,
      summary: form.summary.trim(),
    })
    if (!result.ok) {
      pushToast({ title: 'Incident not created', message: result.message, tone: 'danger' })
      return
    }
    pushToast({ title: 'Incident opened', message: result.message, tone: 'success' })
    setShowCreate(false)
    setForm({ title: '', category: 'infrastructure_failure', severity: 'high', districtId: 'dist-lumen', primaryEntityId: 'fac-lumen-grid', summary: '' })
    if (result.id) navigate(`/incidents/${result.id}`)
  }

  const exportLedger = () => {
    downloadFile(
      'aurelia-incident-ledger.csv',
      csvFromRows(
        filtered.map((incident) => ({
          reference: incident.reference,
          title: incident.title,
          category: incident.category,
          severity: incident.severity,
          status: incident.status,
          district: DISTRICTS.find((district) => district.id === incident.districtId)?.name ?? incident.districtId,
          commander: incident.commander,
          teams: incident.teams.join(' / '),
          impact: incident.impactScore,
          detected: incident.detectedAt,
          updated: incident.updatedAt,
        })),
      ),
    )
  }

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        kicker="Operations // Incident command"
        title="Every signal, one ledger."
        subtitle="Detection through resolution across the Aurelia operating theater. State transitions, assignments and evidence are recorded in a persistent command ledger."
        meta={
          <>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <RadioTower size={10} className="text-[var(--green)]" /> Ledger synchronized
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <CircleAlert size={10} className="text-[var(--red)]" /> {critical.length} critical
            </span>
            <span className="badge badge-amber">Persistent demo records</span>
          </>
        }
        actions={
          <>
            <button type="button" className="btn" onClick={exportLedger}>
              <Download size={12} /> Export ledger
            </button>
            <button type="button" className="btn btn-primary" onClick={openCreate} disabled={!canCreate} title={canCreate ? 'Open a new incident' : 'Requires incident:create permission'}>
              <Plus size={12} /> New incident
            </button>
          </>
        }
      />

      {!canCreate ? (
        <div className="mb-3 flex items-center gap-2 border border-[var(--amber)]/20 bg-[var(--amber-dim)] px-3 py-2 text-[9.5px] text-[var(--muted)]">
          <ShieldAlert size={12} className="flex-none text-[var(--amber)]" />
          This identity can read the command ledger but cannot create or advance incidents. Switch identity from the top bar to test command workflows.
        </div>
      ) : null}

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Active incidents', value: String(active.length), detail: `${critical.length} critical events`, color: 'var(--red)', icon: Siren },
          { label: 'Mean impact', value: `${meanImpact}/100`, detail: 'weighted across active records', color: 'var(--amber)', icon: Gauge },
          { label: 'Resolved / archived', value: String(resolved.length), detail: 'retained in command history', color: 'var(--green)', icon: CheckCircle2 },
          { label: 'Districts affected', value: String(districtsInvolved), detail: 'of 8 metropolitan districts', color: 'var(--cyan)', icon: RadioTower },
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

      <Panel>
        <PanelHeader
          title="Incident ledger"
          eyebrow="Filtered operational view"
          icon={<Siren size={13} />}
          action={<span className="font-mono text-[8px] text-[var(--muted-2)]">{filtered.length} / {incidents.length} records</span>}
        />
        <div className="border-b border-[var(--line)] px-3 pt-1">
          <div className="flex flex-wrap items-center gap-1">
            {STATUS_FILTERS.map((filter) => {
              const count =
                filter.id === 'all'
                  ? incidents.length
                  : filter.id === 'active'
                    ? active.length
                    : filter.id === 'critical'
                      ? critical.length
                      : resolved.length
              return (
                <button
                  key={filter.id}
                  type="button"
                  className="tab"
                  data-active={statusFilter === filter.id}
                  onClick={() => setStatusFilter(filter.id)}
                >
                  {filter.label}
                  <span className="font-mono text-[8px] text-[var(--muted-2)]">{String(count).padStart(2, '0')}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-2.5">
          <div className="relative min-w-[210px] flex-1">
            <Search size={11} className="absolute left-2.5 top-2.5 text-[var(--muted-2)]" />
            <input className="field h-8 min-h-0 pl-8 text-[10px]" placeholder="Search reference, title, commander or team…" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <select className="field h-8 min-h-0 w-auto text-[10px]" value={severity} onChange={(event) => setSeverity(event.target.value as IncidentSeverity | 'all')} aria-label="Filter severity">
            <option value="all">All severities</option>
            {SEVERITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="field h-8 min-h-0 w-auto text-[10px]" value={category} onChange={(event) => setCategory(event.target.value as IncidentCategory | 'all')} aria-label="Filter category">
            <option value="all">All categories</option>
            {CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="field h-8 min-h-0 w-auto text-[10px]" value={sort} onChange={(event) => setSort(event.target.value as SortMode)} aria-label="Sort incidents">
            <option value="impact">Sort by impact</option>
            <option value="recent">Sort by recency</option>
            <option value="severity">Sort by severity</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Incident</th>
                <th>Category</th>
                <th>District</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Command</th>
                <th>Impact</th>
                <th>Duration</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((incident) => (
                <tr key={incident.id} className="cursor-pointer" onClick={() => navigate(`/incidents/${incident.id}`)}>
                  <td>
                    <div className="font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{incident.reference}</div>
                    <div className="mt-0.5 max-w-[280px] truncate text-[10.5px] text-[var(--text-bright)]">{incident.title}</div>
                    <div className="mt-0.5 text-[8.5px] text-[var(--muted-2)]">{formatRelative(incident.updatedAt)}</div>
                  </td>
                  <td className="text-[9.5px] text-[var(--muted)]">{CATEGORY_LABELS[incident.category]}</td>
                  <td className="text-[9.5px] text-[var(--muted)]">{DISTRICTS.find((district) => district.id === incident.districtId)?.name ?? 'Theater'}</td>
                  <td><SeverityBadge severity={incident.severity} /></td>
                  <td><IncidentStatusBadge status={incident.status} /></td>
                  <td>
                    <div className="text-[9.5px] text-[var(--text)]">{incident.commander}</div>
                    <div className="mt-0.5 max-w-[150px] truncate font-mono text-[7.5px] uppercase tracking-[0.06em] text-[var(--muted-2)]">{incident.teams.join(' + ') || 'unassigned'}</div>
                  </td>
                  <td className="w-[110px]">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={incident.impactScore} color={incident.impactScore > 80 ? 'var(--red)' : incident.impactScore > 60 ? 'var(--amber)' : 'var(--cyan)'} className="w-14" />
                      <span className="font-mono text-[9px] text-[var(--muted)]">{incident.impactScore}</span>
                    </div>
                  </td>
                  <td className="font-mono text-[9px] text-[var(--muted)]">{incidentDurationLabel(incident.detectedAt, incident.resolvedAt)}</td>
                  <td>
                    <button type="button" className="icon-btn h-6 w-6" onClick={(event) => { event.stopPropagation(); navigate(`/incidents/${incident.id}`) }} aria-label={`Open ${incident.reference}`}>
                      <ChevronRight size={11} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? <div className="p-10 text-center text-[10px] text-[var(--muted-2)]">No incidents match the active filters.</div> : null}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] px-4 py-2.5">
          <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">
            Showing {filtered.length} records · {STATUS_FILTERS.find((filter) => filter.id === statusFilter)?.label}
          </span>
          <span className="font-mono text-[8px] text-[var(--muted-2)]">Persistent in local demo storage</span>
        </div>
      </Panel>

      {showCreate ? (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center">
          <div className="panel my-auto w-full max-w-2xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <div>
                <div className="label-micro">New command record</div>
                <h2 className="mt-1 font-display text-lg tracking-[-0.025em] text-[var(--text-bright)]">Open an incident</h2>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowCreate(false)} aria-label="Close incident form">
                <X size={15} />
              </button>
            </div>
            <div className="grid gap-3 p-4 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="label-micro">Incident title</span>
                <input className="field mt-1.5" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Describe the observed failure or hazard" />
              </label>
              <label>
                <span className="label-micro">Category</span>
                <select className="field mt-1.5" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as IncidentCategory })}>
                  {CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                <span className="label-micro">Severity</span>
                <select className="field mt-1.5" value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value as IncidentSeverity })}>
                  {SEVERITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                <span className="label-micro">District</span>
                <select className="field mt-1.5" value={form.districtId} onChange={(event) => setDistrict(event.target.value)}>
                  {DISTRICTS.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
                </select>
              </label>
              <label>
                <span className="label-micro">Primary entity</span>
                <select className="field mt-1.5" value={form.primaryEntityId} onChange={(event) => setForm({ ...form, primaryEntityId: event.target.value })}>
                  {districtEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
                  {districtEntities.length === 0 ? <option value="">No linked assets</option> : null}
                </select>
              </label>
              <label className="md:col-span-2">
                <span className="label-micro">Analyst summary</span>
                <textarea className="field mt-1.5 min-h-[92px] resize-y" value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} placeholder="What happened, what is affected, and what is the immediate risk?" />
              </label>
              <div className="md:col-span-2 border border-[var(--line)] bg-white/[0.015] p-3">
                <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">
                  <ShieldAlert size={11} className="text-[var(--amber)]" /> Record provenance
                </div>
                <p className="mt-1.5 text-[9px] leading-relaxed text-[var(--muted)]">
                  This action is client-gated and audit-logged in the demo. Production incidents are written through a server-side RPC protected by row-level security.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] px-4 py-3">
              <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">Initial state · detected</span>
              <div className="flex gap-2">
                <button type="button" className="btn" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={submit}>
                  <Plus size={11} /> Create incident
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
