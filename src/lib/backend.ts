import { isBackendLive, isSupabaseConfigured, supabase } from './supabase'
import type {
  Entity,
  Relation,
  Vital,
  Incident,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  IncidentTimelineEntry,
  IncidentNote,
  Evidence,
  Report,
  ReportBlock,
  Dashboard,
  DashboardWidget,
  WidgetType,
  ReportBlockType,
} from '../types'

export interface BackendSyncStatus {
  connected: boolean
  lastSyncAt: string | null
  provider: 'supabase' | 'local'
  error?: string
}

export const VALID_ENTITY_TYPES = [
  'incident',
  'dashboard',
  'dashboard_widget',
  'report',
  'report_block',
  'entity',
  'location',
] as const

export type ValidEntityType = typeof VALID_ENTITY_TYPES[number]

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// In-memory cache for resolved client-to-database UUID mappings
const clientUuidCache = new Map<string, string>()

function extractErrorMessage(err: unknown, defaultMessage: string): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message
  }
  return defaultMessage
}

/**
 * Resolves a frontend client identifier to a database UUID.
 * In live mode:
 * - If already a standard UUID, returns it.
 * - Otherwise calls RPC `resolve_client_uuid`.
 * - FAILS CLOSED if live RPC fails: never falls back to synthetic or weak hashes in live mode.
 * - Reject entity type 'profile': Profiles belong to auth.users and public.profiles.
 * In offline/demo mode:
 * - Retains client ID safely for local ledger without sending to Supabase.
 */
