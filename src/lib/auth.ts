import { isSupabaseConfigured, supabase } from './supabase'
import type { RoleId, User } from '../types'

export const VALID_ROLES: ReadonlyArray<RoleId> = [
  'super_admin',
  'sys_admin',
  'ops_manager',
  'analyst',
  'researcher',
  'observer',
] as const

export interface AuthFailure {
  user: null
  error: string
  code: 'MISSING_PROFILE' | 'SUSPENDED' | 'INVITED' | 'INVALID_ROLE' | 'LOOKUP_FAILED' | 'AUTH_FAILED'
  confirmationRequired?: false
}

export interface AuthSuccess {
  user: User
  error: null
  confirmationRequired?: boolean
}

export interface AuthConfirmationPending {
  user: null
  error: null
  confirmationRequired: true
}

export type AuthResponse = AuthSuccess | AuthFailure | AuthConfirmationPending

/**
 * Maps a verified Supabase `public.profiles` database record to the frontend `User` interface.
 * Does NOT permit synthetic fallbacks.
 */
export function mapProfileToUser(profile: Record<string, unknown>, authEmail?: string): User {
  const name = (profile.display_name as string) || (authEmail ? authEmail.split('@')[0] : 'Operator')
  const email = (profile.email as string) || authEmail || ''

  const parts = name.trim().split(/\s+/)
  const initials = parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()

  return {
    id: String(profile.id),
    name,
    email,
    password: '', // Never store passwords in memory
    roleId: profile.role_id as RoleId,
    title: (profile.title as string) || 'Observer',
    clearance: (profile.clearance as string) || 'L1',
    status: profile.status as User['status'],
    initials: initials || 'OP',
    color: 'var(--cyan)',
    lastActive: new Date().toISOString(),
  }
}

/**
 * Validates and fetches profile from `public.profiles`.
 * Fails closed on any error, missing profile, or non-active status.
 */
export async function fetchValidatedUserProfile(userId: string, authEmail?: string): Promise<{ user: User | null; failure?: AuthFailure }> {
  if (!supabase) {
    return {
      user: null,
      failure: {
        user: null,
        error: 'Supabase client is not configured.',
        code: 'LOOKUP_FAILED',
      },
    }
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      return {
        user: null,
        failure: {
          user: null,
          error: `Database profile lookup failed: ${error.message}`,
          code: 'LOOKUP_FAILED',
        },
      }
    }

    if (!data) {
      return {
        user: null,
        failure: {
          user: null,
          error: 'No operational profile found for authenticated account. Authorization denied.',
          code: 'MISSING_PROFILE',
        },
      }
    }

    // Strict status validation: Reject suspended accounts
    if (data.status === 'suspended') {
      return {
        user: null,
        failure: {
          user: null,
          error: 'Account has been suspended by system administrator.',
          code: 'SUSPENDED',
        },
      }
    }

    // Strict status validation: Reject unactivated invitations
    if (data.status === 'invited') {
      return {
        user: null,
        failure: {
          user: null,
          error: 'Account invitation pending activation. Access denied.',
          code: 'INVITED',
        },
      }
    }

    if (data.status !== 'active') {
      return {
        user: null,
        failure: {
          user: null,
          error: `Account status '${data.status}' is unauthorized.`,
          code: 'SUSPENDED',
        },
      }
    }

    // Validate role_id against actual role catalog
    const roleId = data.role_id as RoleId
    if (!VALID_ROLES.includes(roleId)) {
      return {
        user: null,
        failure: {
          user: null,
          error: `Assigned role '${data.role_id}' is invalid or unrecognized by platform policy.`,
          code: 'INVALID_ROLE',
        },
      }
    }

    return { user: mapProfileToUser(data, authEmail) }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown exception during profile lookup'
    return {
      user: null,
      failure: {
        user: null,
        error: message,
        code: 'LOOKUP_FAILED',
      },
    }
  }
}

/**
 * Authenticate against Supabase Auth using email and password.
 * Fails closed if profile is missing, suspended, or invalid.
 */
export async function signInWithEmail(email: string, password: string): Promise<AuthResponse> {
  if (!supabase || !isSupabaseConfigured()) {
    return {
      user: null,
      error: 'Live Supabase backend credentials unconfigured. Switch to simulation mode.',
      code: 'AUTH_FAILED',
    }
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      return { user: null, error: error.message, code: 'AUTH_FAILED' }
    }

    if (!data.user) {
      return { user: null, error: 'Authentication returned no active identity.', code: 'AUTH_FAILED' }
    }

    // Strict profile validation: Fail closed
    const { user, failure } = await fetchValidatedUserProfile(data.user.id, data.user.email)
    if (failure || !user) {
      // Clean up session if profile validation fails
      await signOutOperator().catch(() => {})
      return failure || { user: null, error: 'Profile authorization failed.', code: 'MISSING_PROFILE' }
    }

    return { user, error: null }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Authentication exception'
    return { user: null, error: message, code: 'AUTH_FAILED' }
  }
}

/**
 * Register a new user against Supabase Auth.
 * Does not create synthetic active users.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<AuthResponse> {
  if (!supabase || !isSupabaseConfigured()) {
    return { user: null, error: 'Live backend unconfigured.', code: 'AUTH_FAILED' }
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: displayName.trim(),
        },
      },
    })

    if (error) {
      return { user: null, error: error.message, code: 'AUTH_FAILED' }
    }

    if (!data.user) {
      return { user: null, error: 'Registration failed.', code: 'AUTH_FAILED' }
    }

    // If confirmation is required, session is null
    if (!data.session) {
      return { user: null, confirmationRequired: true, error: null }
    }

    // Validate created profile
    const { user, failure } = await fetchValidatedUserProfile(data.user.id, data.user.email)
    if (failure || !user) {
      return {
        user: null,
        confirmationRequired: false,
        error: failure?.error || 'Profile provisioning pending server-side confirmation.',
        code: failure?.code || 'MISSING_PROFILE',
      }
    }

    return { user, confirmationRequired: false, error: null }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration failure'
    return { user: null, error: message, code: 'AUTH_FAILED' }
  }
}

/**
 * Sign out active operator from Supabase Auth.
 * Never throws, allowing local session cleanup to proceed regardless.
 */
export async function signOutOperator(): Promise<void> {
  if (!supabase) return
  try {
    await supabase.auth.signOut()
  } catch (err) {
    console.warn('Auth gateway: Supabase signOut encountered network error', err)
  }
}

/**
 * Restore active Supabase session on application startup or refresh.
 * Fails closed: if profile is invalid, revoked, or suspended, immediately signs out and returns null.
 */
export async function restoreLiveSession(): Promise<User | null> {
  if (!supabase || !isSupabaseConfigured()) return null

  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session?.user) return null

    const { user, failure } = await fetchValidatedUserProfile(session.user.id, session.user.email)
    if (failure || !user) {
      console.warn('Auth gateway: Session restoration rejected:', failure?.error)
      await signOutOperator().catch(() => {})
      return null
    }

    return user
  } catch (err) {
    console.warn('Auth gateway: Session restoration exception:', err)
    await signOutOperator().catch(() => {})
    return null
  }
}
