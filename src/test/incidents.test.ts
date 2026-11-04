import { beforeEach, describe, expect, it } from 'vitest'
import { INCIDENT_TRANSITIONS, canTransitionIncident, incidentDurationLabel, isIncidentActive, nextIncidentStatuses } from '../lib/incidents'
import { DEMO_USERS } from '../data/constants'
import { ROLE_DEFINITIONS } from '../data/roles'
import { usePlatformStore } from '../store/usePlatformStore'
import { useSessionStore } from '../store/useSessionStore'
import type { IncidentStatus } from '../types'

const ALL_STATUSES: IncidentStatus[] = ['detected', 'investigating', 'assigned', 'mitigating', 'resolved', 'archived']

function resetState() {
  usePlatformStore.getState().resetPlatform()
  useSessionStore.setState({
    users: DEMO_USERS,
    roles: ROLE_DEFINITIONS,
    currentUserId: 'usr-elena',
    sessionStartedAt: '2026-11-04T14:00:00.000Z',
  })
}

beforeEach(resetState)

describe('incident state machine', () => {
  it('defines a transition entry for every status', () => {
    for (const status of ALL_STATUSES) {
      expect(Array.isArray(INCIDENT_TRANSITIONS[status])).toBe(true)
    }
  })

  it('allows resolution to be archived while archived stays terminal', () => {
    expect(canTransitionIncident('mitigating', 'resolved')).toBe(true)
    expect(canTransitionIncident('resolved', 'archived')).toBe(true)
    expect(nextIncidentStatuses('resolved')).toEqual(['archived'])
    for (const next of ALL_STATUSES) {
      expect(canTransitionIncident('archived', next)).toBe(false)
    }
  })

  it('rejects unlisted shortcuts', () => {
    expect(canTransitionIncident('detected', 'resolved')).toBe(false)
    expect(canTransitionIncident('detected', 'archived')).toBe(false)
    expect(canTransitionIncident('investigating', 'resolved')).toBe(false)
    expect(canTransitionIncident('mitigating', 'archived')).toBe(false)
  })

  it('classifies active and closed incidents consistently', () => {
    expect(ALL_STATUSES.filter(isIncidentActive)).toEqual(['detected', 'investigating', 'assigned', 'mitigating'])
  })

  it('formats durations without negative values', () => {
    const reference = Date.parse('2026-11-04T15:00:00.000Z')
    expect(incidentDurationLabel('2026-11-04T14:30:00.000Z', undefined, reference)).toBe('30m')
    expect(incidentDurationLabel('2026-11-04T13:30:00.000Z', undefined, reference)).toBe('1h 30m')
    expect(incidentDurationLabel('2026-11-03T14:00:00.000Z', undefined, reference)).toBe('1d 1h')
    expect(incidentDurationLabel('2026-11-04T16:00:00.000Z', undefined, reference)).toBe('0m')
  })
})

describe('incident command store', () => {
  it('advances an incident, records the event and preserves the prior status', () => {
    const before = usePlatformStore.getState().incidents.find((incident) => incident.id === 'inc-2841')
    expect(before?.status).toBe('mitigating')

    const result = usePlatformStore.getState().transitionIncident('inc-2841', 'resolved', 'Feeder restored and reserve recovered.')
    expect(result.ok).toBe(true)

    const after = usePlatformStore.getState().incidents.find((incident) => incident.id === 'inc-2841')
    expect(after?.status).toBe('resolved')
    expect(after?.resolvedAt).toBeTruthy()
    expect(after?.resolution).toBe('Feeder restored and reserve recovered.')
    expect(after?.timeline.at(-1)).toMatchObject({
      kind: 'resolution',
      from: 'mitigating',
      to: 'resolved',
    })
    expect(usePlatformStore.getState().auditLogs[0]).toMatchObject({ action: 'incident.transition' })
  })

  it('archives a resolved incident and rejects further transitions', () => {
    usePlatformStore.getState().transitionIncident('inc-2834', 'archived', 'Closed after retention review.')
    const archived = usePlatformStore.getState().incidents.find((incident) => incident.id === 'inc-2834')
    expect(archived?.status).toBe('archived')

    const rejected = usePlatformStore.getState().transitionIncident('inc-2834', 'investigating')
    expect(rejected.ok).toBe(false)
    expect(rejected.message).toMatch(/invalid transition/i)
  })

  it('rejects invalid transitions without mutating the record', () => {
    const before = usePlatformStore.getState().incidents.find((incident) => incident.id === 'inc-2835')
    const result = usePlatformStore.getState().transitionIncident('inc-2835', 'archived')
    expect(result.ok).toBe(false)

    const after = usePlatformStore.getState().incidents.find((incident) => incident.id === 'inc-2835')
    expect(after).toEqual(before)
  })

  it('enforces the transition permission for read-only observers', () => {
    useSessionStore.setState({ currentUserId: 'usr-oren' })
    const result = usePlatformStore.getState().transitionIncident('inc-2841', 'resolved', 'Should not apply.')
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/cannot advance/i)
    expect(usePlatformStore.getState().incidents.find((incident) => incident.id === 'inc-2841')?.status).toBe('mitigating')
  })
})
