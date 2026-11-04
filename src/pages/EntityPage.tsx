import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  Download,
  FileText,
  GitBranch,
  MapPin,
  MessageSquare,
  Network,
  Plus,
  ShieldAlert,
  Siren,
  Tag,
} from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CityMap2D } from '../components/map/CityMap2D'
import { Breadcrumbs, type Crumb } from '../components/layout/Breadcrumbs'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel, PanelHeader } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { EntityStatusBadge, IncidentStatusBadge, SeverityBadge } from '../components/ui/StatusBadge'
import { DISTRICTS } from '../data/constants'
import { getEntityKindLabel } from '../data/entities'
import { getDomain, getWorkspaceById } from '../data/workspaces'
import { formatDateTime, formatMetric, formatRelative, titleCase } from '../lib/format'
import { cn, downloadFile } from '../lib/utils'
import { usePlatformStore } from '../store/usePlatformStore'
import { usePermission } from '../store/useSessionStore'
import { useUIStore } from '../store/useUIStore'
import type { CityLayer, Entity } from '../types'

const TIMELINE_COLORS: Record<string, string> = {
  system: 'var(--cyan)',
  incident: 'var(--red)',
  maintenance: 'var(--violet)',
  economic: 'var(--amber)',
  environmental: 'var(--green)',
  observation: 'var(--blue)',
}

function mapLayers(entity: Entity): Set<CityLayer> {
  if (entity.kind === 'city') return new Set(['transport', 'energy', 'water', 'environment', 'population', 'infrastructure', 'incidents', 'economy'])
  if (entity.kind === 'district') return new Set(['transport', 'population', 'infrastructure', 'incidents'])
  if (entity.kind === 'route') return new Set(['transport', 'incidents'])
  if (entity.kind === 'economic') return new Set(['economy', 'infrastructure'])
  if (entity.kind === 'environmental') return new Set(['environment', 'water'])
  if (entity.kind === 'organization') return new Set(['economy', 'infrastructure'])
  if (entity.kind === 'landmark') return new Set(['population', 'infrastructure'])
  return new Set(['infrastructure', 'energy', 'water', 'environment'])
}

function vitalDisplay(value: number, format?: 'number' | 'percent' | 'currency' | 'decimal') {
  if (format === 'percent') return `${value.toFixed(1)}%`
  if (format === 'currency') return `$${value.toLocaleString()}`
  if (format === 'decimal') return value.toFixed(1)
  return formatMetric(value, format)
}

