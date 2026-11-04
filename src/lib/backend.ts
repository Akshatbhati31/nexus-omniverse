import { isSupabaseConfigured, supabase } from './supabase'
import type {
  Entity,
  Incident,
  Report,
  Dashboard,
} from '../types'

export interface BackendSyncStatus {
  connected: boolean
  lastSyncAt: string | null
  provider: 'supabase' | 'local'
  error?: string
}

/**
 * Service adapter managing unified storage, persistence, and synchronization.
 * Supports both local versioned cache and live Supabase queries seamlessly.
 */
class BackendAdapter {
  private status: BackendSyncStatus = {
    connected: isSupabaseConfigured(),
    lastSyncAt: null,
    provider: isSupabaseConfigured() ? 'supabase' : 'local',
  }

  getStatus(): BackendSyncStatus {
    return { ...this.status }
  }

  // --- ENTITIES & LOCATIONS ---
  async fetchEntities(): Promise<Entity[] | null> {
    if (!supabase) return null
    try {
      const { data, error } = await supabase
        .from('entities')
        .select('*, vitals:attributes->vitals, relations:entity_relations(*)')
      if (error) throw error
      this.status.lastSyncAt = new Date().toISOString()
      return data as unknown as Entity[]
    } catch (err: unknown) {
      console.warn('Backend sync: fetchEntities fallback to cache', err)
      this.status.error = (err as Error).message
      return null
    }
  }

  // --- INCIDENTS & TRANSITIONS ---
  async fetchIncidents(): Promise<Incident[] | null> {
    if (!supabase) return null
    try {
      const { data, error } = await supabase
        .from('incidents')
        .select('*, timeline:incident_events(*), notes:incident_notes(*), evidence:incident_evidence(*)')
        .order('detected_at', { ascending: false })
      if (error) throw error
      this.status.lastSyncAt = new Date().toISOString()
      return data as unknown as Incident[]
    } catch (err: unknown) {
      console.warn('Backend sync: fetchIncidents fallback to cache', err)
      return null
    }
  }

  async persistIncidentTransition(incidentId: string, nextStatus: string, detail: string): Promise<boolean> {
    if (!supabase) return false
    try {
      const { error } = await supabase.rpc('transition_incident', {
        p_incident: incidentId,
        p_next: nextStatus,
        p_detail: detail,
      })
      if (error) throw error
      return true
    } catch (err: unknown) {
      console.warn('Backend RPC: transition_incident fallback to local ledger', err)
      return false
    }
  }

  async persistIncidentAssignment(incidentId: string, team: string, leadId?: string): Promise<boolean> {
    if (!supabase) return false
    try {
      const { error } = await supabase.rpc('assign_incident', {
        p_incident: incidentId,
        p_team: team,
        p_lead: leadId ?? null,
      })
      if (error) throw error
      return true
    } catch (err: unknown) {
      console.warn('Backend RPC: assign_incident fallback to local ledger', err)
      return false
    }
  }

  // --- AUDIT LOGS ---
  async persistAuditLog(action: string, targetType: string, targetId: string, metadata?: Record<string, string>): Promise<boolean> {
    if (!supabase) return false
    try {
      const { error } = await supabase.rpc('log_audit', {
        p_action: action,
        p_target_type: targetType,
        p_target_id: targetId,
        p_metadata: metadata ?? {},
      })
      if (error) throw error
      return true
    } catch (err: unknown) {
      console.warn('Backend RPC: log_audit fallback to local state', err)
      return false
    }
  }

  // --- REPORTS & BLOCKS ---
  async fetchReports(): Promise<Report[] | null> {
    if (!supabase) return null
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*, blocks:report_blocks(*)')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data as unknown as Report[]
    } catch (err: unknown) {
      console.warn('Backend sync: fetchReports fallback to cache', err)
      return null
    }
  }

  async saveReport(report: Report): Promise<boolean> {
    if (!supabase) return false
    try {
      const { error } = await supabase.from('reports').upsert({
        id: report.id,
        title: report.title,
        template: report.template,
        classification: report.classification,
        status: report.status,
        summary: report.summary,
        author: report.author,
        shared_with: report.sharedWith,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      return true
    } catch (err: unknown) {
      console.warn('Backend sync: saveReport fallback to local state', err)
      return false
    }
  }

  // --- DASHBOARDS & WIDGETS ---
  async fetchDashboards(): Promise<Dashboard[] | null> {
    if (!supabase) return null
    try {
      const { data, error } = await supabase
        .from('dashboards')
        .select('*, widgets:dashboard_widgets(*)')
      if (error) throw error
      return data as unknown as Dashboard[]
    } catch (err: unknown) {
      console.warn('Backend sync: fetchDashboards fallback to cache', err)
      return null
    }
  }

  async saveDashboard(dashboard: Dashboard): Promise<boolean> {
    if (!supabase) return false
    try {
      const { error } = await supabase.from('dashboards').upsert({
        id: dashboard.id,
        name: dashboard.name,
        description: dashboard.description,
        owner: dashboard.owner,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      return true
    } catch (err: unknown) {
      console.warn('Backend sync: saveDashboard fallback to local state', err)
      return false
    }
  }

  // --- REAL-TIME SUBSCRIPTIONS ---
  subscribeToIncidents(callback: (payload: unknown) => void): (() => void) | null {
    const client = supabase
    if (!client) return null
    try {
      const channel = client
        .channel('public:incidents')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, (payload) => {
          callback(payload)
        })
        .subscribe()
      return () => {
        client.removeChannel(channel)
      }
    } catch (err) {
      console.warn('Realtime subscription error', err)
      return null
    }
  }
}

export const backend = new BackendAdapter()
