import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Permission, RoleDefinition, RoleId, User } from '../types'
import { ROLE_DEFINITIONS, can } from '../data/roles'
import { DEMO_USERS } from '../data/constants'

interface AuthResult {
  ok: boolean
  message?: string
}

interface SessionState {
  users: User[]
  roles: RoleDefinition[]
  currentUserId: string | null
  sessionStartedAt: string | null
  login: (email: string, password: string) => AuthResult
  loginAs: (userId: string) => AuthResult
  logout: () => void
  updateUserRole: (userId: string, roleId: RoleId) => AuthResult
  toggleRolePermission: (roleId: RoleId, permission: Permission) => AuthResult
  resetRolePermissions: () => AuthResult
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      users: DEMO_USERS,
      roles: ROLE_DEFINITIONS,
      currentUserId: 'usr-elena',
      sessionStartedAt: new Date().toISOString(),
      login: (email, password) => {
        const user = get().users.find(
          (candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase() && candidate.password === password,
        )
        if (!user) return { ok: false, message: 'Identity not recognized. Use the demo credentials shown below.' }
        if (user.status !== 'active') return { ok: false, message: 'This identity is not active.' }
        set({ currentUserId: user.id, sessionStartedAt: new Date().toISOString() })
        return { ok: true }
      },
      loginAs: (userId) => {
        const user = get().users.find((candidate) => candidate.id === userId)
        if (!user) return { ok: false, message: 'Demo identity not found.' }
        set({ currentUserId: user.id, sessionStartedAt: new Date().toISOString() })
        return { ok: true }
      },
      logout: () => set({ currentUserId: null, sessionStartedAt: null }),
      updateUserRole: (userId, roleId) => {
        const session = get()
        const actor = session.users.find((user) => user.id === session.currentUserId)
        if (!actor || !can(actor.roleId, 'admin:users', session.roles)) {
          return { ok: false, message: 'Administrative permission required.' }
        }
        if (!session.roles.some((role) => role.id === roleId)) {
          return { ok: false, message: 'Unknown role.' }
        }
        if (userId === actor.id && roleId !== 'super_admin') {
          return { ok: false, message: 'A super administrator cannot remove their own root authority in demo mode.' }
        }
        set((state) => ({
          users: state.users.map((user) => (user.id === userId ? { ...user, roleId } : user)),
        }))
        return { ok: true }
      },
      toggleRolePermission: (roleId, permission) => {
        const session = get()
        const actor = session.users.find((user) => user.id === session.currentUserId)
        if (!actor || !can(actor.roleId, 'admin:roles', session.roles)) {
          return { ok: false, message: 'Only a super administrator can alter the permission matrix.' }
        }
        if (roleId === 'super_admin') {
          return { ok: false, message: 'Super Administrator permissions are immutable.' }
        }
        set((state) => ({
          roles: state.roles.map((role) => {
            if (role.id !== roleId) return role
            const permissions = role.permissions.includes(permission)
              ? role.permissions.filter((item) => item !== permission)
              : [...role.permissions, permission]
            return { ...role, permissions }
          }),
        }))
        return { ok: true }
      },
      resetRolePermissions: () => {
        const session = get()
        const actor = session.users.find((user) => user.id === session.currentUserId)
        if (!actor || !can(actor.roleId, 'admin:roles', session.roles)) {
          return { ok: false, message: 'Only a super administrator can reset the permission matrix.' }
        }
        set({ roles: ROLE_DEFINITIONS })
        return { ok: true }
      },
    }),
    {
      name: 'nexus-session-v1',
      version: 1,
      partialize: (state) => ({
        users: state.users,
        roles: state.roles,
        currentUserId: state.currentUserId,
        sessionStartedAt: state.sessionStartedAt,
      }),
    },
  ),
)

export function useCurrentUser() {
  return useSessionStore((state) => state.users.find((user) => user.id === state.currentUserId))
}

export function usePermission(permission: Permission) {
  return useSessionStore((state) => {
    const user = state.users.find((candidate) => candidate.id === state.currentUserId)
    return can(user?.roleId, permission, state.roles)
  })
}

export function getCurrentUserSnapshot() {
  const state = useSessionStore.getState()
  return state.users.find((user) => user.id === state.currentUserId)
}

export function authorize(permission: Permission) {
  const state = useSessionStore.getState()
  const user = state.users.find((candidate) => candidate.id === state.currentUserId)
  return {
    user,
    allowed: can(user?.roleId, permission, state.roles),
  }
}
