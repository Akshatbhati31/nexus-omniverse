import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AuditLog,
  ChatMessage,
  Conversation,
  Dashboard,
  EntityNote,
  Evidence,
  Incident,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  NexusNotification,
  NotificationPreferences,
  Permission,
  Report,
  ReportBlock,
  SimulationKind,
  SimulationParameters,
  SimulationResult,
  SimulationRun,
} from '../types'
import { AUDIT_LOGS, CONVERSATIONS, DASHBOARDS, NOTIFICATIONS, REPORTS, SIMULATIONS } from '../data/platformSeed'
import { ENTITIES } from '../data/entities'
import { INCIDENTS } from '../data/incidents'
import { canTransitionIncident } from '../lib/incidents'
import { uid } from '../lib/utils'
import { backend } from '../lib/backend'
import { authorize } from './useSessionStore'

export interface ActionResult {
  ok: boolean
  message?: string
  id?: string
}

export interface NewIncidentInput {
  title: string
  category: IncidentCategory
  severity: IncidentSeverity
  districtId: string
  primaryEntityId: string
  summary: string
}

interface PlatformState {
  entities: typeof ENTITIES
  incidents: Incident[]
  notifications: NexusNotification[]
  reports: Report[]
  simulations: SimulationRun[]
  conversations: Conversation[]
  dashboards: Dashboard[]
  auditLogs: AuditLog[]
  notificationPreferences: NotificationPreferences
  transitionIncident: (id: string, next: IncidentStatus, detail?: string) => ActionResult
  assignIncident: (id: string, team: string) => ActionResult
  addIncidentNote: (id: string, body: string) => ActionResult
  addIncidentEvidence: (id: string, evidence: Omit<Evidence, 'id' | 'addedAt' | 'addedBy'>) => ActionResult
  setIncidentResolution: (id: string, resolution: string) => ActionResult
  createIncident: (input: NewIncidentInput) => ActionResult
  addEntityNote: (entityId: string, body: string) => ActionResult
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  updateNotificationPreferences: (patch: Partial<NotificationPreferences>) => void
  saveSimulation: (input: {
    name: string
    kind: SimulationKind
    parameters: SimulationParameters
    result: SimulationResult
  }) => ActionResult
  deleteSimulation: (id: string) => ActionResult
  createDashboard: (name: string) => ActionResult
  saveDashboard: (dashboard: Dashboard) => ActionResult
  deleteDashboard: (id: string) => ActionResult
  createReport: (template?: string) => ActionResult
  updateReport: (id: string, patch: Partial<Report>) => ActionResult
  addReportBlock: (id: string, block: ReportBlock) => ActionResult
  publishReport: (id: string) => ActionResult
  shareReport: (id: string, recipient: string) => ActionResult
  createConversation: () => ActionResult
  appendMessage: (conversationId: string, message: ChatMessage) => ActionResult
  renameConversation: (id: string, title: string) => ActionResult
  deleteConversation: (id: string) => ActionResult
  addAudit: (action: string, targetType: string, targetId: string, metadata?: Record<string, string>) => void
  resetPlatform: () => void
}

const nowIso = () => new Date().toISOString()

const defaultPreferences: NotificationPreferences = {
  incidentUpdates: true,
  assignments: true,
  simulations: true,
  workspaceActivity: true,
  systemAlerts: true,
  digestFrequency: 'realtime',
}

function permit(permission: Permission) {
  return authorize(permission)
}

function notificationAllowed(preferences: NotificationPreferences, category: NexusNotification['category']) {
  if (category === 'incident') return preferences.incidentUpdates
  if (category === 'assignment') return preferences.assignments
  if (category === 'simulation') return preferences.simulations
  if (category === 'workspace') return preferences.workspaceActivity
  if (category === 'system') return preferences.systemAlerts
  return true
}

function makeAudit(actor: string, action: string, targetType: string, targetId: string, metadata?: Record<string, string>): AuditLog {
  return {
    id: uid('aud'),
    actor,
    action,
    targetType,
    targetId,
    metadata,
    at: nowIso(),
  }
}

