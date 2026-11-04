export type RoleId =
  | 'super_admin'
  | 'sys_admin'
  | 'analyst'
  | 'ops_manager'
  | 'researcher'
  | 'observer'

export type Permission =
  | 'view:overview'
  | 'view:geoint'
  | 'view:infrastructure'
  | 'view:environment'
  | 'view:economy'
  | 'view:mobility'
  | 'view:energy'
  | 'view:incidents'
  | 'view:simulation'
  | 'view:ai'
  | 'view:archive'
  | 'view:analytics'
  | 'view:reports'
  | 'view:network'
  | 'view:admin'
  | 'incident:create'
  | 'incident:transition'
  | 'incident:assign'
  | 'incident:note'
  | 'incident:evidence'
  | 'simulation:save'
  | 'analytics:edit'
  | 'report:create'
  | 'report:edit'
  | 'report:share'
  | 'admin:users'
  | 'admin:roles'
  | 'admin:audit'
  | 'admin:settings'
  | 'ai:use'
  | 'entity:note'
  | 'notification:prefs'

export interface RoleDefinition {
  id: RoleId
  name: string
  shortName: string
  description: string
  rank: number
  permissions: Permission[]
}

export interface User {
  id: string
  name: string
  email: string
  password: string
  roleId: RoleId
  title: string
  clearance: string
  status: 'active' | 'suspended' | 'invited'
  initials: string
  color: string
  lastActive: string
}

export interface MapPoint {
  x: number
  y: number
}

export interface GeoPoint {
  lat: number
  lng: number
}

export type EntityKind =
  | 'city'
  | 'district'
  | 'facility'
  | 'route'
  | 'organization'
  | 'economic'
  | 'environmental'
  | 'landmark'

export type EntityStatus =
  | 'operational'
  | 'degraded'
  | 'offline'
  | 'maintenance'
  | 'unknown'

export type Criticality = 'critical' | 'high' | 'moderate' | 'low'

export interface Vital {
  label: string
  value: number
  unit: string
  delta: number
  format?: 'number' | 'percent' | 'currency' | 'decimal'
}

export interface Relation {
  targetId: string
  type: string
  strength: number
}

export interface TimelineEvent {
  id: string
  at: string
  title: string
  detail: string
  kind: 'system' | 'incident' | 'maintenance' | 'economic' | 'environmental' | 'observation'
}

export interface EntityNote {
  id: string
  author: string
  body: string
  createdAt: string
}

export interface Entity {
  id: string
  name: string
  code: string
  kind: EntityKind
  parentId?: string
  districtId?: string
  status: EntityStatus
  criticality: Criticality
  description: string
  location?: GeoPoint
  map?: MapPoint
  population?: number
  tags: string[]
  vitals: Vital[]
  attributes: Record<string, string>
  relations: Relation[]
  timeline: TimelineEvent[]
  notes: EntityNote[]
  updatedAt: string
}

export type IncidentCategory =
  | 'infrastructure_failure'
  | 'transport_disruption'
  | 'environmental_emergency'
  | 'power_outage'
  | 'water_disruption'
  | 'network_failure'
  | 'natural_disaster'

export type IncidentSeverity = 'critical' | 'high' | 'moderate' | 'low'

export type IncidentStatus =
  | 'detected'
  | 'investigating'
  | 'assigned'
  | 'mitigating'
  | 'resolved'
  | 'archived'

export interface IncidentTimelineEntry {
  id: string
  at: string
  kind: 'detected' | 'status' | 'assignment' | 'note' | 'evidence' | 'escalation' | 'resolution'
  title: string
  detail: string
  actor?: string
  from?: IncidentStatus
  to?: IncidentStatus
}

export interface IncidentNote {
  id: string
  author: string
  body: string
  createdAt: string
}

export interface Evidence {
  id: string
  label: string
  kind: 'image' | 'document' | 'telemetry' | 'link'
  reference: string
  addedBy: string
  addedAt: string
}

export interface Incident {
  id: string
  reference: string
  title: string
  category: IncidentCategory
  severity: IncidentSeverity
  status: IncidentStatus
  districtId: string
  primaryEntityId: string
  relatedEntityIds: string[]
  commander: string
  teams: string[]
  summary: string
  confidence: number
  impactScore: number
  detectedAt: string
  updatedAt: string
  resolvedAt?: string
  resolution?: string
  timeline: IncidentTimelineEntry[]
  notes: IncidentNote[]
  evidence: Evidence[]
  map: MapPoint
}