export async function resolveClientUuid(clientId: string, entityType: string): Promise<string> {
  if (!clientId || clientId.trim() === '') {
    throw new Error('Invalid client identifier: ID cannot be empty.')
  }

  if (entityType === 'profile') {
    throw new Error("Security violation: 'profile' cannot be resolved via client_id_map. Use verified profile UUIDs.")
  }

  if (!VALID_ENTITY_TYPES.includes(entityType as ValidEntityType)) {
    throw new Error(`Security violation: Invalid entity type '${entityType}' for UUID resolution.`)
  }

  // If already a valid RFC 4122 UUID, return directly
  if (UUID_REGEX.test(clientId)) {
    return clientId
  }

  const cacheKey = `${entityType}:${clientId}`
  if (clientUuidCache.has(cacheKey)) {
    return clientUuidCache.get(cacheKey)!
  }

  if (isBackendLive() && supabase) {
    const { data, error } = await supabase.rpc('resolve_client_uuid', {
      p_client_id: clientId,
      p_entity_type: entityType,
    })

    if (error || !data) {
      const errorMsg = error ? error.message : 'No UUID returned from database resolver.'
      throw new Error(`Live UUID mapping failed for ${entityType} '${clientId}': ${errorMsg}`)
    }

    const resolved = data as string
    clientUuidCache.set(cacheKey, resolved)
    return resolved
  }

  // Offline / Demo Mode: Keep deterministic string for mock fixtures, NEVER pass to live database
  return clientId
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
    if (!supabase || !isBackendLive()) return null
    try {
      // Query with explicit foreign keys to resolve PostgREST ambiguity for source and target relations
      const { data, error } = await supabase
        .from('entities')
        .select(`
          *,
          outgoing_relations:entity_relations!source_id(*),
          incoming_relations:entity_relations!target_id(*)
        `)

      if (error) throw error

      this.status.lastSyncAt = new Date().toISOString()

      // Strongly-typed deserialization without unsafe direct casting
      const entities: Entity[] = (data || []).map((row: Record<string, unknown>) => {
        const outgoing = (row.outgoing_relations as Array<Record<string, unknown>>) || []
        const incoming = (row.incoming_relations as Array<Record<string, unknown>>) || []

        const relations: Relation[] = [
          ...outgoing.map((r) => ({
            targetId: String(r.target_id),
            type: String(r.relation_type),
            strength: Number(r.strength) || 0.5,
          })),
          ...incoming.map((r) => ({
            targetId: String(r.source_id),
            type: `incoming:${String(r.relation_type)}`,
            strength: Number(r.strength) || 0.5,
          })),
        ]

        const rawAttrs = (row.attributes as Record<string, unknown>) || {}
        const rawVitals = Array.isArray(rawAttrs.vitals) ? rawAttrs.vitals : []

        const vitals: Vital[] = rawVitals.map((v: Record<string, unknown>) => ({
          label: String(v.label || 'Metric'),
          value: Number(v.value) || 0,
          unit: String(v.unit || ''),
          delta: Number(v.delta) || 0,
          format: (v.format as Vital['format']) || 'number',
        }))

        const stringAttrs: Record<string, string> = {}
        for (const [key, val] of Object.entries(rawAttrs)) {
          if (key !== 'vitals' && typeof val === 'string') {
            stringAttrs[key] = val
          }
        }

        return {
          id: String(row.id),
          name: String(row.name || 'Unnamed Asset'),
          code: String(row.code || 'UNKNOWN'),
          kind: (row.kind as Entity['kind']) || 'facility',
          parentId: row.parent_id ? String(row.parent_id) : undefined,
          districtId: row.workspace_id ? String(row.workspace_id) : undefined,
          status: (row.status as Entity['status']) || 'operational',
          criticality: (row.criticality as Entity['criticality']) || 'moderate',
          description: String(row.description || ''),
          tags: Array.isArray(rawAttrs.tags) ? (rawAttrs.tags as string[]) : [],
          vitals,
          attributes: stringAttrs,
          relations,
          timeline: [],
          notes: [],
          updatedAt: (row.updated_at as string) || new Date().toISOString(),
        }
      })

      return entities
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown entity fetch error'
      console.warn('Backend sync: fetchEntities fallback to cache', message)
      this.status.error = message
      return null
    }
  }

  // --- INCIDENTS & TRANSITIONS ---
  async fetchIncidents(): Promise<Incident[] | null> {
    if (!supabase || !isBackendLive()) return null
    try {
      const { data, error } = await supabase
        .from('incidents')
        .select(`
          *,
          timeline:incident_events(*),
          notes:incident_notes(*),
          evidence:incident_evidence(*),
          assignments:incident_assignments(*),
          location:locations(id, name, map_x, map_y, latitude, longitude)
        `)
        .order('detected_at', { ascending: false })

      if (error) throw error
      this.status.lastSyncAt = new Date().toISOString()

      // Strict deserialization: Link actual location coordinates or default central theater grid
      const incidents: Incident[] = (data || []).map((row: Record<string, unknown>) => {
        const rawEvents = (row.timeline as Array<Record<string, unknown>>) || []
        const rawNotes = (row.notes as Array<Record<string, unknown>>) || []
        const rawEvidence = (row.evidence as Array<Record<string, unknown>>) || []
        const rawAssignments = (row.assignments as Array<Record<string, unknown>>) || []

        const timeline: IncidentTimelineEntry[] = rawEvents.map((evt) => ({
          id: String(evt.id),
          at: String(evt.created_at || new Date().toISOString()),
          kind: (evt.event_type as IncidentTimelineEntry['kind']) || 'status',
          title: `Status: ${String(evt.to_status || evt.event_type || 'updated')}`,
          detail: String(evt.detail || ''),
          actor: evt.actor ? String(evt.actor) : undefined,
          from: (evt.from_status as IncidentStatus) || undefined,
          to: (evt.to_status as IncidentStatus) || undefined,
        }))

        const notes: IncidentNote[] = rawNotes.map((n) => ({
          id: String(n.id),
          author: n.author ? String(n.author) : 'Unknown Author',
          body: String(n.body || ''),
          createdAt: String(n.created_at || new Date().toISOString()),
        }))

        const evidence: Evidence[] = rawEvidence.map((e) => ({
          id: String(e.id),
          label: String(e.label || 'Evidence Item'),
          kind: (e.kind as Evidence['kind']) || 'document',
          reference: String(e.storage_path || e.external_url || ''),
          addedBy: e.added_by ? String(e.added_by) : 'Unknown',
          addedAt: String(e.created_at || new Date().toISOString()),
        }))

        const teams = rawAssignments
          .map((a) => (typeof a.team === 'string' ? a.team.trim() : ''))
          .filter(Boolean)

        const loc = row.location as Record<string, unknown> | null
        const rawX = loc?.map_x
        const rawY = loc?.map_y
        const parsedX = typeof rawX === 'number' ? rawX : (typeof rawX === 'string' ? parseFloat(rawX) : 500)
        const parsedY = typeof rawY === 'number' ? rawY : (typeof rawY === 'string' ? parseFloat(rawY) : 300)

        const mapCoordinates = {
          x: Number.isFinite(parsedX) ? parsedX : 500,
          y: Number.isFinite(parsedY) ? parsedY : 300,
        }

        return {
          id: String(row.id),
          reference: String(row.reference || 'INC-LIVE'),
          title: String(row.title || 'Untitled Incident'),
          category: (row.category as IncidentCategory) || 'infrastructure_failure',
          severity: (row.severity as IncidentSeverity) || 'moderate',
          status: (row.status as IncidentStatus) || 'detected',
          districtId: row.workspace_id ? String(row.workspace_id) : (row.location_id ? String(row.location_id) : ''),
          primaryEntityId: row.primary_entity_id ? String(row.primary_entity_id) : '',
          relatedEntityIds: [],
          commander: row.commander ? String(row.commander) : 'Unassigned',
          teams,
          summary: String(row.summary || ''),
          confidence: typeof row.confidence === 'number' ? row.confidence : 0,
          impactScore: typeof row.impact_score === 'number' ? row.impact_score : 0,
          detectedAt: String(row.detected_at || new Date().toISOString()),
          updatedAt: String(row.updated_at || new Date().toISOString()),
          resolvedAt: row.resolved_at ? String(row.resolved_at) : undefined,
          resolution: row.resolution ? String(row.resolution) : undefined,
          timeline,
          notes,
          evidence,
          map: mapCoordinates,
        }
      })

      return incidents
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown incident fetch error'
      console.warn('Backend sync: fetchIncidents fallback to cache', message)
      this.status.error = message
      return null
    }
  }

  async persistIncidentTransition(incidentId: string, nextStatus: string, detail: string): Promise<boolean> {
    if (!supabase || !isBackendLive()) return false
    try {
      const resolvedIncidentId = await resolveClientUuid(incidentId, 'incident')
      const { error } = await supabase.rpc('transition_incident', {
        p_incident: resolvedIncidentId,
        p_next: nextStatus,
        p_detail: detail,
      })

      if (error) throw error
      return true
    } catch (err: unknown) {
      const message = extractErrorMessage(err, 'Incident transition failed')
      console.warn('Backend RPC: transition_incident error:', message)
      this.status.error = message
      return false
    }
  }

  async persistIncidentAssignment(incidentId: string, team: string, leadId?: string): Promise<boolean> {
    if (!supabase || !isBackendLive()) return false
    try {
      const resolvedIncidentId = await resolveClientUuid(incidentId, 'incident')

      let validatedLeadUuid: string | null = null
      if (leadId) {
        if (!UUID_REGEX.test(leadId)) {
          throw new Error(`Assigned lead ID '${leadId}' must be an existing profile UUID. Profiles cannot use synthetic client IDs.`)
        }
        // Verify profile exists in public.profiles and is active
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, status')
          .eq('id', leadId)
          .maybeSingle()

        if (profileError || !profileData) {
          throw new Error(`Assigned lead profile '${leadId}' does not exist: ${profileError?.message || 'Profile not found'}`)
        }

        if (profileData.status !== 'active') {
          throw new Error(`Assigned lead profile '${leadId}' is not active (current status: ${profileData.status}).`)
        }

        validatedLeadUuid = profileData.id as string
      }

      const { error } = await supabase.rpc('assign_incident', {
        p_incident: resolvedIncidentId,
        p_team: team,
        p_lead: validatedLeadUuid,
      })

      if (error) throw error
      return true
    } catch (err: unknown) {
      const message = extractErrorMessage(err, 'Incident assignment failed')
      console.warn('Backend RPC: assign_incident error:', message)
      this.status.error = message
      return false
    }
  }

  // --- AUDIT LOGS ---
  async persistAuditLog(action: string, targetType: string, targetId: string, metadata?: Record<string, string>): Promise<boolean> {
    if (!supabase || !isBackendLive()) return false
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
      const message = extractErrorMessage(err, 'Audit log emission failed')
      console.warn('Backend RPC: log_audit error:', message)
      this.status.error = message
      return false
    }
  }

  // --- REPORTS & BLOCKS (ATOMIC PERSISTENCE) ---
  async fetchReports(): Promise<Report[] | null> {
    if (!supabase || !isBackendLive()) return null
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*, blocks:report_blocks(*)')
        .order('updated_at', { ascending: false })

      if (error) throw error

      const reports: Report[] = (data || []).map((row: Record<string, unknown>) => {
        const rawBlocks = (row.blocks as Array<Record<string, unknown>>) || []
        rawBlocks.sort((a, b) => Number(a.position || 0) - Number(b.position || 0))

        const blocks: ReportBlock[] = rawBlocks.map((b) => {
          const content = (b.content as Record<string, unknown>) || {}
          return {
            id: String(b.id),
            type: (b.block_type as ReportBlockType) || 'paragraph',
            title: typeof content.title === 'string' ? content.title : undefined,
            body: typeof content.body === 'string' ? content.body : undefined,
            chartId: typeof content.chartId === 'string' ? content.chartId : undefined,
            entityIds: Array.isArray(content.entityIds) ? (content.entityIds as string[]) : undefined,
            metrics: Array.isArray(content.metrics) ? (content.metrics as ReportBlock['metrics']) : undefined,
            table: typeof content.table === 'object' && content.table !== null ? (content.table as ReportBlock['table']) : undefined,
          }
        })

        return {
          id: String(row.id),
          title: String(row.title || 'Untitled Report'),
          template: String(row.template || 'intelligence_brief'),
          classification: (row.classification as Report['classification']) || 'internal',
          status: (row.status as Report['status']) || 'draft',
          summary: String(row.summary || ''),
          author: row.author ? String(row.author) : 'Unknown Author',
          sharedWith: Array.isArray(row.shared_with) ? (row.shared_with as string[]) : [],
          blocks,
          createdAt: String(row.created_at || new Date().toISOString()),
          updatedAt: String(row.updated_at || new Date().toISOString()),
        }
      })

      return reports
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown report fetch error'
      console.warn('Backend sync: fetchReports error:', message)
      this.status.error = message
      return null
    }
  }

  async saveReport(report: Report): Promise<boolean> {
    if (!supabase || !isBackendLive()) return false
    try {
      const dbReportId = await resolveClientUuid(report.id, 'report')

      const blockRows = await Promise.all(
        (report.blocks || []).map(async (block, index) => ({
          id: await resolveClientUuid(block.id, 'report_block'),
          position: index,
          block_type: block.type || 'paragraph',
          content: {
            title: block.title,
            body: block.body,
            chartId: block.chartId,
            entityIds: block.entityIds,
            metrics: block.metrics,
            table: block.table,
          },
        }))
      )

      const { error } = await supabase.rpc('save_report_atomic', {
        p_report_id: dbReportId,
        p_title: report.title,
        p_template: report.template,
        p_classification: report.classification,
        p_status: report.status,
        p_summary: report.summary || '',
        p_blocks: blockRows,
      })

      if (error) throw error
      return true
    } catch (err: unknown) {
      const message = extractErrorMessage(err, 'Report persistence failed')
      console.warn('Backend sync: saveReport error:', message)
      this.status.error = message
      return false
    }
  }

  // --- DASHBOARDS & WIDGETS (ATOMIC PERSISTENCE) ---
  async fetchDashboards(): Promise<Dashboard[] | null> {
    if (!supabase || !isBackendLive()) return null
    try {
      const { data, error } = await supabase
        .from('dashboards')
        .select('*, widgets:dashboard_widgets(*)')

      if (error) throw error

      const dashboards: Dashboard[] = (data || []).map((row: Record<string, unknown>) => {
        const rawWidgets = (row.widgets as Array<Record<string, unknown>>) || []

        const widgets: DashboardWidget[] = rawWidgets.map((w) => {
          const pos = (w.position as Record<string, number>) || {}
          const cfg = (w.config as Record<string, string>) || {}

          return {
            id: String(w.id),
            title: String(w.title || 'Widget'),
            type: (w.widget_type as WidgetType) || 'timeseries',
            datasetId: cfg.datasetId || 'traffic-flow',
            metricLabel: cfg.metricLabel,
            metricValue: cfg.metricValue,
            x: Number(pos.x ?? 0),
            y: Number(pos.y ?? 0),
            w: Number(pos.w ?? 6),
            h: Number(pos.h ?? 4),
          }
        })

        return {
          id: String(row.id),
          name: String(row.name || 'Untitled Dashboard'),
          description: String(row.description || ''),
          owner: row.owner ? String(row.owner) : 'Operator',
          widgets,
          createdAt: String(row.created_at || new Date().toISOString()),
          updatedAt: String(row.updated_at || new Date().toISOString()),
        }
      })

      return dashboards
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown dashboard fetch error'
      console.warn('Backend sync: fetchDashboards error:', message)
      this.status.error = message
      return null
    }
  }

  async saveDashboard(dashboard: Dashboard): Promise<boolean> {
    if (!supabase || !isBackendLive()) return false
    try {
      const dbDashboardId = await resolveClientUuid(dashboard.id, 'dashboard')

      const widgetRows = await Promise.all(
        (dashboard.widgets || []).map(async (widget) => ({
          id: await resolveClientUuid(widget.id, 'dashboard_widget'),
          title: widget.title || 'Widget',
          widget_type: widget.type || 'timeseries',
          config: {
            datasetId: widget.datasetId || 'traffic-flow',
            metricLabel: widget.metricLabel || '',
            metricValue: widget.metricValue || '',
          },
          position: {
            x: widget.x ?? 0,
            y: widget.y ?? 0,
            w: widget.w ?? 6,
            h: widget.h ?? 4,
          },
        }))
      )

      const { error } = await supabase.rpc('save_dashboard_atomic', {
        p_dashboard_id: dbDashboardId,
        p_name: dashboard.name,
        p_description: dashboard.description || '',
        p_widgets: widgetRows,
      })

      if (error) throw error
      return true
    } catch (err: unknown) {
      const message = extractErrorMessage(err, 'Dashboard persistence failed')
      console.warn('Backend sync: saveDashboard error:', message)
      this.status.error = message
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
