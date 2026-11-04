import { useState } from 'react'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Lock,
  Pencil,
  Plus,
  Printer,
  Save,
  Send,
  Share2,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChartFrame } from '../components/charts/ChartFrame'
import { SeriesChart } from '../components/charts/SeriesChart'
import { EmptyState } from '../components/ui/EmptyState'
import { Panel, PanelHeader } from '../components/ui/Panel'
import { ReportStatusBadge } from '../components/ui/StatusBadge'
import { EntityStatusBadge } from '../components/ui/StatusBadge'
import { DATASETS, getDataset } from '../data/datasets'
import { formatDate, formatDateTime, formatRelative, initials, titleCase } from '../lib/format'
import { cn, downloadFile, uid } from '../lib/utils'
import { usePlatformStore } from '../store/usePlatformStore'
import { usePermission, useSessionStore } from '../store/useSessionStore'
import { useUIStore } from '../store/useUIStore'
import type { Entity, Report, ReportBlock, ReportBlockType, ReportStatus } from '../types'

const CLASSIFICATION_CLASS: Record<Report['classification'], string> = {
  internal: 'badge-cyan',
  restricted: 'badge-red',
  public: 'badge-green',
}

const BLOCK_TYPES: Array<{ type: ReportBlockType; label: string }> = [
  { type: 'heading', label: 'Heading' },
  { type: 'paragraph', label: 'Paragraph' },
  { type: 'note', label: 'Analyst note' },
  { type: 'chart', label: 'Chart' },
  { type: 'divider', label: 'Divider' },
]

function newBlock(type: ReportBlockType): ReportBlock {
  if (type === 'heading') return { id: uid('blk'), type, title: 'New section' }
  if (type === 'paragraph') return { id: uid('blk'), type, body: 'Draft the analytical assessment here.' }
  if (type === 'note') return { id: uid('blk'), type, title: 'Analyst note', body: 'Record a caveat or recommendation.' }
  if (type === 'chart') return { id: uid('blk'), type, title: 'Analytical chart', chartId: 'metro_load' }
  return { id: uid('blk'), type: 'divider' }
}

