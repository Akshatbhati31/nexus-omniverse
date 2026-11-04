import { useState } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Clock3,
  FileText,
  Gauge,
  MapPin,
  Paperclip,
  Send,
  ShieldAlert,
  Siren,
  UserRound,
  Users,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CityMap2D } from '../components/map/CityMap2D'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel, PanelHeader } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { EntityStatusBadge, IncidentStatusBadge, SeverityBadge } from '../components/ui/StatusBadge'
import { CATEGORY_LABELS, DISTRICTS, INCIDENT_STATUS_FLOW, STATUS_LABELS, TEAMS } from '../data/constants'
import { formatDateTime, formatRelative, titleCase } from '../lib/format'
import { incidentDurationLabel, nextIncidentStatuses } from '../lib/incidents'
import { cn } from '../lib/utils'
import { usePlatformStore } from '../store/usePlatformStore'
import { usePermission } from '../store/useSessionStore'
import { useUIStore } from '../store/useUIStore'
import type { Evidence, IncidentStatus } from '../types'

const TIMELINE_COLORS: Record<string, string> = {
  detected: 'var(--red)',
  status: 'var(--cyan)',
  assignment: 'var(--violet)',
  note: 'var(--amber)',
  evidence: 'var(--green)',
  escalation: 'var(--red)',
  resolution: 'var(--green)',
}