export default function EntityPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const entities = usePlatformStore((state) => state.entities)
  const incidents = usePlatformStore((state) => state.incidents)
  const addEntityNote = usePlatformStore((state) => state.addEntityNote)
  const pushToast = useUIStore((state) => state.pushToast)
  const canNote = usePermission('entity:note')
  const [noteDraft, setNoteDraft] = useState('')

  const entity = entities.find((item) => item.id === id)
  const relations = useMemo(
    () =>
      entity
        ? entity.relations
            .map((relation) => ({ relation, target: entities.find((candidate) => candidate.id === relation.targetId) }))
            .filter((item): item is { relation: Entity['relations'][number]; target: Entity } => Boolean(item.target))
            .sort((a, b) => b.relation.strength - a.relation.strength)
        : [],
    [entities, entity],
  )
  const children = useMemo(
    () => (entity ? entities.filter((candidate) => candidate.parentId === entity.id).sort((a, b) => a.kind.localeCompare(b.kind)) : []),
    [entities, entity],
  )
  const linkedIncidents = useMemo(
    () =>
      entity
        ? incidents
            .filter((incident) => incident.primaryEntityId === entity.id || incident.relatedEntityIds.includes(entity.id))
            .sort((a, b) => {
              const activeA = !['resolved', 'archived'].includes(a.status) ? 1 : 0
              const activeB = !['resolved', 'archived'].includes(b.status) ? 1 : 0
              return activeB - activeA || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            })
        : [],
    [entity, incidents],
  )

  if (!entity) {
    return (
      <div className="p-4 lg:p-6">
        <Panel>
          <EmptyState
            icon={Network}
            title="Entity record not found"
            description="The platform graph has no entity with this identifier. It may have been created in another demo session, or the link is malformed."
            action={<Link to="/geoint" className="btn btn-primary"><ArrowLeft size={12} /> Return to geographic intelligence</Link>}
          />
        </Panel>
      </div>
    )
  }

  const from = searchParams.get('from') ?? ''
  const workspaceId = searchParams.get('workspace') ?? ''
  const districtParam = searchParams.get('district') ?? ''
  const originWorkspace = getWorkspaceById(workspaceId)
  const originDomain = originWorkspace ? getDomain(originWorkspace.domain) : getDomain(from)
  const contextDistrictId = districtParam || entity.districtId
  const originDistrict = DISTRICTS.find((candidate) => candidate.id === contextDistrictId)
  const contextParams = new URLSearchParams()
  if (from) contextParams.set('from', from)
  if (workspaceId) contextParams.set('workspace', workspaceId)
  if (contextDistrictId) contextParams.set('district', contextDistrictId)
  const contextQuery = contextParams.toString()
  const withContext = (path: string) => (contextQuery ? `${path}?${contextQuery}` : path)
  const incidentParams = new URLSearchParams(contextQuery)
  incidentParams.set('entity', entity.id)
  const incidentHref = (incidentId: string) => `/incidents/${incidentId}?${incidentParams.toString()}`
  const networkParams = new URLSearchParams(contextQuery)
  networkParams.set('focus', entity.id)
  const networkHref = `/network?${networkParams.toString()}`
  const twinHref = contextDistrictId ? `/geoint/district/${contextDistrictId}?entity=${entity.id}` : '/geoint'
  const originHref =
    originWorkspace && originDomain
      ? `${originDomain.path}/workspace/${originWorkspace.id}${contextDistrictId ? `?district=${contextDistrictId}` : ''}`
      : from === 'geoint' && contextDistrictId
        ? `/geoint/district/${contextDistrictId}`
        : from === 'overview' && contextDistrictId
          ? `/overview/district/${contextDistrictId}`
          : from === 'geoint'
            ? '/geoint'
            : from === 'overview'
              ? '/overview'
              : undefined
  const originLabel = originWorkspace
    ? `${originDomain?.shortLabel ?? 'Domain'} · ${originWorkspace.label}`
    : from === 'geoint' && originDistrict
      ? `GeoInt · ${originDistrict.name}`
      : from === 'overview' && originDistrict
        ? `Overview · ${originDistrict.name}`
        : from === 'geoint'
          ? 'Geographic intelligence'
          : from === 'overview'
            ? 'Global overview'
            : undefined
  const breadcrumbItems: Crumb[] = [{ label: 'Global overview', to: '/overview' }]
  if (originWorkspace && originDomain) {
    breadcrumbItems.push({ label: originDomain.shortLabel, to: originDomain.path })
    breadcrumbItems.push({ label: originWorkspace.label, to: `${originDomain.path}/workspace/${originWorkspace.id}` })
  } else if (from === 'geoint') {
    breadcrumbItems.push({ label: 'Geographic intelligence', to: '/geoint' })
    if (contextDistrictId) breadcrumbItems.push({ label: originDistrict?.name ?? 'Regional workspace', to: `/geoint/district/${contextDistrictId}` })
  } else if (from === 'overview' && contextDistrictId) {
    breadcrumbItems.push({ label: originDistrict?.name ?? 'Regional workspace', to: `/overview/district/${contextDistrictId}` })
  }
  breadcrumbItems.push({ label: entity.name })

  const district = DISTRICTS.find((candidate) => candidate.id === entity.districtId)
  const parent = entities.find((candidate) => candidate.id === entity.parentId)
  const timeline = [...entity.timeline].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  const notes = [...entity.notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const exportDossier = () => {
    downloadFile(
      `${entity.code.toLowerCase()}-dossier.json`,
      JSON.stringify({ entity, relations: relations.map(({ relation, target }) => ({ ...relation, target: target.code })), linkedIncidents: linkedIncidents.map((incident) => incident.reference) }, null, 2),
      'application/json;charset=utf-8',
    )
  }

  const submitNote = () => {
    if (!noteDraft.trim()) {
      pushToast({ title: 'Empty annotation', message: 'Write an observation before saving.', tone: 'warning' })
      return
    }
    const result = addEntityNote(entity.id, noteDraft)
    if (!result.ok) {
      pushToast({ title: 'Annotation rejected', message: result.message, tone: 'danger' })
      return
    }
    pushToast({ title: 'Annotation saved', message: 'The entity timeline has been updated.', tone: 'success' })
    setNoteDraft('')
  }

  return (
    <div className="p-4 lg:p-6">
      <Breadcrumbs items={breadcrumbItems} />
      <PageHeader
        kicker={`Entity dossier // ${getEntityKindLabel(entity.kind)}`}
        title={entity.name}
        subtitle={entity.description}
        meta={
          <>
            <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">{entity.code}</span>
            <EntityStatusBadge status={entity.status} />
            <span className={cn('badge', entity.criticality === 'critical' ? 'badge-red' : entity.criticality === 'high' ? 'badge-amber' : 'badge-muted')}>{entity.criticality} criticality</span>
            <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{district?.name ?? 'Aurelia Theater'}</span>
            <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--muted-2)]">Updated {formatRelative(entity.updatedAt)}</span>
          </>
        }
        actions={
          <>
            <button type="button" className="btn" onClick={exportDossier}><Download size={12} /> Export dossier</button>
            <button type="button" className="btn btn-primary" onClick={() => navigate(twinHref)}><MapPin size={12} /> Open in twin</button>
          </>
        }
      />

      {originHref && originLabel ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border border-[var(--line)] bg-[rgba(86,225,255,0.025)] px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <ArrowLeft size={11} className="flex-none text-[var(--cyan)]" />
            <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">Opened from</span>
            <Link to={originHref} className="truncate font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--cyan)] transition-colors hover:text-[var(--cyan-soft)]">
              {originLabel}
            </Link>
          </div>
          <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">Context preserved across the dossier</span>
        </div>
      ) : null}

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {entity.vitals.slice(0, 4).map((vital, index) => (
          <Panel key={vital.label} className="p-4">
            <div className="label-micro">{vital.label}</div>
            <div className="data-value mt-2 text-[25px]" style={{ color: ['var(--cyan)', 'var(--green)', 'var(--amber)', 'var(--violet)'][index] ?? 'var(--cyan)' }}>
              {vitalDisplay(vital.value, vital.format)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[9px] text-[var(--muted-2)]">
              <span>{vital.format === 'percent' || vital.format === 'currency' ? 'modeled indicator' : vital.unit}</span>
              <span className={vital.delta >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}>{vital.delta >= 0 ? '+' : ''}{vital.delta}</span>
            </div>
          </Panel>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-8">
          <Panel>
            <PanelHeader title="Operating profile" eyebrow="Recorded attributes" icon={<FileText size={13} />} />
            <div className="grid gap-px bg-[var(--line)] sm:grid-cols-2">
              {Object.entries(entity.attributes).map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 bg-[rgba(8,13,19,0.92)] px-4 py-3">
                  <span className="label-micro">{label}</span>
                  <span className="text-right text-[10px] text-[var(--text)]">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] px-4 py-3">
              <Tag size={11} className="text-[var(--violet)]" />
              {entity.tags.map((tag) => <span key={tag} className="badge badge-muted">{tag}</span>)}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Relationship graph"
              eyebrow="Typed dependencies and ownership"
              icon={<GitBranch size={13} />}
              action={<button type="button" className="btn btn-sm h-6" onClick={() => navigate(networkHref)}><Network size={9} /> Open graph</button>}
            />
            <div className="divide-y divide-[var(--line)]">
              {relations.map(({ relation, target }) => (
                <button
                  key={`${target.id}-${relation.type}`}
                  type="button"
                  className="group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.025]"
                  onClick={() => navigate(withContext(`/entity/${target.id}`))}
                >
                  <span className="h-1.5 w-1.5 flex-none bg-[var(--cyan)]" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[10.5px] text-[var(--text)]">{target.name}</span>
                      <span className="badge badge-muted">{titleCase(relation.type)}</span>
                    </span>
                    <span className="mt-0.5 block font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{target.code} · {getEntityKindLabel(target.kind)}</span>
                    <ProgressBar value={relation.strength * 100} color="var(--cyan)" className="mt-2 max-w-[220px]" />
                  </span>
                  <span className="font-mono text-[8px] text-[var(--muted-2)]">{Math.round(relation.strength * 100)}%</span>
                  <EntityStatusBadge status={target.status} />
                  <ArrowUpRight size={11} className="text-[var(--muted-2)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </button>
              ))}
              {relations.length === 0 ? <div className="px-4 py-8 text-center text-[9px] text-[var(--muted-2)]">No relations are recorded for this entity.</div> : null}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Entity timeline" eyebrow="Retained observations and system events" icon={<Calendar size={13} />} action={<span className="font-mono text-[8px] text-[var(--muted-2)]">{timeline.length} events</span>} />
            <div className="max-h-[420px] overflow-y-auto p-4">
              <div className="relative space-y-4 before:absolute before:bottom-1 before:left-[3px] before:top-1 before:w-px before:bg-[var(--line-strong)]">
                {timeline.map((event) => (
                  <div key={event.id} className="relative pl-5">
                    <span className="absolute left-0 top-1.5 h-1.5 w-1.5" style={{ background: TIMELINE_COLORS[event.kind] ?? 'var(--muted)' }} />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10.5px] text-[var(--text)]">{event.title}</span>
                      <span className="badge badge-muted">{event.kind}</span>
                    </div>
                    <p className="mt-1 text-[9.5px] leading-relaxed text-[var(--muted)]">{event.detail}</p>
                    <div className="mt-1 font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{formatDateTime(event.at)}</div>
                  </div>
                ))}
                {timeline.length === 0 ? <div className="pl-5 text-[9px] text-[var(--muted-2)]">No timeline events are retained.</div> : null}
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Annotations" eyebrow="Analyst observations" icon={<MessageSquare size={13} />} action={<span className="font-mono text-[8px] text-[var(--muted-2)]">{notes.length} notes</span>} />
            <div className="divide-y divide-[var(--line)]">
              {notes.map((note) => (
                <div key={note.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-[var(--text-bright)]">{note.author}</span>
                    <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{formatRelative(note.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-[10px] leading-relaxed text-[var(--muted)]">{note.body}</p>
                </div>
              ))}
              {notes.length === 0 ? <div className="px-4 py-6 text-center text-[9px] text-[var(--muted-2)]">No analyst annotations recorded.</div> : null}
            </div>
            <div className="border-t border-[var(--line)] p-4">
              <label>
                <span className="label-micro">New annotation</span>
                <textarea
                  className="field mt-1.5 min-h-[78px] resize-y text-[10.5px]"
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  placeholder="Record an observation, caveat or follow-up action."
                  disabled={!canNote}
                />
              </label>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[8px] text-[var(--muted-2)]">Annotations are audit-logged and persist locally in demo mode.</span>
                <button type="button" className="btn btn-primary btn-sm" onClick={submitNote} disabled={!canNote}><Plus size={10} /> Save annotation</button>
              </div>
              {!canNote ? (
                <div className="mt-2 flex items-start gap-2 border border-[var(--amber)]/20 bg-[var(--amber-dim)] p-2.5 text-[8.5px] leading-relaxed text-[var(--muted)]">
                  <ShieldAlert size={11} className="mt-0.5 flex-none text-[var(--amber)]" />
                  Your role has read-only access to entity annotations.
                </div>
              ) : null}
            </div>
          </Panel>
        </div>

        <div className="space-y-3 xl:col-span-4">
          <Panel>
            <PanelHeader title="Navigation context" eyebrow="Preserved origin" icon={<GitBranch size={13} />} />
            <div className="p-4">
              <div className="space-y-1.5">
                {breadcrumbItems.slice(0, -1).map((item, index) => (
                  <div key={`${item.label}-${index}`} className="flex items-center gap-1.5">
                    <span className="font-mono text-[7px] text-[var(--muted-2)]">{String(index + 1).padStart(2, '0')}</span>
                    {item.to ? (
                      <Link to={item.to} className="truncate text-[9px] text-[var(--muted)] transition-colors hover:text-[var(--cyan)]">{item.label}</Link>
                    ) : (
                      <span className="truncate text-[9px] text-[var(--muted-2)]">{item.label}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-col gap-1.5">
                {originHref && originLabel ? (
                  <Link to={originHref} className="btn btn-sm justify-start"><ArrowLeft size={10} /> Return to {originLabel}</Link>
                ) : null}
                {contextDistrictId ? (
                  <Link to={`/geoint/district/${contextDistrictId}`} className="btn btn-sm justify-start"><MapPin size={10} /> Open district workspace</Link>
                ) : null}
              </div>
              <p className="mt-3 text-[8.5px] leading-relaxed text-[var(--muted-2)]">
                Dependency, child and incident links keep this origin trail attached to the route, so the dossier remains part of the same investigation.
              </p>
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHeader title="Geographic context" eyebrow={district?.name ?? 'Aurelia Theater'} icon={<MapPin size={13} />} />
            <div className="relative h-[250px]">
              <CityMap2D
                layers={mapLayers(entity)}
                entities={entities}
                incidents={incidents}
                selectedEntityId={entity.id}
                onSelectEntity={(entityId) => navigate(withContext(`/entity/${entityId}`))}
                compact
              />
            </div>
            <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-2.5">
              <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{entity.location ? `${entity.location.lat.toFixed(4)}, ${entity.location.lng.toFixed(4)}` : 'Theater geometry'}</span>
              <span className="font-mono text-[8px] text-[var(--muted-2)]">synthetic</span>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Linked incidents" eyebrow="Operational exposure" icon={<Siren size={13} />} action={<span className="badge badge-muted">{linkedIncidents.length}</span>} />
            <div className="max-h-[290px] overflow-y-auto divide-y divide-[var(--line)]">
              {linkedIncidents.map((incident) => (
                <button key={incident.id} type="button" className="flex w-full items-start gap-2.5 px-4 py-3 text-left hover:bg-white/[0.025]" onClick={() => navigate(incidentHref(incident.id))}>
                  <SeverityBadge severity={incident.severity} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] text-[var(--text)]">{incident.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{incident.reference}</span>
                      <IncidentStatusBadge status={incident.status} />
                    </span>
                  </span>
                </button>
              ))}
              {linkedIncidents.length === 0 ? <div className="px-4 py-6 text-center text-[9px] text-[var(--muted-2)]">No incidents reference this entity.</div> : null}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Contained entities" eyebrow="Direct graph children" icon={<Network size={13} />} action={<span className="badge badge-muted">{children.length}</span>} />
            <div className="max-h-[250px] overflow-y-auto divide-y divide-[var(--line)]">
              {children.map((child) => (
                <button key={child.id} type="button" className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-white/[0.025]" onClick={() => navigate(withContext(`/entity/${child.id}`))}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10px] text-[var(--text)]">{child.name}</span>
                    <span className="mt-0.5 block font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{child.code} · {getEntityKindLabel(child.kind)}</span>
                  </span>
                  <EntityStatusBadge status={child.status} />
                </button>
              ))}
              {children.length === 0 ? <div className="px-4 py-6 text-center text-[9px] text-[var(--muted-2)]">No direct children recorded.</div> : null}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Record control" eyebrow="Dossier metadata" icon={<FileText size={13} />} />
            <div className="divide-y divide-[var(--line)]">
              {[
                ['Entity code', entity.code],
                ['Kind', getEntityKindLabel(entity.kind)],
                ['Status', titleCase(entity.status)],
                ['Criticality', titleCase(entity.criticality)],
                ['Parent', parent?.name ?? 'Theater root'],
                ['District', district?.name ?? 'Unassigned'],
                ['Updated', formatDateTime(entity.updatedAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="label-micro">{label}</span>
                  <span className="text-right text-[10px] text-[var(--text)]">{value}</span>
                </div>
              ))}
            </div>
            {parent ? (
              <button type="button" className="flex w-full items-center gap-2 border-t border-[var(--line)] px-4 py-2.5 text-left text-[9.5px] text-[var(--muted)] hover:text-[var(--cyan)]" onClick={() => navigate(withContext(`/entity/${parent.id}`))}>
                <ArrowUpRight size={10} /> Open parent dossier · {parent.name}
              </button>
            ) : null}
          </Panel>
        </div>
      </div>
    </div>
  )
}
