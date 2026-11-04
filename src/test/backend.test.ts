import { describe, it, expect, vi } from 'vitest'
import { isSupabaseConfigured, isBackendLive, supabase } from '../lib/supabase'
import { backend } from '../lib/backend'

describe('Backend Integration & Persistence Adapter', () => {
  it('detects Supabase environment configuration correctly', () => {
    // In local demo environment with empty env variables
    expect(isSupabaseConfigured()).toBe(false)
    expect(isBackendLive()).toBe(false)
    expect(supabase).toBeNull()
  })

  it('provides a valid BackendAdapter status', () => {
    const status = backend.getStatus()
    expect(status).toHaveProperty('connected')
    expect(status).toHaveProperty('provider')
    expect(['supabase', 'local']).toContain(status.provider)
  })

  it('gracefully handles incident state transition persistence in offline/fallback mode', async () => {
    const success = await backend.persistIncidentTransition('inc-test', 'mitigating', 'Automated mitigation verified')
    // In fallback demo mode without live Supabase RPC, returns false without throwing
    expect(success).toBe(false)
  })

  it('gracefully handles assignment persistence in offline/fallback mode', async () => {
    const success = await backend.persistIncidentAssignment('inc-test', 'Cybersecurity Division')
    expect(success).toBe(false)
  })

  it('gracefully handles audit log persistence in offline/fallback mode', async () => {
    const success = await backend.persistAuditLog('incident.test', 'incident', 'INC-100', { origin: 'vitest' })
    expect(success).toBe(false)
  })

  it('returns null safely when querying unconfigured remote tables', async () => {
    const entities = await backend.fetchEntities()
    expect(entities).toBeNull()

    const incidents = await backend.fetchIncidents()
    expect(incidents).toBeNull()

    const reports = await backend.fetchReports()
    expect(reports).toBeNull()

    const dashboards = await backend.fetchDashboards()
    expect(dashboards).toBeNull()
  })

  it('safely handles real-time subscriptions when backend is offline', () => {
    const callback = vi.fn()
    const unsubscribe = backend.subscribeToIncidents(callback)
    expect(unsubscribe).toBeNull()
    expect(callback).not.toHaveBeenCalled()
  })
})

