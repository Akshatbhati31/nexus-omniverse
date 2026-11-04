import type { IncidentStatus } from '../types'

export const INCIDENT_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  detected: ['investigating', 'assigned'],
  investigating: ['assigned', 'mitigating'],
  assigned: ['investigating', 'mitigating'],
  mitigating: ['resolved', 'assigned'],
  resolved: ['archived'],
  archived: [],
}

export function canTransitionIncident(current: IncidentStatus, next: IncidentStatus) {
  return INCIDENT_TRANSITIONS[current].includes(next)
}

export function nextIncidentStatuses(current: IncidentStatus) {
  return INCIDENT_TRANSITIONS[current]
}

export function isIncidentActive(status: IncidentStatus) {
  return !['resolved', 'archived'].includes(status)
}

export function severityWeight(severity: 'critical' | 'high' | 'moderate' | 'low') {
  return { critical: 4, high: 3, moderate: 2, low: 1 }[severity]
}

export function incidentDurationLabel(detectedAt: string, resolvedAt?: string, reference = Date.now()) {
  const end = resolvedAt ? new Date(resolvedAt).getTime() : reference
  const minutes = Math.max(0, Math.round((end - new Date(detectedAt).getTime()) / 60_000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (hours < 24) return `${hours}h ${remainder}m`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}
