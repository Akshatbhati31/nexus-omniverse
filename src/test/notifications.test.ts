import { beforeEach, describe, expect, it } from 'vitest'
import { DEMO_USERS } from '../data/constants'
import { ROLE_DEFINITIONS } from '../data/roles'
import { usePlatformStore } from '../store/usePlatformStore'
import { useSessionStore } from '../store/useSessionStore'

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

describe('notification invariants', () => {
  it('creates an unread notification for an authorized incident transition', () => {
    const before = usePlatformStore.getState().notifications.length
    usePlatformStore.getState().transitionIncident('inc-2841', 'resolved', 'Reserve restored.')

    const notifications = usePlatformStore.getState().notifications
    expect(notifications).toHaveLength(before + 1)
    expect(notifications[0]).toMatchObject({
      category: 'incident',
      priority: 'critical',
      read: false,
      href: '/incidents/inc-2841',
    })
  })

  it('respects disabled incident notification preferences while retaining audit records', () => {
    usePlatformStore.getState().updateNotificationPreferences({ incidentUpdates: false })
    const before = usePlatformStore.getState().notifications.length
    const auditBefore = usePlatformStore.getState().auditLogs.length

    usePlatformStore.getState().transitionIncident('inc-2841', 'resolved', 'Reserve restored.')

    expect(usePlatformStore.getState().notifications).toHaveLength(before)
    expect(usePlatformStore.getState().auditLogs).toHaveLength(auditBefore + 1)
  })

  it('marks one or all notifications as read without removing them', () => {
    const notifications = usePlatformStore.getState().notifications
    const target = notifications.find((notification) => !notification.read)
    expect(target).toBeDefined()

    if (target) {
      usePlatformStore.getState().markNotificationRead(target.id)
      const updated = usePlatformStore.getState().notifications
      expect(updated).toHaveLength(notifications.length)
      expect(updated.find((notification) => notification.id === target.id)?.read).toBe(true)
    }

    usePlatformStore.getState().markAllNotificationsRead()
    expect(usePlatformStore.getState().notifications.every((notification) => notification.read)).toBe(true)
  })

  it('merges preference patches without dropping unrelated settings', () => {
    const original = usePlatformStore.getState().notificationPreferences
    usePlatformStore.getState().updateNotificationPreferences({ digestFrequency: 'daily' })
    expect(usePlatformStore.getState().notificationPreferences).toEqual({
      ...original,
      digestFrequency: 'daily',
    })
  })

  it('resets the notification ledger and preferences to the demo baseline', () => {
    usePlatformStore.getState().updateNotificationPreferences({ systemAlerts: false })
    usePlatformStore.getState().markAllNotificationsRead()
    usePlatformStore.getState().resetPlatform()

    expect(usePlatformStore.getState().notificationPreferences.systemAlerts).toBe(true)
    expect(usePlatformStore.getState().notifications.some((notification) => !notification.read)).toBe(true)
  })
})
