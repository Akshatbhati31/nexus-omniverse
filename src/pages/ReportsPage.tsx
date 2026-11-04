import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  ChevronRight,
  Download,
  FileText,
  Lock,
  Plus,
  Search,
  Send,
  Users,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel, PanelHeader } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { ReportStatusBadge } from '../components/ui/StatusBadge'
import { formatDate, formatRelative, initials, titleCase } from '../lib/format'
import { cn, csvFromRows, downloadFile } from '../lib/utils'
import { usePlatformStore } from '../store/usePlatformStore'
import { usePermission } from '../store/useSessionStore'
import { useUIStore } from '../store/useUIStore'
import type { Report, ReportStatus } from '../types'

type StatusFilter = 'all' | ReportStatus
type SortMode = 'updated' | 'created' | 'title'

const STATUS_TABS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'All products' },
  { id: 'draft', label: 'Drafts' },
  { id: 'review', label: 'In review' },
  { id: 'published', label: 'Published' },
  { id: 'archived', label: 'Archived' },
]

const TEMPLATES = [
  'Daily intelligence brief',
  'Environmental assessment',
  'Infrastructure review',
  'Incident after-action',
  'Simulation brief',
]

const CLASSIFICATION_CLASS: Record<Report['classification'], string> = {
  internal: 'badge-cyan',
  restricted: 'badge-red',
  public: 'badge-green',
}

