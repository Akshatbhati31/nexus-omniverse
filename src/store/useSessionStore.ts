import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Permission, RoleDefinition, RoleId, User } from '../types'
import { ROLE_DEFINITIONS, can } from '../data/roles'
import { DEMO_USERS } from '../data/constants'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { restoreLiveSession, signInWithEmail, signOutOperator, signUpWithEmail } from '../lib/auth'

export interface AuthResult {
  ok: boolean
  message?: string
}

export interface SessionState {
  users: User[]
  roles: RoleDefinition[]
  currentUserId: string | null
  sessionStartedAt: string | null
  isLiveAuthenticated: boolean
  liveUser: User | null

  // Core Actions
  login: (email: string, password: string) => AuthResult
  loginAs: (userId: string) => AuthResult
  logout: () => void
  updateUserRole: (userId: string, roleId: RoleId) => AuthResult
  toggleRolePermission: (roleId: RoleId, permission: Permission) => AuthResult
  resetRolePermissions: () => AuthResult

  // Live Supabase Actions
  setLiveUser: (user: User | null) => void
  loginLive: (email: string, password: string) => Promise<AuthResult>
  signUpLive: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{ ok: boolean; confirmationRequired?: boolean; message?: string }>
  initLiveSession: () => () => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      users: DEMO_USERS,
      roles: ROLE_DEFINITIONS,
      currentUserId: 'usr-elena',
      sessionStartedAt: new Date().toISOString(),
      isLiveAuthenticated: false,
      liveUser: null,

      login: (email, password) => {
        const user = get().users.find(
          (candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase() && candidate.password === password,
        )
        if (!user) return { ok: false, message: 'Identity not recognized. Use the demo credentials shown below.' }
        if (user.status !== 'active') return { ok: false, message: 'This identity is not active.' }
        set({
          currentUserId: user.id,
          isLiveAuthenticated: false,
          liveUser: null,
          sessionStartedAt: new Date().toISOString(),
        })
        return { ok: true }
      },

      loginAs: (userId) => {
        const user = get().users.find((candidate) => candidate.id === userId)
        if (!user) return { ok: false, message: 'Demo identity not found.' }
        set({
          currentUserId: user.id,
          isLiveAuthenticated: false,
          liveUser: null,
          sessionStartedAt: new Date().toISOString(),
        })
        return { ok: true }
      },

      logout: () => {
        if (get().isLiveAuthenticated) {
          void signOutOperator()
        }
        set({
          currentUserId: null,
          sessionStartedAt: null,
          isLiveAuthenticated: false,
          liveUser: null,
        })
      },

      updateUserRole: (userId, roleId) => {
        const session = get()
        // Non-negotiable security rule: disable client-side role switching in live authenticated mode
        if (session.isLiveAuthenticated) {
          return {
            ok: false,
            message: 'Client-side role elevation is disabled in live authenticated mode. Role assignments require server-side authorization.',
          }
        }

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
        if (session.isLiveAuthenticated) {
          return {
            ok: false,
            message: 'Permission matrix mutations are disabled in live authenticated mode.',
          }
        }

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
        if (session.isLiveAuthenticated) {
          return { ok: false, message: 'Permission matrix reset is disabled in live authenticated mode.' }
        }

        const actor = session.users.find((user) => user.id === session.currentUserId)
        if (!actor || !can(actor.roleId, 'admin:roles', session.roles)) {
          return { ok: false, message: 'Only a super administrator can reset the permission matrix.' }
        }
        set({ roles: ROLE_DEFINITIONS })
        return { ok: true }
      },

      setLiveUser: (user) => {
        if (user) {
          set((state) => {
            const existingIndex = state.users.findIndex((u) => u.id === user.id)
            const updatedUsers =
              existingIndex >= 0
                ? state.users.map((u) => (u.id === user.id ? user : u))
                : [user, ...state.users]

            return {
              liveUser: user,
              currentUserId: user.id,
              isLiveAuthenticated: true,
              users: updatedUsers,
              sessionStartedAt: new Date().toISOString(),
            }
          })
        } else {
          set({
            liveUser: null,
            isLiveAuthenticated: false,
            currentUserId: DEMO_USERS[0].id,
            sessionStartedAt: new Date().toISOString(),
          })
        }
      },

      loginLive: async (email, password) => {
        const { user, error } = await signInWithEmail(email, password)
        if (error || !user) {
          return { ok: false, message: error || 'Authentication failed.' }
        }
        get().setLiveUser(user)
        return { ok: true }
      },

      signUpLive: async (email, password, displayName) => {
        const { user, confirmationRequired, error } = await signUpWithEmail(email, password, displayName)
        if (error) {
          return { ok: false, message: error }
        }
        if (confirmationRequired) {
          return { ok: true, confirmationRequired: true, message: 'Account registered. Verification required.' }
        }
        if (user) {
          get().setLiveUser(user)
        }
        return { ok: true }
      },

      initLiveSession: () => {
        if (!isSupabaseConfigured() || !supabase) {
          return () => {}
        }

        // Restore existing session on mount
        void restoreLiveSession().then((user) => {
          if (user) {
            get().setLiveUser(user)
          }
        })

        // Listen for auth state events
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN' && session?.user) {
            const user = await restoreLiveSession()
            if (user) {
              get().setLiveUser(user)
            }
          } else if (event === 'SIGNED_OUT') {
            get().setLiveUser(null)
          }
        })

        return () => {
          subscription.unsubscribe()
        }
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
        isLiveAuthenticated: state.isLiveAuthenticated,
      }),
    },
  ),
)

export function useCurrentUser() {
  return useSessionStore((state) => {
    if (state.isLiveAuthenticated && state.liveUser) {
      return state.liveUser
    }
    return state.users.find((user) => user.id === state.currentUserId)
  })
}

export function usePermission(permission: Permission) {
  return useSessionStore((state) => {
    const user = state.isLiveAuthenticated && state.liveUser
      ? state.liveUser
      : state.users.find((candidate) => candidate.id === state.currentUserId)
    return can(user?.roleId, permission, state.roles)
  })
}

export function getCurrentUserSnapshot() {
  const state = useSessionStore.getState()
  if (state.isLiveAuthenticated && state.liveUser) {
    return state.liveUser
  }
  return state.users.find((user) => user.id === state.currentUserId)
}

export function authorize(permission: Permission) {
  const state = useSessionStore.getState()
  const user = state.isLiveAuthenticated && state.liveUser
    ? state.liveUser
    : state.users.find((candidate) => candidate.id === state.currentUserId)
  return {
    user,
    allowed: can(user?.roleId, permission, state.roles),
  }
}
