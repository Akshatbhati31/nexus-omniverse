import type { EntityStatus, IncidentSeverity, IncidentStatus, ReportStatus } from '../../types'
import { cn } from '../../lib/utils'
import { titleCase } from '../../lib/format'

const incidentClasses: Record<IncidentStatus, string> = {
  detected: 'badge-red',
  investigating: 'badge-amber',
  assigned: 'badge-cyan',
  mitigating: 'badge-violet',
  resolved: 'badge-green',
  archived: 'badge-muted',
}

const severityClasses: Record<IncidentSeverity, string> = {
  critical: 'badge-red',
  high: 'badge-amber',
  moderate: 'badge-cyan',
  low: 'badge-muted',
}

const entityClasses: Record<EntityStatus, string> = {
  operational: 'badge-green',
  degraded: 'badge-amber',
  offline: 'badge-red',
  maintenance: 'badge-violet',
  unknown: 'badge-muted',
}

const reportClasses: Record<ReportStatus, string> = {
  draft: 'badge-muted',
  review: 'badge-amber',
  published: 'badge-green',
  archived: 'badge-muted',
}

export function IncidentStatusBadge({ status, className }: { status: IncidentStatus; className?: string }) {
  return (
    <span className={cn('badge', incidentClasses[status], className)}>
      <span className={cn('status-dot', ['detected', 'investigating', 'mitigating'].includes(status) && 'status-dot-pulse')} />
      {status}
    </span>
  )
}

export function SeverityBadge({ severity, className }: { severity: IncidentSeverity; className?: string }) {
  return <span className={cn('badge', severityClasses[severity], className)}>{severity}</span>
}

export function EntityStatusBadge({ status, className }: { status: EntityStatus; className?: string }) {
  return (
    <span className={cn('badge', entityClasses[status], className)}>
      <span className="status-dot" />
      {status}
    </span>
  )
}

export function ReportStatusBadge({ status, className }: { status: ReportStatus; className?: string }) {
  return <span className={cn('badge', reportClasses[status], className)}>{titleCase(status)}</span>
}