export default function ReportsPage() {
  const navigate = useNavigate()
  const reports = usePlatformStore((state) => state.reports)
  const createReport = usePlatformStore((state) => state.createReport)
  const updateReport = usePlatformStore((state) => state.updateReport)
  const pushToast = useUIStore((state) => state.pushToast)
  const canCreate = usePermission('report:create')
  const canEdit = usePermission('report:edit')

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [classification, setClassification] = useState<Report['classification'] | 'all'>('all')
  const [sort, setSort] = useState<SortMode>('updated')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    template: TEMPLATES[0],
    classification: 'internal' as Report['classification'],
    summary: '',
  })

  const counts = useMemo(
    () => ({
      all: reports.length,
      draft: reports.filter((report) => report.status === 'draft').length,
      review: reports.filter((report) => report.status === 'review').length,
      published: reports.filter((report) => report.status === 'published').length,
      archived: reports.filter((report) => report.status === 'archived').length,
    }),
    [reports],
  )

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return [...reports]
      .filter((report) => {
        if (status !== 'all' && report.status !== status) return false
        if (classification !== 'all' && report.classification !== classification) return false
        if (!normalized) return true
        return `${report.title} ${report.summary} ${report.author} ${report.template} ${report.sharedWith.join(' ')}`.toLowerCase().includes(normalized)
      })
      .sort((a, b) => {
        if (sort === 'title') return a.title.localeCompare(b.title)
        if (sort === 'created') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      })
  }, [classification, query, reports, sort, status])

  const openCreate = () => {
    if (!canCreate) {
      pushToast({ title: 'Insufficient permission', message: 'Your role cannot create intelligence products.', tone: 'danger' })
      return
    }
    setCreateOpen(true)
  }

  const submitCreate = () => {
    if (!form.title.trim()) {
      pushToast({ title: 'Title required', message: 'Give the report a working title before creating it.', tone: 'warning' })
      return
    }
    const created = createReport(form.template)
    if (!created.ok || !created.id) {
      pushToast({ title: 'Creation rejected', message: created.message, tone: 'danger' })
      return
    }
    if (canEdit) {
      const updated = updateReport(created.id, {
        title: form.title.trim(),
        classification: form.classification,
        summary: form.summary.trim(),
      })
      if (!updated.ok) {
        pushToast({ title: 'Report created with defaults', message: updated.message, tone: 'warning' })
      }
    }
    setCreateOpen(false)
    setForm({ title: '', template: TEMPLATES[0], classification: 'internal', summary: '' })
    pushToast({ title: 'Report created', message: `${form.title.trim()} is ready for editing.`, tone: 'success' })
    navigate(`/reports/${created.id}`)
  }

  const exportIndex = () => {
    downloadFile(
      'aurelia-report-index.csv',
      csvFromRows(
        reports.map((report) => ({
          title: report.title,
          template: report.template,
          classification: report.classification,
          status: report.status,
          author: report.author,
          blocks: report.blocks.length,
          shared_with: report.sharedWith.join('; '),
          updated: report.updatedAt,
        })),
      ),
    )
  }

  const pipeline = (['draft', 'review', 'published', 'archived'] as ReportStatus[]).map((statusId) => ({
    id: statusId,
    count: counts[statusId],
    ratio: (counts[statusId] / Math.max(1, reports.length)) * 100,
    color: statusId === 'published' ? 'var(--green)' : statusId === 'review' ? 'var(--amber)' : statusId === 'draft' ? 'var(--cyan)' : 'var(--muted)',
  }))

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        kicker="Analysis & knowledge // Reports"
        title="Intelligence that survives the meeting."
        subtitle="Draft, review and publish analytical products assembled from platform evidence. Every report is a structured record, not a static document."
        meta={
          <>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <FileText size={10} className="text-[var(--cyan)]" /> {reports.length} intelligence products
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <Users size={10} className="text-[var(--violet)]" /> {reports.reduce((sum, report) => sum + report.sharedWith.length, 0)} sharing edges
            </span>
            <span className="badge badge-amber">Demonstration records</span>
          </>
        }
        actions={
          <>
            <button type="button" className="btn" onClick={exportIndex}>
              <Download size={12} /> Export index
            </button>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <Plus size={12} /> New report
            </button>
          </>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total products', value: String(counts.all), detail: 'across all editorial states', color: 'var(--cyan)' },
          { label: 'In review', value: String(counts.review), detail: 'awaiting editorial sign-off', color: 'var(--amber)' },
          { label: 'Published', value: String(counts.published), detail: 'available to authorized recipients', color: 'var(--green)' },
          { label: 'Restricted', value: String(reports.filter((report) => report.classification === 'restricted').length), detail: 'classification-limited records', color: 'var(--red)' },
        ].map((metric) => (
          <Panel key={metric.label} className="p-4">
            <div className="label-micro">{metric.label}</div>
            <div className="data-value mt-2 text-[26px]" style={{ color: metric.color }}>{metric.value}</div>
            <div className="mt-1 text-[9px] text-[var(--muted-2)]">{metric.detail}</div>
          </Panel>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-8">
          <Panel>
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-2.5">
              <div className="relative min-w-[180px] flex-1">
                <Search size={11} className="absolute left-2.5 top-2.5 text-[var(--muted-2)]" />
                <input className="field h-8 min-h-0 pl-8 text-[10px]" placeholder="Search title, author, summary…" value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
              <select className="field h-8 min-h-0 w-auto text-[10px]" value={classification} onChange={(event) => setClassification(event.target.value as Report['classification'] | 'all')} aria-label="Filter classification">
                <option value="all">All classifications</option>
                <option value="internal">Internal</option>
                <option value="restricted">Restricted</option>
                <option value="public">Public</option>
              </select>
              <select className="field h-8 min-h-0 w-auto text-[10px]" value={sort} onChange={(event) => setSort(event.target.value as SortMode)} aria-label="Sort reports">
                <option value="updated">Recently updated</option>
                <option value="created">Newest created</option>
                <option value="title">Title A–Z</option>
              </select>
            </div>
            <div className="flex overflow-x-auto border-b border-[var(--line)]" role="tablist" aria-label="Report status">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={status === tab.id}
                  className="tab"
                  data-active={status === tab.id}
                  onClick={() => setStatus(tab.id)}
                >
                  {tab.label}
                  <span className="font-mono text-[9px] text-[var(--muted-2)]">{String(counts[tab.id]).padStart(2, '0')}</span>
                </button>
              ))}
            </div>

            {filtered.length ? (
              <div className="grid gap-0 md:grid-cols-2">
                {filtered.map((report, index) => (
                  <article
                    key={report.id}
                    className={cn(
                      'group flex min-w-0 flex-col p-4 transition-colors hover:bg-white/[0.022]',
                      index < filtered.length - (filtered.length % 2 === 0 ? 2 : 1) && 'border-b border-[var(--line)]',
                      index % 2 === 0 && 'md:border-r md:border-[var(--line)]',
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <ReportStatusBadge status={report.status} />
                      <span className={cn('badge', CLASSIFICATION_CLASS[report.classification])}>{report.classification}</span>
                      {report.classification === 'restricted' ? <Lock size={10} className="text-[var(--red)]" /> : null}
                      <span className="ml-auto font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{formatRelative(report.updatedAt)}</span>
                    </div>
                    <button type="button" className="mt-3 text-left" onClick={() => navigate(`/reports/${report.id}`)}>
                      <h2 className="font-display text-[17px] leading-tight tracking-[-0.025em] text-[var(--text-bright)] transition-colors group-hover:text-white">{report.title}</h2>
                    </button>
                    <p className="mt-2 line-clamp-3 text-[10px] leading-relaxed text-[var(--muted)]">{report.summary || 'No summary has been recorded for this draft.'}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">
                      <span>{report.template}</span>
                      <span className="h-1 w-1 bg-[var(--muted-2)]" />
                      <span>{report.blocks.length} blocks</span>
                      <span className="h-1 w-1 bg-[var(--muted-2)]" />
                      <span>By {report.author}</span>
                    </div>
                    <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                      <div className="flex items-center gap-1">
                        {report.sharedWith.slice(0, 3).map((person) => (
                          <span key={person} className="flex h-5 w-5 items-center justify-center border border-[var(--line)] bg-white/[0.03] font-mono text-[7px] text-[var(--muted)]" title={`Shared with ${person}`}>
                            {initials(person)}
                          </span>
                        ))}
                        {report.sharedWith.length > 3 ? <span className="font-mono text-[8px] text-[var(--muted-2)]">+{report.sharedWith.length - 3}</span> : null}
                        {report.sharedWith.length === 0 ? <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">Not shared</span> : null}
                      </div>
                      <button type="button" className="btn btn-sm h-7" onClick={() => navigate(`/reports/${report.id}`)}>
                        Open <ArrowUpRight size={10} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FileText}
                title="No reports match the filter"
                description="Change the search, status or classification filter, or create a new intelligence product."
                action={<button type="button" className="btn btn-primary" onClick={openCreate}><Plus size={11} /> New report</button>}
              />
            )}
          </Panel>
        </div>

        <div className="space-y-3 xl:col-span-4">
          <Panel>
            <PanelHeader title="Editorial pipeline" eyebrow="Product state distribution" icon={<Send size={13} />} />
            <div className="space-y-3 p-4">
              {pipeline.map((stage) => (
                <div key={stage.id}>
                  <div className="flex items-center justify-between gap-2">
                    <button type="button" className="text-[10px] text-[var(--text)] hover:text-[var(--cyan)]" onClick={() => setStatus(stage.id)}>{titleCase(stage.id)}</button>
                    <span className="font-mono text-[9px] text-[var(--muted-2)]">{stage.count}</span>
                  </div>
                  <ProgressBar value={stage.ratio} color={stage.color} className="mt-1.5" />
                </div>
              ))}
              <p className="border-t border-[var(--line)] pt-3 text-[9px] leading-relaxed text-[var(--muted-2)]">
                Publishing is permission-gated and generates a workspace notification. Shared recipients are recorded as names in the demo environment.
              </p>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Report templates" eyebrow="Structured starting points" icon={<FileText size={13} />} />
            <div className="divide-y divide-[var(--line)]">
              {TEMPLATES.map((template) => {
                const count = reports.filter((report) => report.template === template).length
                return (
                  <button
                    key={template}
                    type="button"
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-white/[0.025]"
                    onClick={() => {
                      if (!canCreate) {
                        pushToast({ title: 'Insufficient permission', message: 'Your role cannot create intelligence products.', tone: 'danger' })
                        return
                      }
                      setForm((current) => ({ ...current, template }))
                      setCreateOpen(true)
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10px] text-[var(--text)]">{template}</span>
                      <span className="mt-0.5 block font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{count} existing</span>
                    </span>
                    <ChevronRight size={10} className="text-[var(--muted-2)]" />
                  </button>
                )
              })}
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-center gap-2">
              <Lock size={12} className="text-[var(--amber)]" />
              <span className="label-micro">Classification boundary</span>
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-[var(--muted)]">
              Restricted products are marked for demonstration only. In production, report access and sharing are enforced by Supabase RLS using role and classification predicates; the client never receives unauthorized report bodies.
            </p>
            <div className="mt-3 border-t border-[var(--line)] pt-2.5 font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--muted-2)]">
              Last product update · {reports.length ? formatDate(Math.max(...reports.map((report) => new Date(report.updatedAt).getTime()))) : '—'}
            </div>
          </Panel>
        </div>
      </div>

      {createOpen ? (
        <div className="overlay-backdrop fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 pt-[7vh]" onClick={() => setCreateOpen(false)}>
          <div className="panel w-full max-w-lg" onClick={(event) => event.stopPropagation()}>
            <PanelHeader
              title="Create intelligence product"
              eyebrow="New report"
              icon={<FileText size={13} />}
              action={<button type="button" className="icon-btn h-6 w-6" onClick={() => setCreateOpen(false)} aria-label="Close"><X size={12} /></button>}
            />
            <div className="space-y-3 p-4">
              <label>
                <span className="label-micro">Working title</span>
                <input className="field mt-1.5 text-[11px]" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Tidal corridor after-action" autoFocus />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="label-micro">Template</span>
                  <select className="field mt-1.5 text-[10px]" value={form.template} onChange={(event) => setForm((current) => ({ ...current, template: event.target.value }))}>
                    {TEMPLATES.map((template) => <option key={template} value={template}>{template}</option>)}
                  </select>
                </label>
                <label>
                  <span className="label-micro">Classification</span>
                  <select className="field mt-1.5 text-[10px]" value={form.classification} onChange={(event) => setForm((current) => ({ ...current, classification: event.target.value as Report['classification'] }))}>
                    <option value="internal">Internal</option>
                    <option value="restricted">Restricted</option>
                    <option value="public">Public</option>
                  </select>
                </label>
              </div>
              <label>
                <span className="label-micro">Summary</span>
                <textarea className="field mt-1.5 min-h-[90px] resize-y text-[10.5px]" value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} placeholder="State the assessment in two or three sentences." />
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" className="btn" onClick={() => setCreateOpen(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={submitCreate}><Plus size={11} /> Create and edit</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