function ReportBlockView({
  block,
  editing,
  index,
  total,
  entities,
  onChange,
  onRemove,
  onMove,
}: {
  block: ReportBlock
  editing: boolean
  index: number
  total: number
  entities: Entity[]
  onChange: (patch: Partial<ReportBlock>) => void
  onRemove: () => void
  onMove: (direction: -1 | 1) => void
}) {
  const navigate = useNavigate()
  const dataset = block.chartId ? getDataset(block.chartId) : null
  const linkedEntities = (block.entityIds ?? [])
    .map((entityId) => entities.find((entity) => entity.id === entityId))
    .filter((entity): entity is Entity => Boolean(entity))

  return (
    <section id={block.id} className="scroll-mt-6 border-b border-[var(--line)] px-4 py-4 last:border-0 lg:px-6">
      {editing ? (
        <div className="mb-2.5 flex items-center gap-2">
          <span className="badge badge-muted">{titleCase(block.type)}</span>
          <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">Block {String(index + 1).padStart(2, '0')}</span>
          <span className="ml-auto flex items-center gap-1">
            <button type="button" className="icon-btn h-6 w-6" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move block up"><ChevronUp size={11} /></button>
            <button type="button" className="icon-btn h-6 w-6" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Move block down"><ChevronDown size={11} /></button>
            <button type="button" className="icon-btn h-6 w-6 text-[var(--red)]" onClick={onRemove} aria-label="Delete block"><Trash2 size={11} /></button>
          </span>
        </div>
      ) : null}

      {block.type === 'heading' ? (
        editing ? (
          <input className="field text-[16px] font-medium" value={block.title ?? ''} onChange={(event) => onChange({ title: event.target.value })} aria-label="Block heading" />
        ) : (
          <h2 className="font-display text-[19px] tracking-[-0.025em] text-[var(--text-bright)]">{block.title}</h2>
        )
      ) : null}

      {block.type === 'paragraph' ? (
        editing ? (
          <textarea className="field min-h-[110px] resize-y text-[11px] leading-relaxed" value={block.body ?? ''} onChange={(event) => onChange({ body: event.target.value })} aria-label="Paragraph body" />
        ) : (
          <p className="whitespace-pre-wrap text-[11px] leading-[1.8] text-[var(--text)]">{block.body}</p>
        )
      ) : null}

      {block.type === 'note' ? (
        <div className="border border-[var(--amber)]/25 bg-[var(--amber-dim)] p-3.5">
          <div className="flex items-center gap-2">
            <span className="label-micro text-[var(--amber)]">{block.title ?? 'Analyst note'}</span>
          </div>
          {editing ? (
            <>
              <input className="field mt-2 h-8 min-h-0 text-[10px]" value={block.title ?? ''} onChange={(event) => onChange({ title: event.target.value })} aria-label="Note title" />
              <textarea className="field mt-2 min-h-[78px] resize-y text-[10.5px]" value={block.body ?? ''} onChange={(event) => onChange({ body: event.target.value })} aria-label="Note body" />
            </>
          ) : (
            <p className="mt-1.5 whitespace-pre-wrap text-[10.5px] leading-relaxed text-[var(--muted)]">{block.body}</p>
          )}
        </div>
      ) : null}

      {block.type === 'chart' && dataset ? (
        <div>
          {editing ? (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <input className="field h-8 min-h-0 flex-1 text-[10px]" value={block.title ?? ''} onChange={(event) => onChange({ title: event.target.value })} aria-label="Chart title" />
              <select className="field h-8 min-h-0 w-auto text-[10px]" value={block.chartId ?? 'metro_load'} onChange={(event) => onChange({ chartId: event.target.value })} aria-label="Chart dataset">
                {Object.values(DATASETS).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </div>
          ) : null}
          <ChartFrame title={block.title ?? dataset.title} source={dataset.source} dataset={dataset}>
            <SeriesChart dataset={dataset} type={block.chartId === 'energy_demand' ? 'area' : 'line'} height={230} />
          </ChartFrame>
        </div>
      ) : null}

      {block.type === 'metrics' ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="font-display text-[14px] text-[var(--text-bright)]">{block.title ?? 'Metrics'}</h3>
            <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">Structured snapshot</span>
          </div>
          <div className="grid grid-cols-2 gap-px bg-[var(--line)] sm:grid-cols-4">
            {(block.metrics ?? []).map((metric) => (
              <div key={metric.label} className="bg-[rgba(8,13,19,0.92)] px-3 py-3">
                <div className="label-micro">{metric.label}</div>
                <div className="data-value mt-1.5 text-[19px] text-[var(--text-bright)]">{metric.value}</div>
                {metric.delta ? <div className="mt-1 font-mono text-[8px] text-[var(--green)]">{metric.delta}</div> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {block.type === 'entity' ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="font-display text-[14px] text-[var(--text-bright)]">{block.title ?? 'Referenced entities'}</h3>
            <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{linkedEntities.length} references</span>
          </div>
          <div className="divide-y divide-[var(--line)] border border-[var(--line)]">
            {linkedEntities.map((entity) => (
              <button key={entity.id} type="button" className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.025]" onClick={() => navigate(`/entity/${entity.id}`)}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10.5px] text-[var(--text)]">{entity.name}</span>
                  <span className="mt-0.5 block font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{entity.code} · {entity.kind}</span>
                </span>
                <EntityStatusBadge status={entity.status} />
              </button>
            ))}
            {linkedEntities.length === 0 ? <div className="px-3 py-4 text-center text-[9px] text-[var(--muted-2)]">No entity references resolve in the current dataset.</div> : null}
          </div>
        </div>
      ) : null}

      {block.type === 'table' && block.table ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="font-display text-[14px] text-[var(--text-bright)]">{block.title ?? 'Table'}</h3>
            <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{block.table.rows.length} rows</span>
          </div>
          <div className="overflow-x-auto border border-[var(--line)]">
            <table className="data-table">
              <thead>
                <tr>{block.table.columns.map((column) => <th key={column}>{column}</th>)}</tr>
              </thead>
              <tbody>
                {block.table.rows.map((row, rowIndex) => (
                  <tr key={`${row[0]}-${rowIndex}`}>
                    {row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {block.type === 'divider' ? <hr className="border-[var(--line)]" /> : null}
    </section>
  )
}

function reportMarkdown(report: Report) {
  const lines: string[] = [
    `# ${report.title}`,
    '',
    `**Template:** ${report.template}  `,
    `**Classification:** ${report.classification}  `,
    `**Status:** ${report.status}  `,
    `**Author:** ${report.author}`,
    '',
    report.summary,
    '',
  ]
  report.blocks.forEach((block) => {
    if (block.type === 'heading') lines.push(`## ${block.title ?? ''}`, '')
    if (block.type === 'paragraph') lines.push(block.body ?? '', '')
    if (block.type === 'note') lines.push(`> **${block.title ?? 'Note'}**`, `> ${(block.body ?? '').replaceAll('\n', '\n> ')}`, '')
    if (block.type === 'chart') lines.push(`*Chart: ${block.title ?? block.chartId ?? 'analytical chart'}*`, '')
    if (block.type === 'metrics' && block.metrics) {
      lines.push('| Metric | Value | Delta |', '| --- | --- | --- |')
      block.metrics.forEach((metric) => lines.push(`| ${metric.label} | ${metric.value} | ${metric.delta ?? '—'} |`))
      lines.push('')
    }
    if (block.type === 'entity' && block.entityIds) lines.push(`*Entity references: ${block.entityIds.join(', ')}*`, '')
    if (block.type === 'table' && block.table) {
      lines.push(`| ${block.table.columns.join(' | ')} |`, `| ${block.table.columns.map(() => '---').join(' | ')} |`)
      block.table.rows.forEach((row) => lines.push(`| ${row.join(' | ')} |`))
      lines.push('')
    }
    if (block.type === 'divider') lines.push('---', '')
  })
  lines.push('---', 'Generated from the NEXUS demonstration environment. Content is synthetic.')
  return lines.join('\n')
}

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const reports = usePlatformStore((state) => state.reports)
  const entities = usePlatformStore((state) => state.entities)
  const updateReport = usePlatformStore((state) => state.updateReport)
  const publishReport = usePlatformStore((state) => state.publishReport)
  const shareReport = usePlatformStore((state) => state.shareReport)
  const users = useSessionStore((state) => state.users)
  const pushToast = useUIStore((state) => state.pushToast)
  const canEdit = usePermission('report:edit')
  const canShare = usePermission('report:share')

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Report | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [recipient, setRecipient] = useState('')

  const report = reports.find((item) => item.id === id)
  const active = editing && draft ? draft : report
  const dirty = Boolean(editing && draft)

  if (!report || !active) {
    return (
      <div className="p-4 lg:p-6">
        <Panel>
          <EmptyState
            icon={FileText}
            title="Report not found"
            description="The knowledge base has no intelligence product with this identifier. It may belong to a different demo session, or the link is malformed."
            action={<Link to="/reports" className="btn btn-primary"><ArrowLeft size={12} /> Return to reports</Link>}
          />
        </Panel>
      </div>
    )
  }

  const startEdit = () => {
    if (!canEdit) {
      pushToast({ title: 'Insufficient permission', message: 'Your role cannot edit intelligence products.', tone: 'danger' })
      return
    }
    setDraft({ ...report, blocks: report.blocks.map((block) => ({ ...block })) })
    setEditing(true)
  }

  const cancelEdit = () => {
    setDraft(null)
    setEditing(false)
  }

  const commitDraft = () => {
    if (!draft) return true
    if (!draft.title.trim()) {
      pushToast({ title: 'Title required', message: 'The report must retain a title before saving.', tone: 'warning' })
      return false
    }
    const result = updateReport(report.id, {
      title: draft.title.trim(),
      summary: draft.summary,
      classification: draft.classification,
      status: draft.status,
      blocks: draft.blocks,
    })
    if (!result.ok) {
      pushToast({ title: 'Save rejected', message: result.message, tone: 'danger' })
      return false
    }
    setDraft(null)
    setEditing(false)
    pushToast({ title: 'Report saved', message: `${draft.title.trim()} updated.`, tone: 'success' })
    return true
  }

  const updateBlock = (blockId: string, patch: Partial<ReportBlock>) => {
    setDraft((current) =>
      current
        ? { ...current, blocks: current.blocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block)) }
        : current,
    )
  }

  const removeBlock = (blockId: string) => {
    setDraft((current) => (current ? { ...current, blocks: current.blocks.filter((block) => block.id !== blockId) } : current))
  }

  const moveBlock = (blockId: string, direction: -1 | 1) => {
    setDraft((current) => {
      if (!current) return current
      const index = current.blocks.findIndex((block) => block.id === blockId)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.blocks.length) return current
      const blocks = [...current.blocks]
      const [item] = blocks.splice(index, 1)
      blocks.splice(target, 0, item)
      return { ...current, blocks }
    })
  }

  const addBlock = (type: ReportBlockType) => {
    setDraft((current) => (current ? { ...current, blocks: [...current.blocks, newBlock(type)] } : current))
  }

  const setStatus = (status: ReportStatus) => {
    if (editing && draft) {
      const saved = commitDraft()
      if (!saved) return
    }
    const result = updateReport(report.id, { status })
    if (!result.ok) {
      pushToast({ title: 'Workflow rejected', message: result.message, tone: 'danger' })
      return
    }
    pushToast({ title: 'Report advanced', message: `Status changed to ${titleCase(status)}.`, tone: 'success' })
  }

  const publish = () => {
    if (editing && draft) {
      const saved = commitDraft()
      if (!saved) return
    }
    const result = publishReport(report.id)
    if (!result.ok) {
      pushToast({ title: 'Publish rejected', message: result.message, tone: 'danger' })
      return
    }
    pushToast({ title: 'Report published', message: `${report.title} is available to authorized recipients.`, tone: 'success' })
  }

  const exportMarkdown = () => {
    const slug = active.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'nexus-report'
    downloadFile(`${slug}.md`, reportMarkdown(active), 'text/markdown;charset=utf-8')
  }

  const submitShare = () => {
    if (!recipient) {
      pushToast({ title: 'Select a recipient', message: 'Choose a platform identity before sharing.', tone: 'warning' })
      return
    }
    const result = shareReport(report.id, recipient)
    if (!result.ok) {
      pushToast({ title: 'Share rejected', message: result.message, tone: 'danger' })
      return
    }
    pushToast({ title: 'Report shared', message: result.message, tone: 'success' })
    setRecipient('')
    setShareOpen(false)
  }

  const availableRecipients = users.filter((user) => !active.sharedWith.includes(user.name))
  const nextWorkflow =
    active.status === 'draft'
      ? { label: 'Submit for review', status: 'review' as ReportStatus, icon: Send }
      : active.status === 'review'
        ? { label: 'Publish report', status: 'published' as ReportStatus, icon: Check }
        : active.status === 'published'
          ? { label: 'Archive report', status: 'archived' as ReportStatus, icon: Lock }
          : null
  const WorkflowIcon = nextWorkflow?.icon

  return (
    <div className="p-4 lg:p-6">
      <header className="mb-5">
        <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">
          <Link to="/reports" className="flex items-center gap-1 text-[var(--muted)] hover:text-[var(--cyan)]"><ArrowLeft size={10} /> Reports</Link>
          <span>/</span>
          <span>{report.template}</span>
          <span>/</span>
          <span>{report.id}</span>
        </div>

        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            {editing ? (
              <input className="field font-display text-[24px] tracking-[-0.035em]" value={active.title} onChange={(event) => setDraft((current) => current ? { ...current, title: event.target.value } : current)} aria-label="Report title" />
            ) : (
              <h1 className="page-title">{active.title}</h1>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ReportStatusBadge status={active.status} />
              <span className={cn('badge', CLASSIFICATION_CLASS[active.classification])}>{active.classification}</span>
              {active.classification === 'restricted' ? <Lock size={10} className="text-[var(--red)]" /> : null}
              <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--muted-2)]">By {active.author}</span>
              <span className="h-1 w-1 bg-[var(--muted-2)]" />
              <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--muted-2)]">Updated {formatRelative(active.updatedAt)}</span>
              {dirty ? <span className="badge badge-amber">Unsaved edits</span> : null}
            </div>
            {editing ? (
              <textarea className="field mt-3 min-h-[70px] resize-y text-[11px] leading-relaxed" value={active.summary} onChange={(event) => setDraft((current) => current ? { ...current, summary: event.target.value } : current)} aria-label="Report summary" />
            ) : (
              <p className="page-subtitle mt-2 max-w-3xl">{active.summary || 'No summary has been recorded for this product.'}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn" onClick={exportMarkdown}><Download size={12} /> Markdown</button>
            <button type="button" className="btn" onClick={() => window.print()}><Printer size={12} /> Print</button>
            {canShare ? <button type="button" className="btn" onClick={() => setShareOpen(true)}><Share2 size={12} /> Share</button> : null}
            {editing ? (
              <>
                <button type="button" className="btn" onClick={cancelEdit}><X size={12} /> Cancel</button>
                <button type="button" className="btn btn-primary" onClick={commitDraft}><Save size={12} /> Save changes</button>
              </>
            ) : (
              <>
                {canEdit ? <button type="button" className="btn" onClick={startEdit}><Pencil size={12} /> Edit report</button> : null}
                {canEdit && nextWorkflow && WorkflowIcon ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => (nextWorkflow.status === 'published' ? publish() : setStatus(nextWorkflow.status))}
                  >
                    <WorkflowIcon size={12} /> {nextWorkflow.label}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-8">
          <Panel className="overflow-hidden">
            <PanelHeader
              title="Report body"
              eyebrow={editing ? 'Editing structured blocks' : 'Structured intelligence product'}
              icon={<FileText size={13} />}
              action={<span className="font-mono text-[8px] text-[var(--muted-2)]">{active.blocks.length} blocks</span>}
            />
            <div>
              {active.blocks.map((block, index) => (
                <ReportBlockView
                  key={block.id}
                  block={block}
                  editing={editing}
                  index={index}
                  total={active.blocks.length}
                  entities={entities}
                  onChange={(patch) => updateBlock(block.id, patch)}
                  onRemove={() => removeBlock(block.id)}
                  onMove={(direction) => moveBlock(block.id, direction)}
                />
              ))}
              {active.blocks.length === 0 ? <div className="px-6 py-10 text-center text-[10px] text-[var(--muted-2)]">This report has no content blocks yet.</div> : null}
            </div>
            {editing ? (
              <div className="border-t border-dashed border-[var(--line-strong)] bg-white/[0.012] p-4">
                <div className="label-micro">Append block</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {BLOCK_TYPES.map((item) => (
                    <button key={item.type} type="button" className="btn btn-sm" onClick={() => addBlock(item.type)}>
                      <Plus size={10} /> {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </Panel>
        </div>

        <div className="space-y-3 xl:col-span-4">
          <Panel>
            <PanelHeader title="Document control" eyebrow="Record metadata" icon={<FileText size={13} />} />
            <div className="divide-y divide-[var(--line)]">
              {[
                ['Template', active.template],
                ['Classification', titleCase(active.classification)],
                ['Status', titleCase(active.status)],
                ['Author', active.author],
                ['Created', formatDate(active.createdAt)],
                ['Updated', formatDateTime(active.updatedAt)],
                ['Blocks', String(active.blocks.length)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="label-micro">{label}</span>
                  <span className="text-right text-[10px] text-[var(--text)]">{value}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Recipients" eyebrow="Authorized sharing" icon={<Users size={13} />} action={canShare ? <button type="button" className="btn btn-sm h-6" onClick={() => setShareOpen(true)}><Share2 size={9} /> Share</button> : null} />
            <div className="divide-y divide-[var(--line)]">
              {active.sharedWith.map((person) => (
                <div key={person} className="flex items-center gap-2.5 px-4 py-2.5">
                  <span className="flex h-6 w-6 items-center justify-center border border-[var(--line)] bg-white/[0.03] font-mono text-[7.5px] text-[var(--muted)]">{initials(person)}</span>
                  <span className="min-w-0 flex-1 truncate text-[10px] text-[var(--text)]">{person}</span>
                  <Check size={10} className="text-[var(--green)]" />
                </div>
              ))}
              {active.sharedWith.length === 0 ? <div className="px-4 py-6 text-center text-[9px] text-[var(--muted-2)]">Not shared with any identity.</div> : null}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Block index" eyebrow="Document structure" icon={<FileText size={13} />} />
            <div className="max-h-[260px] overflow-y-auto">
              {active.blocks.map((block, index) => (
                <a key={block.id} href={`#${block.id}`} className="flex items-center gap-2.5 border-b border-[var(--line)] px-4 py-2.5 last:border-0 hover:bg-white/[0.025]">
                  <span className="font-mono text-[8px] text-[var(--muted-2)]">{String(index + 1).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10px] text-[var(--text)]">{block.title ?? (block.type === 'paragraph' ? (block.body ?? 'Paragraph').slice(0, 48) : titleCase(block.type))}</span>
                    <span className="mt-0.5 block font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{block.type}</span>
                  </span>
                </a>
              ))}
            </div>
          </Panel>

          {!canEdit ? (
            <div className="flex items-start gap-2 border border-[var(--amber)]/20 bg-[var(--amber-dim)] p-3">
              <Lock size={11} className="mt-0.5 flex-none text-[var(--amber)]" />
              <p className="text-[9px] leading-relaxed text-[var(--muted)]">Your role can read this product but cannot edit, publish or alter its classification. Production enforcement is server-side.</p>
            </div>
          ) : null}

          <div className="border border-[var(--line)] bg-white/[0.015] p-3">
            <div className="flex items-center gap-2">
              <Lock size={11} className="text-[var(--violet)]" />
              <span className="label-micro">Demonstration boundary</span>
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-[var(--muted-2)]">
              Report bodies are synthetic. Sharing stores recipient names locally and generates an audit record. Production should enforce classification through RLS and immutable revision history.
            </p>
          </div>
        </div>
      </div>

      {shareOpen ? (
        <div className="overlay-backdrop fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[12vh]" onClick={() => setShareOpen(false)}>
          <div className="panel w-full max-w-md" onClick={(event) => event.stopPropagation()}>
            <PanelHeader title="Share report" eyebrow="Authorized recipients" icon={<Share2 size={13} />} action={<button type="button" className="icon-btn h-6 w-6" onClick={() => setShareOpen(false)} aria-label="Close"><X size={12} /></button>} />
            <div className="p-4">
              <label>
                <span className="label-micro">Platform identity</span>
                <select className="field mt-1.5 text-[10px]" value={recipient} onChange={(event) => setRecipient(event.target.value)}>
                  <option value="">Select a recipient…</option>
                  {availableRecipients.map((user) => <option key={user.id} value={user.name}>{user.name} · {user.title}</option>)}
                </select>
              </label>
              {availableRecipients.length === 0 ? <p className="mt-2 text-[9px] text-[var(--muted-2)]">All active demo identities already have access.</p> : null}
              <p className="mt-3 text-[9px] leading-relaxed text-[var(--muted-2)]">Sharing is recorded in the audit log and generates a workspace notification. It does not transmit the report outside this demo environment.</p>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className="btn" onClick={() => setShareOpen(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={submitShare}><Share2 size={11} /> Share</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