function makeNotification(
  title: string,
  body: string,
  category: NexusNotification['category'],
  priority: NexusNotification['priority'],
  href?: string,
): NexusNotification {
  return {
    id: uid('ntf'),
    title,
    body,
    category,
    priority,
    href,
    read: false,
    createdAt: nowIso(),
  }
}

export const usePlatformStore = create<PlatformState>()(
  persist(
    (set, get) => ({
      entities: ENTITIES,
      incidents: INCIDENTS,
      notifications: NOTIFICATIONS,
      reports: REPORTS,
      simulations: SIMULATIONS,
      conversations: CONVERSATIONS,
      dashboards: DASHBOARDS,
      auditLogs: AUDIT_LOGS,
      notificationPreferences: defaultPreferences,

      transitionIncident: (id, next, detail = '') => {
        const { user, allowed } = permit('incident:transition')
        if (!allowed || !user) return { ok: false, message: 'Your role cannot advance incident state.' }
        const incident = get().incidents.find((item) => item.id === id)
        if (!incident) return { ok: false, message: 'Incident not found.' }
        if (!canTransitionIncident(incident.status, next)) {
          return { ok: false, message: `Invalid transition: ${incident.status} → ${next}.` }
        }
        const timestamp = nowIso()
        const nextIncident: Incident = {
          ...incident,
          status: next,
          updatedAt: timestamp,
          resolvedAt: next === 'resolved' ? timestamp : incident.resolvedAt,
          resolution:
            next === 'resolved'
              ? detail || 'Stabilization confirmed by command. Residual risk under observation.'
              : incident.resolution,
          timeline: [
            ...incident.timeline,
            {
              id: uid('evt'),
              at: timestamp,
              kind: next === 'resolved' ? 'resolution' : 'status',
              title: `Status → ${next.charAt(0).toUpperCase()}${next.slice(1)}`,
              detail: detail || 'Workflow advanced by authorized command action.',
              actor: user.name,
              from: incident.status,
              to: next,
            },
          ],
        }
        set((state) => ({
          incidents: state.incidents.map((item) => (item.id === id ? nextIncident : item)),
          auditLogs: [makeAudit(user.name, 'incident.transition', 'incident', incident.reference, { to: next }), ...state.auditLogs],
          notifications: notificationAllowed(state.notificationPreferences, 'incident')
            ? [
                makeNotification(
                  `${incident.reference} → ${next.toUpperCase()}`,
                  `${incident.title} advanced to ${next}. ${detail}`.trim(),
                  'incident',
                  incident.severity === 'critical' ? 'critical' : 'high',
                  `/incidents/${incident.id}`,
                ),
                ...state.notifications,
              ]
            : state.notifications,
        }))
        // Asynchronously persist to Supabase if backend is configured
        void backend.persistIncidentTransition(id, next, detail)
        return { ok: true, message: `Incident advanced to ${next}.` }
      },

      assignIncident: (id, team) => {
        const { user, allowed } = permit('incident:assign')
        if (!allowed || !user) return { ok: false, message: 'Your role cannot assign response teams.' }
        const incident = get().incidents.find((item) => item.id === id)
        if (!incident) return { ok: false, message: 'Incident not found.' }
        const timestamp = nowIso()
        const nextStatus: IncidentStatus =
          incident.status === 'detected' || incident.status === 'investigating' ? 'assigned' : incident.status
        const updated: Incident = {
          ...incident,
          status: nextStatus,
          teams: Array.from(new Set([...incident.teams, team])),
          commander: incident.commander === 'Unassigned' ? user.name : incident.commander,
          updatedAt: timestamp,
          timeline: [
            ...incident.timeline,
            {
              id: uid('evt'),
              at: timestamp,
              kind: 'assignment',
              title: `Assigned to ${team}`,
              detail: `${team} accepted operational ownership.`,
              actor: user.name,
              ...(nextStatus !== incident.status ? { from: incident.status, to: nextStatus } : {}),
            },
          ],
        }
        set((state) => ({
          incidents: state.incidents.map((item) => (item.id === id ? updated : item)),
          auditLogs: [makeAudit(user.name, 'incident.assign', 'incident', incident.reference, { team }), ...state.auditLogs],
          notifications: notificationAllowed(state.notificationPreferences, 'assignment')
            ? [
                makeNotification('Incident assignment', `${team} assigned to ${incident.reference}.`, 'assignment', 'high', `/incidents/${id}`),
                ...state.notifications,
              ]
            : state.notifications,
        }))
        // Asynchronously persist to Supabase if backend is configured
        void backend.persistIncidentAssignment(id, team)
        return { ok: true, message: `${team} assigned.` }
      },

      addIncidentNote: (id, body) => {
        const { user, allowed } = permit('incident:note')
        if (!allowed || !user) return { ok: false, message: 'Your role cannot add investigation notes.' }
        if (!body.trim()) return { ok: false, message: 'Note cannot be empty.' }
        const incident = get().incidents.find((item) => item.id === id)
        if (!incident) return { ok: false, message: 'Incident not found.' }
        const timestamp = nowIso()
        set((state) => ({
          incidents: state.incidents.map((item) =>
            item.id === id
              ? {
                  ...item,
                  updatedAt: timestamp,
                  notes: [...item.notes, { id: uid('note'), author: user.name, body: body.trim(), createdAt: timestamp }],
                  timeline: [
                    ...item.timeline,
                    { id: uid('evt'), at: timestamp, kind: 'note', title: 'Investigation note', detail: body.trim(), actor: user.name },
                  ],
                }
              : item,
          ),
          auditLogs: [makeAudit(user.name, 'incident.note', 'incident', incident.reference), ...state.auditLogs],
        }))
        return { ok: true, message: 'Note added to the incident ledger.' }
      },

      addIncidentEvidence: (id, evidence) => {
        const { user, allowed } = permit('incident:evidence')
        if (!allowed || !user) return { ok: false, message: 'Your role cannot attach evidence.' }
        const incident = get().incidents.find((item) => item.id === id)
        if (!incident) return { ok: false, message: 'Incident not found.' }
        const timestamp = nowIso()
        set((state) => ({
          incidents: state.incidents.map((item) =>
            item.id === id
              ? {
                  ...item,
                  updatedAt: timestamp,
                  evidence: [
                    ...item.evidence,
                    { ...evidence, id: uid('ev'), addedAt: timestamp, addedBy: user.name },
                  ],
                  timeline: [
                    ...item.timeline,
                    { id: uid('evt'), at: timestamp, kind: 'evidence', title: 'Evidence attached', detail: evidence.label, actor: user.name },
                  ],
                }
              : item,
          ),
          auditLogs: [makeAudit(user.name, 'incident.evidence', 'incident', incident.reference, { label: evidence.label }), ...state.auditLogs],
        }))
        return { ok: true, message: 'Evidence attached.' }
      },

      setIncidentResolution: (id, resolution) => {
        const { user, allowed } = permit('incident:transition')
        if (!allowed || !user) return { ok: false, message: 'Your role cannot set a resolution report.' }
        const incident = get().incidents.find((item) => item.id === id)
        if (!incident) return { ok: false, message: 'Incident not found.' }
        set((state) => ({
          incidents: state.incidents.map((item) => (item.id === id ? { ...item, resolution, updatedAt: nowIso() } : item)),
          auditLogs: [makeAudit(user.name, 'incident.resolution', 'incident', incident.reference), ...state.auditLogs],
        }))
        return { ok: true, message: 'Resolution report saved.' }
      },

      createIncident: (input) => {
        const { user, allowed } = permit('incident:create')
        if (!allowed || !user) return { ok: false, message: 'Your role cannot create incidents.' }
        const entity = get().entities.find((item) => item.id === input.primaryEntityId)
        if (!entity) return { ok: false, message: 'Primary entity not found.' }
        const timestamp = nowIso()
        const sequence = 2842 + get().incidents.filter((item) => item.reference.startsWith('INC-')).length
        const id = uid('inc')
        const incident: Incident = {
          id,
          reference: `INC-${sequence}`,
          title: input.title,
          category: input.category,
          severity: input.severity,
          status: 'detected',
          districtId: input.districtId,
          primaryEntityId: input.primaryEntityId,
          relatedEntityIds: entity.relations.slice(0, 3).map((relation) => relation.targetId),
          commander: user.name,
          teams: [],
          summary: input.summary,
          confidence: 72,
          impactScore: input.severity === 'critical' ? 84 : input.severity === 'high' ? 66 : input.severity === 'moderate' ? 44 : 22,
          detectedAt: timestamp,
          updatedAt: timestamp,
          timeline: [
            {
              id: uid('evt'),
              at: timestamp,
              kind: 'detected',
              title: 'Manual detection',
              detail: `Incident created by ${user.name}.`,
              actor: user.name,
            },
          ],
          notes: [],
          evidence: [],
          map: entity.map ?? { x: 500, y: 300 },
        }
        set((state) => ({
          incidents: [incident, ...state.incidents],
          auditLogs: [makeAudit(user.name, 'incident.create', 'incident', incident.reference, { severity: input.severity }), ...state.auditLogs],
          notifications: notificationAllowed(state.notificationPreferences, 'incident')
            ? [
                makeNotification('New incident detected', `${incident.reference} · ${incident.title}`, 'incident', input.severity === 'critical' ? 'critical' : 'high', `/incidents/${id}`),
                ...state.notifications,
              ]
            : state.notifications,
        }))
        return { ok: true, message: `${incident.reference} created.`, id }
      },

      addEntityNote: (entityId, body) => {
        const { user, allowed } = permit('entity:note')
        if (!allowed || !user) return { ok: false, message: 'Your role cannot annotate entities.' }
        const entity = get().entities.find((item) => item.id === entityId)
        if (!entity) return { ok: false, message: 'Entity not found.' }
        const note: EntityNote = { id: uid('ent-note'), author: user.name, body: body.trim(), createdAt: nowIso() }
        set((state) => ({
          entities: state.entities.map((item) =>
            item.id === entityId ? { ...item, notes: [...item.notes, note], updatedAt: nowIso() } : item,
          ),
          auditLogs: [makeAudit(user.name, 'entity.note', 'entity', entity.code), ...state.auditLogs],
        }))
        return { ok: true, message: 'Entity annotation saved.' }
      },

      markNotificationRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((notification) =>
            notification.id === id ? { ...notification, read: true } : notification,
          ),
        })),

      markAllNotificationsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((notification) => ({ ...notification, read: true })),
        })),

      updateNotificationPreferences: (patch) =>
        set((state) => ({ notificationPreferences: { ...state.notificationPreferences, ...patch } })),

      saveSimulation: (input) => {
        const { user, allowed } = permit('simulation:save')
        if (!allowed || !user) return { ok: false, message: 'Your role cannot save simulations.' }
        const run: SimulationRun = {
          id: uid('sim'),
          ...input,
          owner: user.name,
          createdAt: nowIso(),
        }
        set((state) => ({
          simulations: [run, ...state.simulations],
          auditLogs: [makeAudit(user.name, 'simulation.save', 'simulation', run.id, { kind: run.kind }), ...state.auditLogs],
          notifications: notificationAllowed(state.notificationPreferences, 'simulation')
            ? [makeNotification('Scenario saved', `${run.name} saved with ${run.result.confidence}% confidence.`, 'simulation', 'normal', '/simulation'), ...state.notifications]
            : state.notifications,
        }))
        return { ok: true, message: 'Simulation saved.', id: run.id }
      },

      deleteSimulation: (id) => {
        const { user, allowed } = permit('simulation:save')
        if (!allowed || !user) return { ok: false, message: 'Your role cannot delete simulations.' }
        set((state) => ({
          simulations: state.simulations.filter((simulation) => simulation.id !== id),
          auditLogs: [makeAudit(user.name, 'simulation.delete', 'simulation', id), ...state.auditLogs],
        }))
        return { ok: true, message: 'Simulation removed.' }
      },

      createDashboard: (name) => {
        const { user, allowed } = permit('analytics:edit')
        if (!allowed || !user) return { ok: false, message: 'Your role cannot create dashboards.' }
        const dashboard: Dashboard = {
          id: uid('dash'),
          name: name || 'Untitled workspace',
          description: 'Custom analytical workspace.',
          owner: user.name,
          widgets: [],
          createdAt: nowIso(),
          updatedAt: nowIso(),
        }
        set((state) => ({
          dashboards: [dashboard, ...state.dashboards],
          auditLogs: [makeAudit(user.name, 'dashboard.create', 'dashboard', dashboard.id), ...state.auditLogs],
        }))
        return { ok: true, message: 'Dashboard created.', id: dashboard.id }
      },

      saveDashboard: (dashboard) => {
        const { user, allowed } = permit('analytics:edit')
        if (!allowed || !user) return { ok: false, message: 'Your role cannot edit dashboards.' }
        const exists = get().dashboards.some((item) => item.id === dashboard.id)
        set((state) => ({
          dashboards: exists
            ? state.dashboards.map((item) => (item.id === dashboard.id ? { ...dashboard, updatedAt: nowIso() } : item))
            : [{ ...dashboard, owner: user.name, updatedAt: nowIso() }, ...state.dashboards],
          auditLogs: [makeAudit(user.name, 'dashboard.save', 'dashboard', dashboard.id), ...state.auditLogs],
        }))
        return { ok: true, message: 'Dashboard saved.' }
      },

      deleteDashboard: (id) => {
        const { user, allowed } = permit('analytics:edit')
        if (!allowed || !user) return { ok: false, message: 'Your role cannot delete dashboards.' }
        set((state) => ({
          dashboards: state.dashboards.filter((dashboard) => dashboard.id !== id),
          auditLogs: [makeAudit(user.name, 'dashboard.delete', 'dashboard', id), ...state.auditLogs],
        }))
        return { ok: true, message: 'Dashboard deleted.' }
      },

      createReport: (template = 'Intelligence brief') => {
        const { user, allowed } = permit('report:create')
        if (!allowed || !user) return { ok: false, message: 'Your role cannot create reports.' }
        const id = uid('rpt')
        const report: Report = {
          id,
          title: 'Untitled intelligence report',
          template,
          classification: 'internal',
          status: 'draft',
          summary: '',
          author: user.name,
          sharedWith: [],
          blocks: [
            { id: uid('blk'), type: 'heading', title: 'Executive summary' },
            { id: uid('blk'), type: 'paragraph', body: 'Draft the analytical assessment here.' },
          ],
          createdAt: nowIso(),
          updatedAt: nowIso(),
        }
        set((state) => ({
          reports: [report, ...state.reports],
          auditLogs: [makeAudit(user.name, 'report.create', 'report', id), ...state.auditLogs],
        }))
        return { ok: true, message: 'Report created.', id }
      },

      updateReport: (id, patch) => {
        const { user, allowed } = permit('report:edit')
        if (!allowed || !user) return { ok: false, message: 'Your role cannot edit reports.' }
        set((state) => ({
          reports: state.reports.map((report) => (report.id === id ? { ...report, ...patch, updatedAt: nowIso() } : report)),
          auditLogs: [makeAudit(user.name, 'report.update', 'report', id), ...state.auditLogs],
        }))
        return { ok: true, message: 'Report updated.' }
      },

      addReportBlock: (id, block) => {
        const { user, allowed } = permit('report:edit')
        if (!allowed || !user) return { ok: false, message: 'Your role cannot edit reports.' }
        set((state) => ({
          reports: state.reports.map((report) =>
            report.id === id ? { ...report, blocks: [...report.blocks, block], updatedAt: nowIso() } : report,
          ),
        }))
        return { ok: true, message: 'Block added.' }
      },

      publishReport: (id) => {
        const { user, allowed } = permit('report:edit')
        if (!allowed || !user) return { ok: false, message: 'Your role cannot publish reports.' }
        const report = get().reports.find((item) => item.id === id)
        if (!report) return { ok: false, message: 'Report not found.' }
        set((state) => ({
          reports: state.reports.map((item) =>
            item.id === id ? { ...item, status: 'published', updatedAt: nowIso() } : item,
          ),
          notifications: notificationAllowed(state.notificationPreferences, 'workspace')
            ? [makeNotification('Report published', `${report.title} is now available to authorized recipients.`, 'workspace', 'normal', `/reports/${id}`), ...state.notifications]
            : state.notifications,
          auditLogs: [makeAudit(user.name, 'report.publish', 'report', id), ...state.auditLogs],
        }))
        return { ok: true, message: 'Report published.' }
      },

      shareReport: (id, recipient) => {
        const { user, allowed } = permit('report:share')
        if (!allowed || !user) return { ok: false, message: 'Your role cannot share reports.' }
        const report = get().reports.find((item) => item.id === id)
        if (!report) return { ok: false, message: 'Report not found.' }
        set((state) => ({
          reports: state.reports.map((item) =>
            item.id === id && !item.sharedWith.includes(recipient)
              ? { ...item, sharedWith: [...item.sharedWith, recipient], updatedAt: nowIso() }
              : item,
          ),
          auditLogs: [makeAudit(user.name, 'report.share', 'report', id, { recipient }), ...state.auditLogs],
          notifications: notificationAllowed(state.notificationPreferences, 'workspace')
            ? [makeNotification('Report shared', `${report.title} shared with ${recipient}.`, 'workspace', 'normal', `/reports/${id}`), ...state.notifications]
            : state.notifications,
        }))
        return { ok: true, message: `Shared with ${recipient}.` }
      },

      createConversation: () => {
        const { user, allowed } = permit('ai:use')
        if (!allowed || !user) return { ok: false, message: 'Your role cannot use the intelligence assistant.' }
        const id = uid('conv')
        const conversation: Conversation = {
          id,
          title: 'New intelligence thread',
          messages: [],
          createdAt: nowIso(),
          updatedAt: nowIso(),
        }
        set((state) => ({ conversations: [conversation, ...state.conversations] }))
        return { ok: true, id }
      },

      appendMessage: (conversationId, message) => {
        set((state) => ({
          conversations: state.conversations.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  messages: [...conversation.messages, message],
                  title:
                    conversation.messages.length === 0 && message.role === 'user'
                      ? message.content.slice(0, 46).replace(/[?.,!].*$/, '')
                      : conversation.title,
                  updatedAt: nowIso(),
                }
              : conversation,
          ),
        }))
        return { ok: true }
      },

      renameConversation: (id, title) => {
        set((state) => ({
          conversations: state.conversations.map((conversation) =>
            conversation.id === id ? { ...conversation, title, updatedAt: nowIso() } : conversation,
          ),
        }))
        return { ok: true }
      },

      deleteConversation: (id) => {
        const { user, allowed } = permit('ai:use')
        if (!allowed || !user) return { ok: false, message: 'Your role cannot delete intelligence threads.' }
        set((state) => ({
          conversations: state.conversations.filter((conversation) => conversation.id !== id),
          auditLogs: [makeAudit(user.name, 'conversation.delete', 'conversation', id), ...state.auditLogs],
        }))
        return { ok: true, message: 'Conversation deleted.' }
      },

      addAudit: (action, targetType, targetId, metadata) => {
        const { user } = authorize('view:overview')
        const auditEntry = makeAudit(user?.name ?? 'System', action, targetType, targetId, metadata)
        set((state) => ({
          auditLogs: [auditEntry, ...state.auditLogs],
        }))
        // Asynchronously mirror audit log to Supabase if configured
        void backend.persistAuditLog(action, targetType, targetId, metadata)
      },

      resetPlatform: () =>
        set({
          entities: ENTITIES,
          incidents: INCIDENTS,
          notifications: NOTIFICATIONS,
          reports: REPORTS,
          simulations: SIMULATIONS,
          conversations: CONVERSATIONS,
          dashboards: DASHBOARDS,
          auditLogs: AUDIT_LOGS,
          notificationPreferences: defaultPreferences,
        }),
    }),
    {
      name: 'nexus-platform-v1',
      version: 1,
      partialize: (state) => ({
        entities: state.entities,
        incidents: state.incidents,
        notifications: state.notifications,
        reports: state.reports,
        simulations: state.simulations,
        conversations: state.conversations,
        dashboards: state.dashboards,
        auditLogs: state.auditLogs,
        notificationPreferences: state.notificationPreferences,
      }),
    },
  ),
)
