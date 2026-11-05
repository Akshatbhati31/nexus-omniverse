import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import hardeningSql from '../../supabase/migrations/0004_security_hardening.sql?raw'
import rollbackSql from '../../supabase/migrations/0004_rollback.sql?raw'
import { useSessionStore } from '../store/useSessionStore'
import {
  fetchValidatedUserProfile,
  mapProfileToUser,
  restoreLiveSession,
  VALID_ROLES,
} from '../lib/auth'
import { backend, resolveClientUuid, VALID_ENTITY_TYPES } from '../lib/backend'
import { canTransitionIncident } from '../lib/incidents'
import { ROLE_DEFINITIONS, PERMISSION_CATALOG, can } from '../data/roles'
import { DEMO_USERS } from '../data/constants'
import * as supabaseModule from '../lib/supabase'
import type { Dashboard, Report } from '../types'

describe('NEXUS // Security Hardening & Backend Integrity Test Suite', () => {
  beforeEach(() => {
    // Reset session store to clean baseline state
    useSessionStore.setState({
      users: DEMO_USERS,
      roles: ROLE_DEFINITIONS,
      currentUserId: 'usr-elena',
      isLiveAuthenticated: false,
      liveUser: null,
    })
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // --------------------------------------------------------------------------
  // 1. Authentication & Session Management (Fail Closed)
  // --------------------------------------------------------------------------
  describe('Authentication & Session Management (Fail-Closed)', () => {
    it('initializes in demo mode with active supervisor profile', () => {
      const state = useSessionStore.getState()
      expect(state.currentUserId).toBe('usr-elena')
      expect(state.isLiveAuthenticated).toBe(false)
      expect(state.users.length).toBeGreaterThan(0)
    })

    it('handles failed demo login attempts with descriptive failure message', () => {
      const result = useSessionStore.getState().login('invalid@nexus.local', 'wrongpass')
      expect(result.ok).toBe(false)
      expect(result.message).toContain('Identity not recognized')
      expect(useSessionStore.getState().isLiveAuthenticated).toBe(false)
    })

    it('performs clean logout clearing current identity and live session tokens', () => {
      useSessionStore.getState().logout()
      const state = useSessionStore.getState()
      expect(state.currentUserId).toBeNull()
      expect(state.isLiveAuthenticated).toBe(false)
      expect(state.liveUser).toBeNull()
    })

    it('guarantees local logout cleanup even if Supabase network signOut fails', async () => {
      const mockSupabase = {
        auth: {
          signOut: vi.fn().mockRejectedValue(new Error('Network gateway timeout')),
        },
      } as unknown as typeof supabaseModule.supabase

      vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabase)

      useSessionStore.setState({
        currentUserId: 'usr-live-test',
        isLiveAuthenticated: true,
        liveUser: mapProfileToUser({ id: 'usr-live-test', role_id: 'analyst', status: 'active' }),
      })

      useSessionStore.getState().logout()

      const state = useSessionStore.getState()
      expect(state.currentUserId).toBeNull()
      expect(state.isLiveAuthenticated).toBe(false)
      expect(state.liveUser).toBeNull()
    })

    it('maps external Supabase profile records to valid User objects with observer defaults', () => {
      const mapped = mapProfileToUser({
        id: '11111111-2222-3333-4444-555555555555',
        display_name: 'Cadet Operator',
        email: 'cadet@nexus.defense.gov',
        role_id: 'observer',
        clearance: 'L1',
        status: 'active',
      })

      expect(mapped.id).toBe('11111111-2222-3333-4444-555555555555')
      expect(mapped.name).toBe('Cadet Operator')
      expect(mapped.roleId).toBe('observer')
      expect(mapped.clearance).toBe('L1')
      expect(mapped.status).toBe('active')
      expect(mapped.initials).toBe('CO')
    })

    it('disables client-side role switching when in live authenticated mode', () => {
      useSessionStore.setState({
        isLiveAuthenticated: true,
        liveUser: mapProfileToUser({
          id: 'user-live-123',
          display_name: 'Live Analyst',
          role_id: 'analyst',
          status: 'active',
        }),
        currentUserId: 'user-live-123',
      })

      const attempt = useSessionStore.getState().updateUserRole('user-live-123', 'super_admin')
      expect(attempt.ok).toBe(false)
      expect(attempt.message).toContain('disabled in live authenticated mode')
    })

    it('fails closed when database profile lookup returns null (Missing Profile)', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      } as unknown as typeof supabaseModule.supabase

      vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabase)

      const result = await fetchValidatedUserProfile('mock-uuid-unprovisioned')
      expect(result.user).toBeNull()
      expect(result.failure?.code).toBe('MISSING_PROFILE')
      expect(result.failure?.error).toContain('No operational profile found')
    })

    it('fails closed and rejects suspended operator profiles', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'mock-uuid-suspended',
                  display_name: 'Suspended Agent',
                  email: 'suspended@nexus.local',
                  role_id: 'analyst',
                  status: 'suspended',
                },
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as typeof supabaseModule.supabase

      vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabase)

      const result = await fetchValidatedUserProfile('mock-uuid-suspended')
      expect(result.user).toBeNull()
      expect(result.failure?.code).toBe('SUSPENDED')
      expect(result.failure?.error).toContain('suspended by system administrator')
    })

    it('fails closed and rejects unactivated invitation profiles', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'mock-uuid-invited',
                  display_name: 'Invited Operator',
                  email: 'invited@nexus.local',
                  role_id: 'observer',
                  status: 'invited',
                },
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as typeof supabaseModule.supabase

      vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabase)

      const result = await fetchValidatedUserProfile('mock-uuid-invited')
      expect(result.user).toBeNull()
      expect(result.failure?.code).toBe('INVITED')
      expect(result.failure?.error).toContain('invitation pending activation')
    })

    it('fails closed and rejects profiles with unrecognized or invalid roles', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'mock-uuid-corrupt',
                  display_name: 'Corrupt Role',
                  email: 'corrupt@nexus.local',
                  role_id: 'non_existent_superuser',
                  status: 'active',
                },
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as typeof supabaseModule.supabase

      vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabase)

      const result = await fetchValidatedUserProfile('mock-uuid-corrupt')
      expect(result.user).toBeNull()
      expect(result.failure?.code).toBe('INVALID_ROLE')
    })

    it('fails closed when database profile lookup encounters a SQL/network error', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'connection refused by target host' },
              }),
            }),
          }),
        }),
      } as unknown as typeof supabaseModule.supabase

      vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabase)

      const result = await fetchValidatedUserProfile('mock-uuid-err')
      expect(result.user).toBeNull()
      expect(result.failure?.code).toBe('LOOKUP_FAILED')
      expect(result.failure?.error).toContain('Database profile lookup failed')
    })

    it('rejects live session restoration if profile validation fails and signs out', async () => {
      const signOutSpy = vi.fn().mockResolvedValue({ error: null })
      const mockSupabase = {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: { user: { id: 'mock-revoked-uid', email: 'revoked@nexus.local' } } },
            error: null,
          }),
          signOut: signOutSpy,
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'mock-revoked-uid', status: 'suspended', role_id: 'analyst' },
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as typeof supabaseModule.supabase

      vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabase)
      vi.spyOn(supabaseModule, 'isSupabaseConfigured').mockReturnValue(true)

      const restored = await restoreLiveSession()
      expect(restored).toBeNull()
      expect(signOutSpy).toHaveBeenCalled()
    })
  })

  // --------------------------------------------------------------------------
  // 2. RBAC & Permission Catalog Verification
  // --------------------------------------------------------------------------
  describe('RBAC & Permission Catalog Verification', () => {
    it('verifies exact catalog count of 32 permissions', () => {
      expect(PERMISSION_CATALOG.length).toBe(32)
    })

    it('verifies exact permission counts across all 6 system roles', () => {
      const roleCounts: Record<string, number> = {
        super_admin: 32,
        sys_admin: 31,
        ops_manager: 27,
        analyst: 26,
        researcher: 21,
        observer: 15,
      }

      for (const [roleId, expectedCount] of Object.entries(roleCounts)) {
        const role = ROLE_DEFINITIONS.find((r) => r.id === roleId)
        expect(role, `Role ${roleId} should exist`).toBeDefined()
        expect(role!.permissions.length).toBe(expectedCount)
      }
    })

    it('restricts observer role to read-only capabilities', () => {
      expect(can('observer', 'view:overview')).toBe(true)
      expect(can('observer', 'view:incidents')).toBe(true)
      expect(can('observer', 'incident:create')).toBe(false)
      expect(can('observer', 'incident:transition')).toBe(false)
      expect(can('observer', 'admin:users')).toBe(false)
      expect(can('observer', 'admin:roles')).toBe(false)
    })

    it('grants operations managers incident transition and assignment authorities', () => {
      expect(can('ops_manager', 'incident:create')).toBe(true)
      expect(can('ops_manager', 'incident:transition')).toBe(true)
      expect(can('ops_manager', 'incident:assign')).toBe(true)
      expect(can('ops_manager', 'admin:roles')).toBe(false)
    })

    it('grants super administrators unrestricted platform permissions (32/32)', () => {
      const superAdminRole = ROLE_DEFINITIONS.find((r) => r.id === 'super_admin')!
      expect(superAdminRole.permissions.length).toBe(32)
      for (const perm of superAdminRole.permissions) {
        expect(can('super_admin', perm)).toBe(true)
      }
    })

    it('verifies system role definitions contain all valid role IDs', () => {
      for (const roleId of VALID_ROLES) {
        const found = ROLE_DEFINITIONS.some((r) => r.id === roleId)
        expect(found).toBe(true)
      }
    })
  })

  // --------------------------------------------------------------------------
  // 3. Incident State Machine & Transition Rules
  // --------------------------------------------------------------------------
  describe('Incident State Machine Logic', () => {
    it('validates legal lifecycle transitions', () => {
      expect(canTransitionIncident('detected', 'investigating')).toBe(true)
      expect(canTransitionIncident('detected', 'assigned')).toBe(true)
      expect(canTransitionIncident('investigating', 'mitigating')).toBe(true)
      expect(canTransitionIncident('mitigating', 'resolved')).toBe(true)
      expect(canTransitionIncident('resolved', 'archived')).toBe(true)
    })

    it('rejects illegal lifecycle transitions', () => {
      expect(canTransitionIncident('detected', 'resolved')).toBe(false)
      expect(canTransitionIncident('detected', 'archived')).toBe(false)
      expect(canTransitionIncident('resolved', 'investigating')).toBe(false)
      expect(canTransitionIncident('archived', 'mitigating')).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // 4. UUID Resolution & Persistent Mapping
  // --------------------------------------------------------------------------
  describe('UUID Resolution & Fail-Closed Live Mapping', () => {
    it('strictly excludes profile from valid entity types', () => {
      expect(VALID_ENTITY_TYPES.includes('profile' as unknown as typeof VALID_ENTITY_TYPES[number])).toBe(false)
    })

    it('rejects profile entity type in resolveClientUuid with security violation', async () => {
      await expect(resolveClientUuid('usr-operator', 'profile')).rejects.toThrow(
        /Security violation: 'profile' cannot be resolved via client_id_map/
      )
    })

    it('passes standard RFC 4122 UUIDs through unchanged', async () => {
      const standardUuid = 'e2b7e123-4567-489a-bcde-f0123456789a'
      const resolved = await resolveClientUuid(standardUuid, 'incident')
      expect(resolved).toBe(standardUuid)
    })

    it('rejects invalid or unauthorized entity types', async () => {
      await expect(resolveClientUuid('client-id-123', 'unauthorized_table')).rejects.toThrow(
        /Security violation: Invalid entity type/
      )
    })

    it('rejects empty client identifiers', async () => {
      await expect(resolveClientUuid('', 'incident')).rejects.toThrow(/Invalid client identifier/)
    })

    it('fails closed without synthetic fallback if live RPC fails in live mode', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'permission denied for function resolve_client_uuid' },
        }),
      } as unknown as typeof supabaseModule.supabase

      vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabase)
      vi.spyOn(supabaseModule, 'isBackendLive').mockReturnValue(true)
      vi.spyOn(supabaseModule, 'isSupabaseConfigured').mockReturnValue(true)

      await expect(resolveClientUuid('dash-custom', 'dashboard')).rejects.toThrow(
        /Live UUID mapping failed for dashboard 'dash-custom'/
      )
    })
  })

  // --------------------------------------------------------------------------
  // 5. Incident Assignment & Coordinates Integrity
  // --------------------------------------------------------------------------
  describe('Incident Assignment & Coordinates Integrity', () => {
    it('rejects incident assignments with non-UUID leadId strings', async () => {
      vi.spyOn(supabaseModule, 'isBackendLive').mockReturnValue(true)
      vi.spyOn(supabaseModule, 'isSupabaseConfigured').mockReturnValue(true)

      const mockSupabase = {
        rpc: vi.fn(),
      } as unknown as typeof supabaseModule.supabase
      vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabase)

      const success = await backend.persistIncidentAssignment(
        '11111111-2222-3333-4444-555555555555',
        'Strike Team Alpha',
        'invalid-slug-identity'
      )

      expect(success).toBe(false)
      expect(backend.getStatus().error).toContain('must be an existing profile UUID')
    })

    it('rejects incident assignments if assigned lead profile is non-existent', async () => {
      vi.spyOn(supabaseModule, 'isBackendLive').mockReturnValue(true)
      vi.spyOn(supabaseModule, 'isSupabaseConfigured').mockReturnValue(true)

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      } as unknown as typeof supabaseModule.supabase
      vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabase)

      const success = await backend.persistIncidentAssignment(
        '11111111-2222-3333-4444-555555555555',
        'Strike Team Alpha',
        '99999999-9999-9999-9999-999999999999'
      )

      expect(success).toBe(false)
      expect(backend.getStatus().error).toContain('does not exist')
    })

    it('rejects incident assignments if assigned lead profile is suspended', async () => {
      vi.spyOn(supabaseModule, 'isBackendLive').mockReturnValue(true)
      vi.spyOn(supabaseModule, 'isSupabaseConfigured').mockReturnValue(true)

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: '99999999-9999-9999-9999-999999999999', status: 'suspended' },
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as typeof supabaseModule.supabase
      vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabase)

      const success = await backend.persistIncidentAssignment(
        '11111111-2222-3333-4444-555555555555',
        'Strike Team Alpha',
        '99999999-9999-9999-9999-999999999999'
      )

      expect(success).toBe(false)
      expect(backend.getStatus().error).toContain('not active')
    })

    it('maps real location coordinates when fetching incidents from Supabase', async () => {
      vi.spyOn(supabaseModule, 'isBackendLive').mockReturnValue(true)
      vi.spyOn(supabaseModule, 'isSupabaseConfigured').mockReturnValue(true)

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: '11111111-1111-1111-1111-111111111111',
                  reference: 'INC-001',
                  title: 'Power Surge',
                  location: {
                    id: 'loc-01',
                    name: 'North Grid Station',
                    map_x: 640.5,
                    map_y: 420.25,
                  },
                },
                {
                  id: '22222222-2222-2222-2222-222222222222',
                  reference: 'INC-002',
                  title: 'Traffic Gridlock',
                  location: null,
                },
              ],
              error: null,
            }),
          }),
        }),
      } as unknown as typeof supabaseModule.supabase
      vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabase)

      const incidents = await backend.fetchIncidents()
      expect(incidents).not.toBeNull()
      expect(incidents!.length).toBe(2)

      // Verified location mapped coordinates
      expect(incidents![0].map.x).toBe(640.5)
      expect(incidents![0].map.y).toBe(420.25)

      // Null location defaults to central theater grid coordinates (500, 300)
      expect(incidents![1].map.x).toBe(500)
      expect(incidents![1].map.y).toBe(300)
    })
  })

  // --------------------------------------------------------------------------
  // 6. Dashboard & Report Atomic Persistence
  // --------------------------------------------------------------------------
  describe('Dashboard & Report Atomic Persistence', () => {
    it('executes atomic dashboard persistence RPC successfully', async () => {
      const rpcSpy = vi.fn().mockResolvedValue({ data: true, error: null })
      const mockSupabase = {
        rpc: rpcSpy,
      } as unknown as typeof supabaseModule.supabase

      vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabase)
      vi.spyOn(supabaseModule, 'isBackendLive').mockReturnValue(true)

      const dashboard: Dashboard = {
        id: '22222222-3333-4444-5555-666666666666',
        name: 'Atomic Dashboard',
        description: 'Hardened save',
        owner: 'usr-owner-uuid',
        widgets: [
          {
            id: '33333333-4444-5555-6666-777777777777',
            title: 'Widget A',
            type: 'timeseries',
            datasetId: 'grid',
            x: 0,
            y: 0,
            w: 6,
            h: 4,
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const success = await backend.saveDashboard(dashboard)
      expect(success).toBe(true)
      expect(rpcSpy).toHaveBeenCalledWith('save_dashboard_atomic', expect.objectContaining({
        p_dashboard_id: '22222222-3333-4444-5555-666666666666',
        p_name: 'Atomic Dashboard',
      }))
    })

    it('reports failure when atomic dashboard persistence RPC fails', async () => {
      const rpcSpy = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'permission denied: analytics:edit' },
      })
      const mockSupabase = {
        rpc: rpcSpy,
      } as unknown as typeof supabaseModule.supabase

      vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabase)
      vi.spyOn(supabaseModule, 'isBackendLive').mockReturnValue(true)

      const dashboard: Dashboard = {
        id: '22222222-3333-4444-5555-666666666666',
        name: 'Dashboard Fail',
        description: 'Unauthorized edit',
        owner: 'usr-owner-uuid',
        widgets: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const success = await backend.saveDashboard(dashboard)
      expect(success).toBe(false)
      expect(backend.getStatus().error).toContain('permission denied: analytics:edit')
    })

    it('executes atomic report persistence RPC successfully', async () => {
      const rpcSpy = vi.fn().mockResolvedValue({ data: true, error: null })
      const mockSupabase = {
        rpc: rpcSpy,
      } as unknown as typeof supabaseModule.supabase

      vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabase)
      vi.spyOn(supabaseModule, 'isBackendLive').mockReturnValue(true)

      const report: Report = {
        id: '44444444-5555-6666-7777-888888888888',
        title: 'Intelligence Brief Alpha',
        template: 'intelligence_brief',
        classification: 'restricted',
        status: 'published',
        summary: 'Strategic analysis summary',
        author: 'usr-author-uuid',
        sharedWith: [],
        blocks: [
          {
            id: '55555555-6666-7777-8888-999999999999',
            type: 'paragraph',
            title: 'Section 1',
            body: 'Strategic observations',
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const success = await backend.saveReport(report)
      expect(success).toBe(true)
      expect(rpcSpy).toHaveBeenCalledWith('save_report_atomic', expect.objectContaining({
        p_report_id: '44444444-5555-6666-7777-888888888888',
        p_title: 'Intelligence Brief Alpha',
        p_classification: 'restricted',
      }))
    })

    it('reports failure when saving dashboard with widget belonging to another dashboard', async () => {
      const rpcSpy = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'permission denied: widget 99999999-9999-9999-9999-999999999999 belongs to another dashboard' },
      })
      const mockSupabase = {
        rpc: rpcSpy,
      } as unknown as typeof supabaseModule.supabase

      vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabase)
      vi.spyOn(supabaseModule, 'isBackendLive').mockReturnValue(true)

      const dashboard: Dashboard = {
        id: '22222222-3333-4444-5555-666666666666',
        name: 'Dashboard Exploit',
        description: 'Cross-dashboard widget overwrite attempt',
        owner: 'usr-owner-uuid',
        widgets: [
          {
            id: '99999999-9999-9999-9999-999999999999',
            title: 'Hijacked Widget',
            type: 'metric',
            datasetId: 'grid',
            x: 0,
            y: 0,
            w: 4,
            h: 2,
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const success = await backend.saveDashboard(dashboard)
      expect(success).toBe(false)
      expect(backend.getStatus().error).toContain('belongs to another dashboard')
    })

    it('reports failure when saving report with block belonging to another report', async () => {
      const rpcSpy = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'permission denied: report block 88888888-8888-8888-8888-888888888888 belongs to another report' },
      })
      const mockSupabase = {
        rpc: rpcSpy,
      } as unknown as typeof supabaseModule.supabase

      vi.spyOn(supabaseModule, 'supabase', 'get').mockReturnValue(mockSupabase)
      vi.spyOn(supabaseModule, 'isBackendLive').mockReturnValue(true)

      const report: Report = {
        id: '44444444-5555-6666-7777-888888888888',
        title: 'Report Exploit',
        template: 'intelligence_brief',
        classification: 'internal',
        status: 'draft',
        summary: 'Cross-report block overwrite attempt',
        author: 'usr-author-uuid',
        sharedWith: [],
        blocks: [
          {
            id: '88888888-8888-8888-8888-888888888888',
            type: 'paragraph',
            title: 'Hijacked Block',
            body: 'Unauthorized content modification',
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const success = await backend.saveReport(report)
      expect(success).toBe(false)
      expect(backend.getStatus().error).toContain('belongs to another report')
    })
  })

  // --------------------------------------------------------------------------
  // 7. Demo Mode Regression Guard
  // --------------------------------------------------------------------------
  describe('Demo Mode Regression Guard', () => {
    it('preserves all demo operators and clearance levels', () => {
      expect(DEMO_USERS.length).toBe(6)
      const elena = DEMO_USERS.find((u) => u.id === 'usr-elena')!
      expect(elena.roleId).toBe('analyst')
      expect(elena.clearance).toBe('L4 / SIGMA')

      const aris = DEMO_USERS.find((u) => u.id === 'usr-aris')!
      expect(aris.roleId).toBe('super_admin')
      expect(aris.clearance).toBe('L6 / ROOT')
    })

    it('permits demo operator identity switching in simulation mode', () => {
      const loginResult = useSessionStore.getState().loginAs('usr-aris')
      expect(loginResult.ok).toBe(true)
      expect(useSessionStore.getState().currentUserId).toBe('usr-aris')
      expect(useSessionStore.getState().isLiveAuthenticated).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // 8. Audited Rollback Script Static Security Verification (0004_rollback.sql)
  // --------------------------------------------------------------------------
  describe('Audited Rollback Script Static Security Verification (0004_rollback.sql)', () => {
    const sql = rollbackSql

    it('executes inside a safe transaction block with BEGIN and COMMIT', () => {
      expect(sql).toMatch(/^\s*BEGIN;/m)
      expect(sql).toMatch(/COMMIT;\s*$/m)
    })

    it('drops dependent RLS policies before dropping can_read_incident to prevent ERROR 2BP01', () => {
      const dropPoliciesIndex = sql.indexOf('DROP POLICY IF EXISTS "incident_assignments_select"')
      const dropFunctionIndex = sql.indexOf('DROP FUNCTION IF EXISTS public.can_read_incident')
      expect(dropPoliciesIndex).toBeGreaterThan(-1)
      expect(dropFunctionIndex).toBeGreaterThan(-1)
      expect(dropPoliciesIndex).toBeLessThan(dropFunctionIndex)
    })

    it('drops atomic RPCs using their exact parameter signatures', () => {
      expect(sql).toContain('DROP FUNCTION IF EXISTS public.save_dashboard_atomic(uuid, text, text, jsonb);')
      expect(sql).toContain('DROP FUNCTION IF EXISTS public.save_report_atomic(uuid, text, text, text, public.report_status, text, jsonb);')
      expect(sql).toContain('DROP FUNCTION IF EXISTS public.resolve_client_uuid(text, text);')
      expect(sql).toContain('DROP FUNCTION IF EXISTS public.can_read_incident(uuid);')
    })

    it('does not restore unrestricted USING (true) policies on operational tables', () => {
      expect(sql).not.toMatch(/ON\s+public\.incident_assignments\s+FOR\s+SELECT[^\n;]+USING\s*\(\s*true\s*\)/i)
      expect(sql).not.toMatch(/ON\s+public\.incident_events\s+FOR\s+SELECT[^\n;]+USING\s*\(\s*true\s*\)/i)
      expect(sql).not.toMatch(/ON\s+public\.incident_notes\s+FOR\s+SELECT[^\n;]+USING\s*\(\s*true\s*\)/i)
      expect(sql).not.toMatch(/ON\s+public\.incident_evidence\s+FOR\s+SELECT[^\n;]+USING\s*\(\s*true\s*\)/i)
    })

    it('restores all CRUD policies for incident assignments, notes, and evidence', () => {
      for (const op of ['select', 'insert', 'update', 'delete']) {
        expect(sql).toContain(`"incident_assignments_${op}"`)
        expect(sql).toContain(`"incident_notes_${op}"`)
        expect(sql).toContain(`"incident_evidence_${op}"`)
      }
    })

    it('keeps incident event history strictly append-only without client write policies', () => {
      expect(sql).toContain('CREATE POLICY "incident_events_select"')
      expect(sql).not.toContain('CREATE POLICY "incident_events_insert"')
      expect(sql).not.toContain('CREATE POLICY "incident_events_update"')
      expect(sql).not.toContain('CREATE POLICY "incident_events_delete"')
    })

    it('enforces lead profile existence, active status, and workspace membership in assignment RLS', () => {
      // Validates profiles lookup in INSERT and UPDATE
      expect(sql).toContain('EXISTS (\n              SELECT 1 FROM public.profiles p\n              WHERE p.id = incident_assignments.lead\n                AND p.status = \'active\'\n            )')
      expect(sql).toContain('EXISTS (\n                SELECT 1 FROM public.workspace_members wm\n                WHERE wm.workspace_id = i.workspace_id\n                  AND wm.user_id = incident_assignments.lead\n              )')
      // Permits unassigned teams (lead IS NULL)
      expect(sql).toContain('incident_assignments.lead IS NULL')
    })

    it('prevents author mutation during incident note updates', () => {
      // author = auth.uid() must be in both USING and WITH CHECK for incident_notes_update
      const updatePolicyRegex = /CREATE POLICY "incident_notes_update" ON public\.incident_notes\s+FOR UPDATE TO authenticated\s+USING \([\s\S]*?author = auth\.uid\(\)[\s\S]*?\)[\s\S]*?WITH CHECK \([\s\S]*?author = auth\.uid\(\)[\s\S]*?\);/m
      expect(sql).toMatch(updatePolicyRegex)
    })

    it('prevents added_by mutation during incident evidence updates', () => {
      // added_by = auth.uid() must be in both USING and WITH CHECK for incident_evidence_update
      const updateEvidenceRegex = /CREATE POLICY "incident_evidence_update" ON public\.incident_evidence\s+FOR UPDATE TO authenticated\s+USING \([\s\S]*?added_by = auth\.uid\(\)[\s\S]*?\)[\s\S]*?WITH CHECK \([\s\S]*?added_by = auth\.uid\(\)[\s\S]*?\);/m
      expect(sql).toMatch(updateEvidenceRegex)
    })

    it('enforces Option A: workspace-less incidents require view:incidents permission', () => {
      // Must not allow arbitrary unprivileged callers to view workspace-less incidents
      expect(sql).toContain('(i.workspace_id IS NULL AND public.has_permission(\'view:incidents\'))')
      expect(sql).toContain('IF NOT public.has_permission(\'view:incidents\') AND NOT public.is_super_admin() THEN\n      RAISE EXCEPTION \'permission denied: view:incidents required for global incident\';')
    })

    it('restores all CRUD policies for dashboards and dashboard_widgets', () => {
      for (const op of ['select', 'insert', 'update', 'delete']) {
        expect(sql).toContain(`"dashboards_${op}"`)
        expect(sql).toContain(`"dashboard_widgets_${op}"`)
      }
    })

    it('validates parent dashboard authorization on widget insert, update, and delete', () => {
      // Widget policies inherit from parent dashboard
      expect(sql).toContain('FROM public.dashboards d\n      WHERE d.id = dashboard_widgets.dashboard_id')
      // Validates update WITH CHECK against target dashboard_id
      const widgetUpdateRegex = /CREATE POLICY "dashboard_widgets_update" ON public\.dashboard_widgets[\s\S]*?WITH CHECK \([\s\S]*?WHERE d\.id = dashboard_widgets\.dashboard_id/m
      expect(sql).toMatch(widgetUpdateRegex)
    })

    it('restores all CRUD policies for reports and report_blocks', () => {
      for (const op of ['select', 'insert', 'update', 'delete']) {
        expect(sql).toContain(`"reports_${op}"`)
        expect(sql).toContain(`"report_blocks_${op}"`)
      }
    })

    it('protects restricted published reports from unintended global disclosure', () => {
      // Restricted reports must not be leaked even when status = 'published'
      expect(sql).toContain("classification != 'restricted'")
      expect(sql).toContain("status = 'published'")
    })

    it('validates parent report authorization on block insert, update, and delete', () => {
      expect(sql).toContain('FROM public.reports r\n      WHERE r.id = report_blocks.report_id')
      const blockUpdateRegex = /CREATE POLICY "report_blocks_update" ON public\.report_blocks[\s\S]*?WITH CHECK \([\s\S]*?WHERE r\.id = report_blocks\.report_id/m
      expect(sql).toMatch(blockUpdateRegex)
    })

    it('restores auth signup trigger with original observer defaults and zero privilege escalation', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.handle_new_user()')
      expect(sql).toContain('CREATE TRIGGER on_auth_user_created')
      expect(sql).toContain('\'observer\'')
      expect(sql).toContain('\'Observer\'')
      expect(sql).toContain('\'L1\'')
      expect(sql).toContain('\'active\'')
      expect(sql).toContain('ON CONFLICT (id) DO NOTHING')
      expect(sql).toContain('ON CONFLICT (user_id) DO NOTHING')
    })

    it('restores assign_incident with lead profile existence, active status, and workspace validation', () => {
      expect(sql).toContain('SELECT status INTO v_lead_status')
      expect(sql).toContain('assigned lead profile does not exist')
      expect(sql).toContain('is not active')
      expect(sql).toContain('is not a member of incident workspace')
    })

    it('restores log_audit with actor binding and strict client action allowlist without admin:audit bypass', () => {
      const logAuditStart = sql.indexOf('FUNCTION public.log_audit')
      const logAuditEnd = sql.indexOf('$$;', logAuditStart) + 3
      const logAuditSection = sql.slice(logAuditStart, logAuditEnd)
      expect(logAuditSection).toContain('v_user := auth.uid();')
      expect(logAuditSection).toContain('Authentication required for audit logging.')
      expect(logAuditSection).toContain('Audit action cannot be null or empty.')
      expect(logAuditSection).toContain('Audit metadata must be a valid JSON object.')
      expect(logAuditSection).toContain('v_is_client_action')
      expect(logAuditSection).toContain('\'ui.interaction\'')
      expect(logAuditSection).toContain('\'dashboard.view\'')
      expect(logAuditSection).toContain('\'report.view\'')
      expect(logAuditSection).toContain('\'incident.view\'')
      expect(logAuditSection).toContain('\'telemetry.inspect\'')
      expect(logAuditSection).toContain('\'simulation.run\'')
      // Must NOT contain admin:audit bypass for arbitrary privileged actions
      expect(logAuditSection).not.toContain('public.has_permission(\'admin:audit\')')
    })

    it('preserves non-reversible data: dashboards.description and client_id_map are not dropped', () => {
      expect(sql).not.toContain('DROP COLUMN description')
      expect(sql).not.toContain('DROP TABLE public.client_id_map')
      expect(sql).toContain('"client_id_map_select"')
      expect(sql).toContain('"client_id_map_insert"')
    })

    it('restores parent incidents policies with Option A workspace-less protection', () => {
      expect(sql).toContain('CREATE POLICY "incidents_select" ON public.incidents')
      expect(sql).toContain('CREATE POLICY "incidents_insert" ON public.incidents')
      expect(sql).toContain('CREATE POLICY "incidents_update" ON public.incidents')
      expect(sql).toContain('CREATE POLICY "incidents_delete" ON public.incidents')
      expect(sql).toContain('(workspace_id IS NULL AND public.has_permission(\'view:incidents\'))')
    })

    it('restores assign_user_role with search_path protection, target validation, and no nonexistent columns', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.assign_user_role(')
      expect(sql).toContain('target user profile does not exist')
      expect(sql).toContain('unknown role')
      expect(sql).toContain('user.role.assign')
      // Regression guard: profiles table update must not reference nonexistent updated_at
      const assignRoleStart = sql.indexOf('FUNCTION public.assign_user_role')
      const assignRoleEnd = sql.indexOf('$$;', assignRoleStart) + 3
      const assignRoleBody = sql.slice(assignRoleStart, assignRoleEnd)
      expect(assignRoleBody).toMatch(/UPDATE\s+public\.profiles\s+SET\s+role_id\s*=\s*p_role\s+WHERE\s+id\s*=\s*p_user;/i)
      expect(assignRoleBody).not.toContain('updated_at')
    })

    it('enforces view security with security_invoker = true on v_operational_theater in rollback', () => {
      expect(sql).toContain('ALTER VIEW public.v_operational_theater SET (security_invoker = true);')
    })

    it('enforces explicit least-privilege grants and revokes in rollback', () => {
      expect(sql).toContain('REVOKE ALL ON TABLE public.client_id_map FROM PUBLIC, anon;')
      expect(sql).toContain('GRANT SELECT, INSERT ON TABLE public.client_id_map TO authenticated;')
      expect(sql).toContain('REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;')
      expect(sql).toContain('REVOKE ALL ON FUNCTION public.assign_user_role(uuid, text) FROM PUBLIC, anon;')
      expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.transition_incident(uuid, public.incident_status, text) TO authenticated;')
      expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.assign_incident(uuid, text, uuid) TO authenticated;')
      expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid, text) TO authenticated;')
      expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.log_audit(text, text, text, jsonb) TO authenticated;')
    })

    it('does not grant standalone admin:audit bypass for report or dashboard reading in rollback policies', () => {
      const reportsSelectMatch = sql.match(/CREATE POLICY "reports_select" ON public\.reports[\s\S]*?\);/m)
      expect(reportsSelectMatch).not.toBeNull()
      expect(reportsSelectMatch![0]).not.toContain("public.has_permission('admin:audit')")
      expect(reportsSelectMatch![0]).toContain("author = auth.uid()")
      expect(reportsSelectMatch![0]).toContain("auth.uid() = ANY(shared_with)")
      expect(reportsSelectMatch![0]).toContain("status = 'published'")
      expect(reportsSelectMatch![0]).toContain("classification != 'restricted'")
      expect(reportsSelectMatch![0]).toContain("public.is_super_admin()")

      const reportBlocksSelectMatch = sql.match(/CREATE POLICY "report_blocks_select" ON public\.report_blocks[\s\S]*?\);/m)
      expect(reportBlocksSelectMatch).not.toBeNull()
      expect(reportBlocksSelectMatch![0]).not.toContain("public.has_permission('admin:audit')")

      const dashboardsSelectMatch = sql.match(/CREATE POLICY "dashboards_select" ON public\.dashboards[\s\S]*?\);/m)
      expect(dashboardsSelectMatch).not.toBeNull()
      expect(dashboardsSelectMatch![0]).not.toContain("public.has_permission('admin:audit')")
      expect(dashboardsSelectMatch![0]).toContain("owner = auth.uid()")
      expect(dashboardsSelectMatch![0]).toContain("public.is_super_admin()")

      const dashboardWidgetsSelectMatch = sql.match(/CREATE POLICY "dashboard_widgets_select" ON public\.dashboard_widgets[\s\S]*?\);/m)
      expect(dashboardWidgetsSelectMatch).not.toBeNull()
      expect(dashboardWidgetsSelectMatch![0]).not.toContain("public.has_permission('admin:audit')")
    })
  })

  // --------------------------------------------------------------------------
  // 10. Migration 0004 Forward Security Hardening Script Audit
  // --------------------------------------------------------------------------
  describe('Migration 0004 Forward Security Hardening Script Audit', () => {
    const sql = hardeningSql

    it('executes inside a safe transaction block with BEGIN and COMMIT', () => {
      expect(sql).toMatch(/^\s*BEGIN;/m)
      expect(sql).toMatch(/COMMIT;\s*$/m)
    })

    it('seeds built-in roles and permissions idempotently without deleting custom mappings', () => {
      expect(sql).not.toContain('DELETE FROM public.role_permissions')
      expect(sql).toContain('ON CONFLICT (role_id, permission_id) DO NOTHING')
      expect(sql).toContain('Built-in permission catalog incomplete')
      expect(sql).toContain('Built-in role catalog incomplete')
      expect(sql).toContain('Built-in role permissions mapping verification failed')
    })

    it('explicitly drops vulnerable permissive policies from 0002 baseline', () => {
      expect(sql).toContain('DROP POLICY IF EXISTS "incidents readable" ON public.incidents;')
      expect(sql).toContain('DROP POLICY IF EXISTS "assignments readable" ON public.incident_assignments;')
      expect(sql).toContain('DROP POLICY IF EXISTS "incident events readable" ON public.incident_events;')
      expect(sql).toContain('DROP POLICY IF EXISTS "incident notes readable" ON public.incident_notes;')
      expect(sql).toContain('DROP POLICY IF EXISTS "evidence readable" ON public.incident_evidence;')
      expect(sql).toContain('DROP POLICY IF EXISTS "dashboards owned or shared" ON public.dashboards;')
      expect(sql).toContain('DROP POLICY IF EXISTS "reports readable" ON public.reports;')
    })

    it('replaces parent incidents policies with Option A workspace-less incident protection', () => {
      expect(sql).toContain('CREATE POLICY "incidents_select" ON public.incidents')
      expect(sql).toContain('CREATE POLICY "incidents_insert" ON public.incidents')
      expect(sql).toContain('CREATE POLICY "incidents_update" ON public.incidents')
      expect(sql).toContain('CREATE POLICY "incidents_delete" ON public.incidents')
      expect(sql).toContain('(workspace_id IS NULL AND public.has_permission(\'view:incidents\'))')
    })

    it('hardens incident assignments RLS with lead profile validation and workspace membership checks', () => {
      expect(sql).toContain('incident_assignments.lead IS NULL')
      expect(sql).toContain('WHERE p.id = incident_assignments.lead\n            AND p.status = \'active\'')
      expect(sql).toContain('WHERE wm.workspace_id = (SELECT workspace_id FROM public.incidents WHERE id = incident_assignments.incident_id)\n              AND wm.user_id = incident_assignments.lead')
    })

    it('hardens assign_incident with workspace-less checks and lead validation', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.assign_incident(')
      expect(sql).toContain('permission denied: view:incidents required for global incident')
      expect(sql).toContain('assigned lead profile does not exist')
      expect(sql).toContain('is not active')
      expect(sql).toContain('is not a member of incident workspace')
    })

    it('hardens transition_incident with workspace-less checks and strict state machine', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.transition_incident(')
      expect(sql).toContain('permission denied: view:incidents required for global incident')
      expect(sql).toContain('FOR UPDATE;')
      expect(sql).toContain('invalid incident transition')
    })

    it('hardens log_audit without admin:audit bypass for arbitrary privileged actions', () => {
      const logAuditStart = sql.indexOf('FUNCTION public.log_audit')
      const logAuditEnd = sql.indexOf('$$;', logAuditStart) + 3
      const logAuditSection = sql.slice(logAuditStart, logAuditEnd)
      expect(logAuditSection).toContain('v_user := auth.uid();')
      expect(logAuditSection).toContain('Audit action cannot be null or empty.')
      expect(logAuditSection).toContain('v_is_client_action')
      expect(logAuditSection).toContain('\'ui.interaction\'')
      expect(logAuditSection).toContain('\'dashboard.view\'')
      expect(logAuditSection).toContain('\'report.view\'')
      expect(logAuditSection).toContain('\'incident.view\'')
      expect(logAuditSection).toContain('\'telemetry.inspect\'')
      expect(logAuditSection).toContain('\'simulation.run\'')
      expect(logAuditSection).not.toContain('public.has_permission(\'admin:audit\')')
    })

    it('provides hardened assign_user_role function with search_path safety and no nonexistent columns', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.assign_user_role(')
      expect(sql).toContain('SET search_path = \'\'')
      expect(sql).toContain('permission denied: super administrator required')
      expect(sql).toContain('target user profile does not exist')
      expect(sql).toContain('user.role.assign')
      // Regression guard: profiles table update must not reference nonexistent updated_at
      const assignRoleStart = sql.indexOf('FUNCTION public.assign_user_role')
      const assignRoleEnd = sql.indexOf('$$;', assignRoleStart) + 3
      const assignRoleBody = sql.slice(assignRoleStart, assignRoleEnd)
      expect(assignRoleBody).toMatch(/UPDATE\s+public\.profiles\s+SET\s+role_id\s*=\s*p_role\s+WHERE\s+id\s*=\s*p_user;/i)
      expect(assignRoleBody).not.toContain('updated_at')
    })

    it('hardens reports and report blocks against unauthorized disclosure of restricted reports', () => {
      expect(sql).toContain("classification != 'restricted'")
      expect(sql).toContain("status = 'published'")
      expect(sql).toMatch(/workspace_id\s+IS\s+NULL[\s\S]*?public\.has_permission\('view:reports'\)/)
      expect(sql).toMatch(/workspace_id\s+IS\s+NOT\s+NULL[\s\S]*?public\.can_access_workspace\(workspace_id\)/)
    })

    it('validates widget and block IDs to prevent cross-dashboard or cross-report tampering in atomic RPCs', () => {
      // save_dashboard_atomic widget check
      expect(sql).toContain('WHERE id = v_widget_id AND dashboard_id != p_dashboard_id')
      expect(sql).toContain('permission denied: widget % belongs to another dashboard')

      // save_report_atomic block check
      expect(sql).toContain('WHERE id = v_block_id AND report_id != p_report_id')
      expect(sql).toContain('permission denied: report block % belongs to another report')
    })

    it('enforces security_invoker = true on v_operational_theater in forward migration', () => {
      expect(sql).toContain('ALTER VIEW public.v_operational_theater SET (security_invoker = true);')
    })

    it('enforces least-privilege function revokes and grants across all public RPCs', () => {
      expect(sql).toContain('REVOKE ALL ON FUNCTION public.assign_user_role(uuid, text) FROM PUBLIC, anon;')
      expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid, text) TO authenticated;')
      expect(sql).toContain('REVOKE ALL ON FUNCTION public.log_audit(text, text, text, jsonb) FROM PUBLIC, anon;')
      expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.log_audit(text, text, text, jsonb) TO authenticated;')
      expect(sql).toContain('REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;')
    })

    it('does not grant standalone admin:audit bypass for report or dashboard reading in forward migration policies and resolve_client_uuid', () => {
      // 1. resolve_client_uuid entity checks
      const resolveClientUuidStart = sql.indexOf('FUNCTION public.resolve_client_uuid')
      const resolveClientUuidEnd = sql.indexOf('$$;', resolveClientUuidStart) + 3
      const resolveClientUuidBody = sql.slice(resolveClientUuidStart, resolveClientUuidEnd)
      expect(resolveClientUuidBody).not.toContain("admin:audit")
      expect(resolveClientUuidBody).toContain("author = v_user")
      expect(resolveClientUuidBody).toContain("v_user = ANY(shared_with)")
      expect(resolveClientUuidBody).toContain("public.is_super_admin()")

      // 2. reports_select
      const reportsSelectMatch = sql.match(/CREATE POLICY "reports_select" ON public\.reports[\s\S]*?\);/m)
      expect(reportsSelectMatch).not.toBeNull()
      expect(reportsSelectMatch![0]).not.toContain("public.has_permission('admin:audit')")
      expect(reportsSelectMatch![0]).toContain("author = auth.uid()")
      expect(reportsSelectMatch![0]).toContain("auth.uid() = ANY(shared_with)")
      expect(reportsSelectMatch![0]).toContain("status = 'published'")
      expect(reportsSelectMatch![0]).toContain("classification != 'restricted'")
      expect(reportsSelectMatch![0]).toContain("public.is_super_admin()")

      // 3. report_blocks_select
      const reportBlocksSelectMatch = sql.match(/CREATE POLICY "report_blocks_select" ON public\.report_blocks[\s\S]*?\);/m)
      expect(reportBlocksSelectMatch).not.toBeNull()
      expect(reportBlocksSelectMatch![0]).not.toContain("public.has_permission('admin:audit')")

      // 4. dashboards_select
      const dashboardsSelectMatch = sql.match(/CREATE POLICY "dashboards_select" ON public\.dashboards[\s\S]*?\);/m)
      expect(dashboardsSelectMatch).not.toBeNull()
      expect(dashboardsSelectMatch![0]).not.toContain("public.has_permission('admin:audit')")
      expect(dashboardsSelectMatch![0]).toContain("owner = auth.uid()")
      expect(dashboardsSelectMatch![0]).toContain("public.is_super_admin()")

      // 5. dashboard_widgets_select
      const dashboardWidgetsSelectMatch = sql.match(/CREATE POLICY "dashboard_widgets_select" ON public\.dashboard_widgets[\s\S]*?\);/m)
      expect(dashboardWidgetsSelectMatch).not.toBeNull()
      expect(dashboardWidgetsSelectMatch![0]).not.toContain("public.has_permission('admin:audit')")
    })
  })

  // --------------------------------------------------------------------------
  // 11. Published Report Access Policy Matrix & Regression Verification
  // --------------------------------------------------------------------------
  describe('Published Report Access Policy Matrix & Regression Verification', () => {
    interface UserContext {
      userId: string
      permissions: string[]
      workspaces: string[]
      isSuperAdmin: boolean
    }

    interface ReportRow {
      id: string
      author: string
      shared_with: string[]
      status: 'draft' | 'review' | 'published' | 'archived'
      classification: 'internal' | 'restricted' | 'public'
      workspace_id: string | null
    }

    // Mathematical implementation of the SQL USING clause in reports_select:
    // author = auth.uid()
    // OR auth.uid() = ANY(shared_with)
    // OR (
    //   classification != 'restricted'
    //   AND (
    //     (
    //       status = 'published'
    //       AND workspace_id IS NULL
    //       AND public.has_permission('view:reports')
    //     )
    //     OR (
    //       workspace_id IS NOT NULL
    //       AND public.can_access_workspace(workspace_id)
    //     )
    //   )
    // )
    // OR public.is_super_admin()
    function canSelectReport(report: ReportRow, user: UserContext): boolean {
      const isAuthor = report.author === user.userId
      const isShared = report.shared_with.includes(user.userId)
      const canAccessWorkspace = Boolean(report.workspace_id && user.workspaces.includes(report.workspace_id))
      const hasViewReports = user.permissions.includes('view:reports')
      const isSuperAdmin = user.isSuperAdmin

      const nonRestrictedCondition =
        report.classification !== 'restricted' &&
        (
          (report.status === 'published' && report.workspace_id === null && hasViewReports) ||
          (report.workspace_id !== null && canAccessWorkspace)
        )

      return isAuthor || isShared || nonRestrictedCondition || isSuperAdmin
    }

    it('denies workspace member access to restricted reports in their workspace without author or shared access', () => {
      const user: UserContext = {
        userId: 'u-member',
        permissions: ['view:reports'],
        workspaces: ['ws-alpha'],
        isSuperAdmin: false,
      }
      const workspaceRestrictedReport: ReportRow = {
        id: 'rep-ws-alpha-restricted',
        author: 'u-other-author',
        shared_with: [],
        status: 'published',
        classification: 'restricted',
        workspace_id: 'ws-alpha',
      }
      expect(canSelectReport(workspaceRestrictedReport, user)).toBe(false)
    })

    it('allows workspace member to read non-restricted workspace report', () => {
      const user: UserContext = {
        userId: 'u-member',
        permissions: [],
        workspaces: ['ws-alpha'],
        isSuperAdmin: false,
      }
      const workspaceReport: ReportRow = {
        id: 'rep-ws-alpha-1',
        author: 'u-other',
        shared_with: [],
        status: 'published',
        classification: 'internal',
        workspace_id: 'ws-alpha',
      }
      expect(canSelectReport(workspaceReport, user)).toBe(true)
    })

    it('allows view:reports user to read a global published report', () => {
      const user: UserContext = {
        userId: 'u-analyst',
        permissions: ['view:reports'],
        workspaces: [],
        isSuperAdmin: false,
      }
      const globalPublishedReport: ReportRow = {
        id: 'rep-global-1',
        author: 'u-other',
        shared_with: [],
        status: 'published',
        classification: 'internal',
        workspace_id: null,
      }
      expect(canSelectReport(globalPublishedReport, user)).toBe(true)
    })

    it('denies view:reports user access to an unrelated workspace published report', () => {
      const user: UserContext = {
        userId: 'u-analyst',
        permissions: ['view:reports'],
        workspaces: ['ws-omega'],
        isSuperAdmin: false,
      }
      const unrelatedWorkspaceReport: ReportRow = {
        id: 'rep-ws-secret-1',
        author: 'u-other',
        shared_with: [],
        status: 'published',
        classification: 'internal',
        workspace_id: 'ws-secret',
      }
      expect(canSelectReport(unrelatedWorkspaceReport, user)).toBe(false)
    })

    it('allows workspace member to read their workspace published report', () => {
      const user: UserContext = {
        userId: 'u-member',
        permissions: [],
        workspaces: ['ws-alpha'],
        isSuperAdmin: false,
      }
      const workspaceReport: ReportRow = {
        id: 'rep-ws-alpha-1',
        author: 'u-other',
        shared_with: [],
        status: 'published',
        classification: 'internal',
        workspace_id: 'ws-alpha',
      }
      expect(canSelectReport(workspaceReport, user)).toBe(true)
    })

    it('denies unauthorized user access to restricted reports regardless of status or workspace', () => {
      const userWithViewPerms: UserContext = {
        userId: 'u-analyst',
        permissions: ['view:reports'],
        workspaces: [],
        isSuperAdmin: false,
      }
      const globalRestrictedPublishedReport: ReportRow = {
        id: 'rep-global-restricted',
        author: 'u-other',
        shared_with: [],
        status: 'published',
        classification: 'restricted',
        workspace_id: null,
      }
      expect(canSelectReport(globalRestrictedPublishedReport, userWithViewPerms)).toBe(false)

      const unrelatedWorkspaceUser: UserContext = {
        userId: 'u-external',
        permissions: ['view:reports'],
        workspaces: ['ws-other'],
        isSuperAdmin: false,
      }
      const workspaceRestrictedPublishedReport: ReportRow = {
        id: 'rep-ws-restricted',
        author: 'u-other',
        shared_with: [],
        status: 'published',
        classification: 'restricted',
        workspace_id: 'ws-secret',
      }
      expect(canSelectReport(workspaceRestrictedPublishedReport, unrelatedWorkspaceUser)).toBe(false)
    })

    it('preserves access for authors, shared users, and super administrators', () => {
      const author: UserContext = {
        userId: 'u-author',
        permissions: [],
        workspaces: [],
        isSuperAdmin: false,
      }
      const sharedUser: UserContext = {
        userId: 'u-shared',
        permissions: [],
        workspaces: [],
        isSuperAdmin: false,
      }
      const superAdmin: UserContext = {
        userId: 'u-admin',
        permissions: [],
        workspaces: [],
        isSuperAdmin: true,
      }

      const restrictedDraftReport: ReportRow = {
        id: 'rep-restricted-draft',
        author: 'u-author',
        shared_with: ['u-shared'],
        status: 'draft',
        classification: 'restricted',
        workspace_id: 'ws-private',
      }

      expect(canSelectReport(restrictedDraftReport, author)).toBe(true)
      expect(canSelectReport(restrictedDraftReport, sharedUser)).toBe(true)
      expect(canSelectReport(restrictedDraftReport, superAdmin)).toBe(true)
    })

    it('enforces equivalent access rules across forward migration reports_select, report_blocks_select, and resolve_client_uuid', () => {
      const sql = hardeningSql

      // 1. reports_select policy check
      const reportsPolicyMatch = sql.match(/CREATE POLICY "reports_select" ON public\.reports[\s\S]*?\);/m)
      expect(reportsPolicyMatch).not.toBeNull()
      expect(reportsPolicyMatch![0]).toContain("classification != 'restricted'")
      expect(reportsPolicyMatch![0]).toMatch(/workspace_id\s+IS\s+NULL[\s\S]*?public\.has_permission\('view:reports'\)/)
      expect(reportsPolicyMatch![0]).toMatch(/workspace_id\s+IS\s+NOT\s+NULL[\s\S]*?public\.can_access_workspace\(workspace_id\)/)

      // 2. report_blocks_select policy check
      const blocksPolicyMatch = sql.match(/CREATE POLICY "report_blocks_select" ON public\.report_blocks[\s\S]*?\);/m)
      expect(blocksPolicyMatch).not.toBeNull()
      expect(blocksPolicyMatch![0]).toContain("r.classification != 'restricted'")
      expect(blocksPolicyMatch![0]).toMatch(/r\.workspace_id\s+IS\s+NULL[\s\S]*?public\.has_permission\('view:reports'\)/)
      expect(blocksPolicyMatch![0]).toMatch(/r\.workspace_id\s+IS\s+NOT\s+NULL[\s\S]*?public\.can_access_workspace\(r\.workspace_id\)/)

      // 3. resolve_client_uuid function check
      const rpcStart = sql.indexOf('FUNCTION public.resolve_client_uuid')
      const rpcEnd = sql.indexOf('$$;', rpcStart) + 3
      const rpcBody = sql.slice(rpcStart, rpcEnd)
      expect(rpcBody).toContain("classification != 'restricted'")
      expect(rpcBody).toMatch(/workspace_id\s+IS\s+NULL[\s\S]*?public\.has_permission\('view:reports'\)/)
      expect(rpcBody).toMatch(/workspace_id\s+IS\s+NOT\s+NULL[\s\S]*?public\.can_access_workspace\(workspace_id\)/)
    })

    it('enforces equivalent access rules in rollback reports_select and report_blocks_select', () => {
      const sql = rollbackSql

      // 1. rollback reports_select policy check
      const reportsPolicyMatch = sql.match(/CREATE POLICY "reports_select" ON public\.reports[\s\S]*?\);/m)
      expect(reportsPolicyMatch).not.toBeNull()
      expect(reportsPolicyMatch![0]).toContain("classification != 'restricted'")
      expect(reportsPolicyMatch![0]).toMatch(/workspace_id\s+IS\s+NULL[\s\S]*?public\.has_permission\('view:reports'\)/)
      expect(reportsPolicyMatch![0]).toMatch(/workspace_id\s+IS\s+NOT\s+NULL[\s\S]*?public\.can_access_workspace\(workspace_id\)/)

      // 2. rollback report_blocks_select policy check
      const blocksPolicyMatch = sql.match(/CREATE POLICY "report_blocks_select" ON public\.report_blocks[\s\S]*?\);/m)
      expect(blocksPolicyMatch).not.toBeNull()
      expect(blocksPolicyMatch![0]).toContain("r.classification != 'restricted'")
      expect(blocksPolicyMatch![0]).toMatch(/r\.workspace_id\s+IS\s+NULL[\s\S]*?public\.has_permission\('view:reports'\)/)
      expect(blocksPolicyMatch![0]).toMatch(/r\.workspace_id\s+IS\s+NOT\s+NULL[\s\S]*?public\.can_access_workspace\(r\.workspace_id\)/)
    })
  })
})
