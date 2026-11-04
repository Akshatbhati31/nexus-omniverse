import { beforeEach, describe, expect, it } from 'vitest'
import { ALL_PERMISSIONS, PERMISSION_CATALOG, ROLE_DEFINITIONS, VIEW_PERMISSIONS, can } from '../data/roles'
import { DEMO_USERS } from '../data/constants'
import { useSessionStore } from '../store/useSessionStore'
import type { Permission } from '../types'

function resetSession() {
  useSessionStore.setState({
    users: DEMO_USERS,
    roles: ROLE_DEFINITIONS,
    currentUserId: 'usr-elena',
    sessionStartedAt: '2026-11-04T14:00:00.000Z',
  })
}

beforeEach(resetSession)

describe('role permission catalog', () => {
  it('keeps every declared permission in the catalog exactly once', () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length)
    expect(new Set(PERMISSION_CATALOG.map((entry) => entry.id))).toEqual(new Set(ALL_PERMISSIONS))
  })

  it('only references known permissions from role definitions', () => {
    const known = new Set<Permission>(ALL_PERMISSIONS)
    for (const role of ROLE_DEFINITIONS) {
      for (const permission of role.permissions) {
        expect(known.has(permission), `${role.id} references unknown permission ${permission}`).toBe(true)
      }
    }
  })

  it('grants the super administrator every permission and the observer no mutations', () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(can('super_admin', permission)).toBe(true)
    }

    const observerReadOnly = ALL_PERMISSIONS.filter(
      (permission) => !VIEW_PERMISSIONS.includes(permission) && permission !== 'notification:prefs',
    )
    for (const permission of observerReadOnly) {
      expect(can('observer', permission), `observer should not hold ${permission}`).toBe(false)
    }
    for (const permission of VIEW_PERMISSIONS) {
      expect(can('observer', permission)).toBe(true)
    }
    expect(can('observer', 'notification:prefs')).toBe(true)
  })

  it('fails closed for missing or unknown roles', () => {
    expect(can(undefined, 'view:overview')).toBe(false)
    expect(can('nonexistent' as never, 'view:overview')).toBe(false)
  })
})

describe('session authorization', () => {
  it('rejects invalid credentials and accepts active demo identities', () => {
    expect(useSessionStore.getState().login('elena.voss@nexus.local', 'wrong').ok).toBe(false)
    expect(useSessionStore.getState().login('unknown@nexus.local', 'nexus').ok).toBe(false)

    const result = useSessionStore.getState().login('elena.voss@nexus.local', 'nexus')
    expect(result.ok).toBe(true)
    expect(useSessionStore.getState().currentUserId).toBe('usr-elena')
  })

  it('blocks role delegation for non-administrators', () => {
    const result = useSessionStore.getState().updateUserRole('usr-sera', 'observer')
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/administrative permission/i)
  })

  it('allows a super administrator to delegate roles', () => {
    useSessionStore.getState().loginAs('usr-aris')
    const result = useSessionStore.getState().updateUserRole('usr-sera', 'observer')
    expect(result.ok).toBe(true)
    expect(useSessionStore.getState().users.find((user) => user.id === 'usr-sera')?.roleId).toBe('observer')
  })

  it('protects the super administrator from self-demotion', () => {
    useSessionStore.getState().loginAs('usr-aris')
    const result = useSessionStore.getState().updateUserRole('usr-aris', 'observer')
    expect(result.ok).toBe(false)
    expect(useSessionStore.getState().users.find((user) => user.id === 'usr-aris')?.roleId).toBe('super_admin')
  })

  it('only lets a super administrator alter and reset the permission matrix', () => {
    const denied = useSessionStore.getState().toggleRolePermission('observer', 'view:overview')
    expect(denied.ok).toBe(false)

    useSessionStore.getState().loginAs('usr-aris')
    const toggled = useSessionStore.getState().toggleRolePermission('observer', 'view:overview')
    expect(toggled.ok).toBe(true)
    expect(can('observer', 'view:overview', useSessionStore.getState().roles)).toBe(false)

    const immutable = useSessionStore.getState().toggleRolePermission('super_admin', 'view:overview')
    expect(immutable.ok).toBe(false)

    const reset = useSessionStore.getState().resetRolePermissions()
    expect(reset.ok).toBe(true)
    expect(can('observer', 'view:overview', useSessionStore.getState().roles)).toBe(true)
  })
})