const EVIDENCE_KINDS: Array<Evidence['kind']> = ['telemetry', 'document', 'image', 'link']

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const incidents = usePlatformStore((state) => state.incidents)
  const entities = usePlatformStore((state) => state.entities)
  const transitionIncident = usePlatformStore((state) => state.transitionIncident)
  const assignIncident = usePlatformStore((state) => state.assignIncident)
  const addIncidentNote = usePlatformStore((state) => state.addIncidentNote)
  const addIncidentEvidence = usePlatformStore((state) => state.addIncidentEvidence)
  const setIncidentResolution = usePlatformStore((state) => state.setIncidentResolution)
  const pushToast = useUIStore((state) => state.pushToast)

  const canTransition = usePermission('incident:transition')
  const canAssign = usePermission('incident:assign')
  const canNote = usePermission('incident:note')
  const canEvidence = usePermission('incident:evidence')

  const [transitionNote, setTransitionNote] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [team, setTeam] = useState('')
  const [evidenceLabel, setEvidenceLabel] = useState('')
  const [evidenceReference, setEvidenceReference] = useState('')
  const [evidenceKind, setEvidenceKind] = useState<Evidence['kind']>('telemetry')
  const [resolutionDraft, setResolutionDraft] = useState('')

  const incident = incidents.find((item) => item.id === id)
  if (!incident) {
    return (
      <div className="p-4 lg:p-6">
        <Panel>
          <EmptyState
            icon={Siren}
            title="Incident record not found"
            description="The command ledger has no record with this identifier. It may have been created in a different demo session, or the link is malformed."
            action={
              <Link to="/incidents" className="btn btn-primary">
                <ArrowLeft size={12} /> Return to incident command
              </Link>
            }
          />
        </Panel>
      </div>
    )
  }

  const district = DISTRICTS.find((item) => item.id === incident.districtId)
  const primaryEntity = entities.find((entity) => entity.id === incident.primaryEntityId)
  const relatedEntities = incident.relatedEntityIds
    .map((entityId) => entities.find((entity) => entity.id === entityId))
    .filter((entity): entity is NonNullable<typeof entity> => Boolean(entity))
  const nextStatuses = nextIncidentStatuses(incident.status)
  const active = nextStatuses.length > 0
  const timeline = [...incident.timeline].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  const performTransition = (next: IncidentStatus) => {
    if (!canTransition) {
      pushToast({ title: 'Insufficient permission', message: 'Your role cannot advance incident state.', tone: 'danger' })
      return
    }
    if (next === 'resolved' && !transitionNote.trim()) {
      pushToast({ title: 'Resolution note required', message: 'Describe the stabilization and residual risk before resolving.', tone: 'warning' })
      return
    }
    const result = transitionIncident(incident.id, next, transitionNote.trim())
    if (!result.ok) {
      pushToast({ title: 'Transition rejected', message: result.message, tone: 'danger' })
      return
    }
    pushToast({ title: 'Incident advanced', message: result.message, tone: 'success' })
    setTransitionNote('')
  }

  const submitAssignment = () => {
    if (!team) {
      pushToast({ title: 'Select a team', message: 'Choose a response team before assigning.', tone: 'warning' })
      return
    }
    const result = assignIncident(incident.id, team)
    if (!result.ok) {
      pushToast({ title: 'Assignment failed', message: result.message, tone: 'danger' })
      return
    }
    pushToast({ title: 'Response assigned', message: result.message, tone: 'success' })
    setTeam('')
  }

  const submitNote = () => {
    if (!noteDraft.trim()) {
      pushToast({ title: 'Empty note', message: 'Write an observation before saving.', tone: 'warning' })
      return
    }
    const result = addIncidentNote(incident.id, noteDraft)
    if (!result.ok) {
      pushToast({ title: 'Note not saved', message: result.message, tone: 'danger' })
      return
    }
    pushToast({ title: 'Note added', message: result.message, tone: 'success' })
    setNoteDraft('')
  }

  const submitEvidence = () => {
    if (!evidenceLabel.trim() || !evidenceReference.trim()) {
      pushToast({ title: 'Incomplete evidence', message: 'A label and a reference are required.', tone: 'warning' })
      return
    }
    const result = addIncidentEvidence(incident.id, {
      label: evidenceLabel.trim(),
      kind: evidenceKind,
      reference: evidenceReference.trim(),
    })
    if (!result.ok) {
      pushToast({ title: 'Evidence not attached', message: result.message, tone: 'danger' })
      return
    }
    pushToast({ title: 'Evidence attached', message: result.message, tone: 'success' })
    setEvidenceLabel('')
    setEvidenceReference('')
  }

  const saveResolution = () => {
    if (!resolutionDraft.trim()) {
      pushToast({ title: 'Empty resolution', message: 'Write a resolution report before saving.', tone: 'warning' })
      return
    }
    const result = setIncidentResolution(incident.id, resolutionDraft.trim())
    if (!result.ok) {
      pushToast({ title: 'Resolution not saved', message: result.message, tone: 'danger' })
      return
    }
    pushToast({ title: 'Resolution saved', message: result.message, tone: 'success' })
    setResolutionDraft('')
  }

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        kicker={`Operations // Incident command // ${incident.reference}`}
        title={incident.title}
        subtitle={incident.summary}
        meta={
          <>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <MapPin size={10} className="text-[var(--cyan)]" /> {district?.name ?? 'Theater'}
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <Clock3 size={10} className="text-[var(--violet)]" /> {incidentDurationLabel(incident.detectedAt, incident.resolvedAt)} elapsed
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <Gauge size={10} className="text-[var(--amber)]" /> Impact {incident.impactScore}/100
            </span>
            <SeverityBadge severity={incident.severity} />
            <IncidentStatusBadge status={incident.status} />
          </>
        }
        actions={
          <>
            <button type="button" className="btn" onClick={() => navigate('/incidents')}>
              <ArrowLeft size={12} /> Ledger
            </button>
            {primaryEntity ? (
              <button type="button" className="btn btn-primary" onClick={() => navigate(`/entity/${primaryEntity.id}`)}>
                <ArrowUpRight size={12} /> Primary asset
              </button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-8">
          <Panel>
            <div className="grid grid-cols-2 gap-px bg-[var(--line)] md:grid-cols-4">
              {[
                { label: 'Category', value: CATEGORY_LABELS[incident.category], color: 'var(--cyan)' },
                { label: 'Confidence', value: `${incident.confidence}%`, color: 'var(--green)' },
                { label: 'Commander', value: incident.commander, color: 'var(--violet)' },
                { label: 'Detected', value: formatDateTime(incident.detectedAt), color: 'var(--muted)' },
              ].map((item) => (
                <div key={item.label} className="bg-[rgba(8,13,19,0.9)] px-4 py-3">
                  <div className="label-micro">{item.label}</div>
                  <div className="mt-1.5 truncate text-[11px] text-[var(--text-bright)]" style={{ color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="label-micro">Impact envelope</span>
                <span className="font-mono text-[9px] text-[var(--muted)]">{incident.impactScore} / 100</span>
              </div>
              <ProgressBar value={incident.impactScore} color={incident.impactScore > 80 ? 'var(--red)' : incident.impactScore > 60 ? 'var(--amber)' : 'var(--cyan)'} className="mt-2" />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="label-micro mr-1">Assigned elements</span>
                {incident.teams.length ? incident.teams.map((assigned) => <span key={assigned} className="badge badge-cyan">{assigned}</span>) : <span className="badge badge-muted">unassigned</span>}
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Command timeline" eyebrow="Detection through resolution" icon={<ClipboardList size={13} />} action={<span className="font-mono text-[8px] text-[var(--muted-2)]">{timeline.length} events</span>} />
            <div className="max-h-[480px] overflow-y-auto p-4">
              <div className="relative space-y-0">
                {timeline.map((entry, index) => (
                  <div key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
                    {index < timeline.length - 1 ? <span className="absolute left-[5px] top-3 h-full w-px bg-[var(--line)]" /> : null}
                    <span className="relative mt-1 h-[11px] w-[11px] flex-none border border-[var(--bg-1)]" style={{ background: TIMELINE_COLORS[entry.kind] ?? 'var(--muted)' }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10.5px] text-[var(--text-bright)]">{entry.title}</span>
                        {entry.from && entry.to ? (
                          <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">
                            {entry.from} → {entry.to}
                          </span>
                        ) : null}
                        <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{formatDateTime(entry.at)}</span>
                      </div>
                      <p className="mt-1 text-[9.5px] leading-relaxed text-[var(--muted)]">{entry.detail}</p>
                      {entry.actor ? <div className="mt-1 font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">actor · {entry.actor}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Investigation notes" eyebrow="Analyst ledger" icon={<FileText size={13} />} action={<span className="font-mono text-[8px] text-[var(--muted-2)]">{incident.notes.length} notes</span>} />
            <div className="divide-y divide-[var(--line)]">
              {incident.notes.map((note) => (
                <div key={note.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-[var(--text)]">{note.author}</span>
                    <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{formatDateTime(note.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--muted)]">{note.body}</p>
                </div>
              ))}
              {incident.notes.length === 0 ? <div className="px-4 py-6 text-center text-[10px] text-[var(--muted-2)]">No investigation notes have been recorded.</div> : null}
            </div>
            <div className="border-t border-[var(--line)] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="label-micro">Add investigation note</span>
                {!canNote ? <span className="badge badge-muted">read-only role</span> : null}
              </div>
              <textarea className="field mt-2 min-h-[70px] resize-y text-[11px]" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Record an observation, decision or dependency…" disabled={!canNote} />
              <div className="mt-2 flex justify-end">
                <button type="button" className="btn btn-primary" onClick={submitNote} disabled={!canNote}>
                  <Send size={11} /> Add note
                </button>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Evidence register" eyebrow="Attached records" icon={<Paperclip size={13} />} action={<span className="font-mono text-[8px] text-[var(--muted-2)]">{incident.evidence.length} items</span>} />
            <div className="divide-y divide-[var(--line)]">
              {incident.evidence.map((evidence) => (
                <div key={evidence.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="flex h-7 w-7 flex-none items-center justify-center border border-[var(--line)] text-[var(--cyan)]"><Paperclip size={12} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] text-[var(--text)]">{evidence.label}</div>
                    <div className="mt-0.5 font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{evidence.reference}</div>
                  </div>
                  <span className="badge badge-muted">{evidence.kind}</span>
                  <div className="text-right font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">
                    <div>{evidence.addedBy}</div>
                    <div className="mt-0.5">{formatRelative(evidence.addedAt)}</div>
                  </div>
                </div>
              ))}
              {incident.evidence.length === 0 ? <div className="px-4 py-6 text-center text-[10px] text-[var(--muted-2)]">No evidence has been attached.</div> : null}
            </div>
            <div className="border-t border-[var(--line)] p-4">
              <div className="grid gap-2 md:grid-cols-[1fr_140px_1fr_auto]">
                <input className="field h-8 min-h-0 text-[10px]" value={evidenceLabel} onChange={(event) => setEvidenceLabel(event.target.value)} placeholder="Evidence label" disabled={!canEvidence} />
                <select className="field h-8 min-h-0 text-[10px]" value={evidenceKind} onChange={(event) => setEvidenceKind(event.target.value as Evidence['kind'])} disabled={!canEvidence} aria-label="Evidence kind">
                  {EVIDENCE_KINDS.map((kind) => <option key={kind} value={kind}>{titleCase(kind)}</option>)}
                </select>
                <input className="field h-8 min-h-0 text-[10px]" value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} placeholder="Reference path or URL" disabled={!canEvidence} />
                <button type="button" className="btn h-8" onClick={submitEvidence} disabled={!canEvidence}>
                  <Paperclip size={11} /> Attach
                </button>
              </div>
              <p className="mt-2 text-[8.5px] text-[var(--muted-2)]">References are stored as metadata only. No file is uploaded in the demo environment.</p>
            </div>
          </Panel>
        </div>

        <div className="space-y-3 xl:col-span-4">
          <Panel>
            <PanelHeader title="Command workflow" eyebrow="Authorized transitions" icon={<Siren size={13} />} action={<IncidentStatusBadge status={incident.status} />} />
            <div className="p-4">
              <div className="flex items-center gap-1">
                {INCIDENT_STATUS_FLOW.map((status, index) => {
                  const currentIndex = INCIDENT_STATUS_FLOW.indexOf(incident.status)
                  const reached = index <= currentIndex
                  return (
                    <div key={status} className="flex flex-1 flex-col items-center gap-1">
                      <span className={cn('h-1.5 w-full', reached ? 'bg-[var(--cyan)]' : 'bg-[var(--line-strong)]')} />
                      <span className={cn('font-mono text-[6.5px] uppercase tracking-[0.04em]', reached ? 'text-[var(--cyan)]' : 'text-[var(--muted-2)]')}>{status.slice(0, 5)}</span>
                    </div>
                  )
                })}
              </div>

              {active ? (
                <>
                  <div className="mt-4">
                    <div className="label-micro">Transition note</div>
                    <textarea className="field mt-1.5 min-h-[74px] resize-y text-[10.5px]" value={transitionNote} onChange={(event) => setTransitionNote(event.target.value)} placeholder="Optional for most transitions; required to resolve." disabled={!canTransition} />
                  </div>
                  <div className="mt-3 space-y-2">
                    {nextStatuses.length ? nextStatuses.map((next) => (
                      <button key={next} type="button" className={cn('btn w-full', next === 'resolved' && 'btn-primary')} onClick={() => performTransition(next)} disabled={!canTransition}>
                        <CheckCircle2 size={11} /> Advance to {STATUS_LABELS[next]}
                      </button>
                    )) : <div className="border border-[var(--line)] px-3 py-2 text-center text-[9px] text-[var(--muted-2)]">No further transitions available.</div>}
                  </div>
                </>
              ) : (
                <div className="mt-4 border border-[var(--green)]/20 bg-[var(--green-dim)] p-3">
                  <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--green)]"><CheckCircle2 size={11} /> Record archived</div>
                  <p className="mt-1.5 text-[9.5px] leading-relaxed text-[var(--muted)]">{incident.resolution ?? 'This incident has been closed and retained in the command archive.'}</p>
                  <p className="mt-2 text-[8.5px] leading-relaxed text-[var(--muted-2)]">Archived records are immutable in this demonstration. The timeline, evidence register and resolution remain available for audit.</p>
                </div>
              )}

              {!canTransition ? (
                <div className="mt-3 flex items-start gap-2 border border-[var(--amber)]/20 bg-[var(--amber-dim)] p-2.5 text-[8.5px] leading-relaxed text-[var(--muted)]">
                  <ShieldAlert size={11} className="mt-0.5 flex-none text-[var(--amber)]" />
                  Your role is read-only for incident transitions.
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Response assignment" eyebrow="Teams and ownership" icon={<Users size={13} />} />
            <div className="p-4">
              <div className="space-y-2">
                {incident.teams.map((assigned) => {
                  const definition = TEAMS.find((item) => item.name === assigned)
                  return (
                    <div key={assigned} className="flex items-center justify-between gap-2 border border-[var(--line)] px-2.5 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-[9.5px] text-[var(--text)]">{assigned}</div>
                        <div className="mt-0.5 font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{definition?.discipline ?? 'response element'}</div>
                      </div>
                      <span className="badge badge-cyan">{definition?.status ?? 'assigned'}</span>
                    </div>
                  )
                })}
                {incident.teams.length === 0 ? <div className="border border-[var(--line)] px-3 py-2 text-center text-[9px] text-[var(--muted-2)]">No response element assigned.</div> : null}
              </div>
              <div className="mt-3 flex gap-2">
                <select className="field h-8 min-h-0 flex-1 text-[10px]" value={team} onChange={(event) => setTeam(event.target.value)} disabled={!canAssign} aria-label="Assign response team">
                  <option value="">Select response team…</option>
                  {TEAMS.map((candidate) => <option key={candidate.id} value={candidate.name}>{candidate.name} · {candidate.discipline}</option>)}
                </select>
                <button type="button" className="btn h-8" onClick={submitAssignment} disabled={!canAssign}>
                  <UserRound size={11} /> Assign
                </button>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Linked entities" eyebrow="Dependency context" icon={<CircleAlert size={13} />} />
            <div className="divide-y divide-[var(--line)]">
              {[primaryEntity, ...relatedEntities].filter((entity): entity is NonNullable<typeof entity> => Boolean(entity)).slice(0, 5).map((entity) => (
                <button key={entity.id} type="button" className="group flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.025]" onClick={() => navigate(`/entity/${entity.id}`)}>
                  <span className="h-1.5 w-1.5 flex-none" style={{ background: entity.status === 'degraded' ? 'var(--amber)' : entity.status === 'offline' ? 'var(--red)' : 'var(--green)' }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10px] text-[var(--text)]">{entity.name}</span>
                    <span className="mt-0.5 block font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{entity.code} · {entity.kind}</span>
                  </span>
                  <EntityStatusBadge status={entity.status} />
                  <ChevronRight size={10} className="text-[var(--muted-2)]" />
                </button>
              ))}
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHeader title="Geographic context" eyebrow="Incident location" icon={<MapPin size={13} />} />
            <div className="relative h-[220px]">
              <CityMap2D
                layers={new Set(['incidents', 'infrastructure', 'transport', 'energy'])}
                entities={entities}
                incidents={incidents}
                selectedEntityId={incident.primaryEntityId}
                onSelectEntity={(entityId) => navigate(`/entity/${entityId}`)}
                compact
              />
            </div>
            <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-2.5">
              <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">{district?.code ?? 'THEATER'} · {incident.map.x}/{incident.map.y}</span>
              <span className="font-mono text-[8px] text-[var(--muted-2)]">synthetic geometry</span>
            </div>
          </Panel>

          {incident.resolution || incident.status === 'resolved' || incident.status === 'archived' ? (
            <Panel>
              <PanelHeader title="Resolution report" eyebrow="Closure record" icon={<CheckCircle2 size={13} />} />
              <div className="p-4">
                <p className="text-[10px] leading-relaxed text-[var(--muted)]">{incident.resolution ?? 'No resolution report has been written.'}</p>
                {canTransition ? (
                  <>
                    <textarea className="field mt-3 min-h-[70px] resize-y text-[10.5px]" value={resolutionDraft} onChange={(event) => setResolutionDraft(event.target.value)} placeholder="Update the resolution report…" />
                    <button type="button" className="btn mt-2 w-full" onClick={saveResolution}>
                      <FileText size={11} /> Save resolution
                    </button>
                  </>
                ) : null}
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  )
}