export interface NotificationPreferences {
  incidentUpdates: boolean
  assignments: boolean
  simulations: boolean
  workspaceActivity: boolean
  systemAlerts: boolean
  digestFrequency: 'realtime' | 'hourly' | 'daily'
}

export type NotificationCategory =
  | 'system'
  | 'incident'
  | 'assignment'
  | 'simulation'
  | 'workspace'
  | 'administration'

export type NotificationPriority = 'critical' | 'high' | 'normal' | 'low'

export interface NexusNotification {
  id: string
  category: NotificationCategory
  priority: NotificationPriority
  title: string
  body: string
  href?: string
  read: boolean
  createdAt: string
}

export type SimulationKind =
  | 'route_closure'
  | 'power_shortage'
  | 'supply_chain'
  | 'rainfall'
  | 'population_growth'

export interface SimulationParameters {
  duration: number
  intensity: number
  affectedNode: string
  rainfall: number
  populationChange: number
  redundancy: boolean
  cascadeDepth: number
}

export interface SimulationSeriesPoint {
  hour: number
  label: string
  primary: number
  secondary: number
  tertiary: number
}

export interface SimulationImpact {
  label: string
  value: string
  delta: number
  direction: 'up' | 'down' | 'neutral'
  severity: IncidentSeverity
  description: string
}

export interface SimulationResult {
  kind: SimulationKind
  title: string
  horizonHours: number
  confidence: number
  summary: string
  series: SimulationSeriesPoint[]
  impacts: SimulationImpact[]
  affectedNodes: string[]
  modelNotes: string[]
}

export interface SimulationRun {
  id: string
  name: string
  kind: SimulationKind
  parameters: SimulationParameters
  result: SimulationResult
  owner: string
  createdAt: string
}

export type MessageRole = 'user' | 'assistant'

export interface MessageSource {
  label: string
  entityId?: string
  href?: string
}

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  createdAt: string
  sources?: MessageSource[]
  engine?: 'deterministic' | 'external'
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

export interface ChartDataset {
  id: string
  title: string
  source: string
  unit: string
  data: Record<string, string | number>[]
  series: { key: string; label: string; color: string }[]
}

export type WidgetType =
  | 'timeseries'
  | 'area'
  | 'bar'
  | 'radar'
  | 'treemap'
  | 'sankey'
  | 'metric'
  | 'heatmap'
  | 'distribution'

export interface DashboardWidget {
  id: string
  type: WidgetType
  title: string
  datasetId: string
  metricLabel?: string
  metricValue?: string
  x: number
  y: number
  w: number
  h: number
}

export interface Dashboard {
  id: string
  name: string
  description: string
  owner: string
  widgets: DashboardWidget[]
  createdAt: string
  updatedAt: string
}

export type ReportStatus = 'draft' | 'review' | 'published' | 'archived'

export type ReportBlockType =
  | 'heading'
  | 'paragraph'
  | 'metrics'
  | 'chart'
  | 'entity'
  | 'table'
  | 'note'
  | 'divider'

export interface ReportBlock {
  id: string
  type: ReportBlockType
  title?: string
  body?: string
  chartId?: string
  entityIds?: string[]
  metrics?: { label: string; value: string; delta?: string }[]
  table?: { columns: string[]; rows: string[][] }
}

export interface Report {
  id: string
  title: string
  template: string
  classification: 'internal' | 'restricted' | 'public'
  status: ReportStatus
  summary: string
  author: string
  sharedWith: string[]
  blocks: ReportBlock[]
  createdAt: string
  updatedAt: string
}

export interface AuditLog {
  id: string
  actor: string
  action: string
  targetType: string
  targetId: string
  metadata?: Record<string, string>
  at: string
}

export interface Team {
  id: string
  name: string
  discipline: string
  status: 'available' | 'deployed' | 'standby'
  lead: string
  members: number
}

export type CityLayer =
  | 'transport'
  | 'energy'
  | 'water'
  | 'environment'
  | 'population'
  | 'infrastructure'
  | 'incidents'
  | 'economy'

export type CameraMode = 'orbit' | 'top' | 'street' | 'cinematic'

export interface Workspace {
  id: string
  name: string
  code: string
  description: string
  classification: string
}
