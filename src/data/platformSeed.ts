import type {
  AuditLog,
  Conversation,
  Dashboard,
  NexusNotification,
  Report,
  SimulationRun,
} from '../types'
import { runSimulation } from '../lib/simulation'
import { DEMO_EPOCH } from './constants'

const at = (minutesAgo: number) => new Date(DEMO_EPOCH - minutesAgo * 60_000).toISOString()

export const NOTIFICATIONS: NexusNotification[] = [
  {
    id: 'ntf-001',
    category: 'incident',
    priority: 'critical',
    title: 'INC-2841 · Grid frequency still unstable',
    body: 'Lumen node reserve margin remains below target. Command review requested within 15 minutes.',
    href: '/incidents/inc-2841',
    read: false,
    createdAt: at(8),
  },
  {
    id: 'ntf-002',
    category: 'assignment',
    priority: 'high',
    title: 'Cyber Cell assigned to INC-2836',
    body: 'K. Maren has taken ownership of the port telemetry intrusion investigation.',
    href: '/incidents/inc-2836',
    read: false,
    createdAt: at(14),
  },
  {
    id: 'ntf-003',
    category: 'simulation',
    priority: 'normal',
    title: 'Scenario run complete',
    body: 'Tidal Bridge closure / 12h finished with 88% model confidence.',
    href: '/simulation',
    read: false,
    createdAt: at(26),
  },
  {
    id: 'ntf-004',
    category: 'incident',
    priority: 'high',
    title: 'Air quality advisory issued',
    body: 'Environmental Response issued a sensitive-group advisory for Foundry Belt.',
    href: '/incidents/inc-2839',
    read: true,
    createdAt: at(48),
  },
  {
    id: 'ntf-005',
    category: 'workspace',
    priority: 'normal',
    title: 'Workspace shared with you',
    body: 'Mira Chen shared the Metropolitan Resilience dashboard with your analysis workspace.',
    href: '/analytics',
    read: true,
    createdAt: at(72),
  },
  {
    id: 'ntf-006',
    category: 'system',
    priority: 'normal',
    title: 'Twin fidelity reconciled',
    body: 'Digital twin geometry synchronized against the v4 geospatial baseline.',
    href: '/geoint',
    read: true,
    createdAt: at(95),
  },
  {
    id: 'ntf-007',
    category: 'administration',
    priority: 'low',
    title: 'Quarterly access review',
    body: 'Role assignments are scheduled for review by the Super Administrator.',
    href: '/admin',
    read: true,
    createdAt: at(180),
  },
  {
    id: 'ntf-008',
    category: 'incident',
    priority: 'critical',
    title: 'Tidal Bridge inspection opened',
    body: 'Structural engineering has requested a 48-hour monitoring window.',
    href: '/incidents/inc-2840',
    read: false,
    createdAt: at(52),
  },
  {
    id: 'ntf-009',
    category: 'system',
    priority: 'low',
    title: 'Data stream latency nominal',
    body: 'All simulation telemetry feeds are within the 40 ms operating envelope.',
    href: '/overview',
    read: true,
    createdAt: at(220),
  },
]

const routeParams = {
  duration: 12,
  intensity: 78,
  affectedNode: 'Tidal Bridge',
  rainfall: 22,
  populationChange: 4,
  redundancy: true,
  cascadeDepth: 3,
}

const gridParams = {
  duration: 24,
  intensity: 64,
  affectedNode: 'Lumen Grid Node',
  rainfall: 0,
  populationChange: 0,
  redundancy: true,
  cascadeDepth: 2,
}

export const SIMULATIONS: SimulationRun[] = [
  {
    id: 'sim-001',
    name: 'Tidal Bridge closure / 12h',
    kind: 'route_closure',
    parameters: routeParams,
    result: runSimulation('route_closure', routeParams),
    owner: 'Elena Voss',
    createdAt: at(26),
  },
  {
    id: 'sim-002',
    name: 'Lumen grid cascade / 24h',
    kind: 'power_shortage',
    parameters: gridParams,
    result: runSimulation('power_shortage', gridParams),
    owner: 'Dain Rook',
    createdAt: at(300),
  },
]

export const DASHBOARDS: Dashboard[] = [
  {
    id: 'dash-001',
    name: 'Metropolitan Pulse',
    description: 'Cross-domain operating picture for daily command review.',
    owner: 'Elena Voss',
    widgets: [
      { id: 'w-01', type: 'timeseries', title: 'Metropolitan load profile', datasetId: 'metro_load', x: 0, y: 0, w: 7, h: 4 },
      { id: 'w-02', type: 'area', title: 'Incident velocity', datasetId: 'incident_velocity', x: 7, y: 0, w: 5, h: 4 },
      { id: 'w-03', type: 'bar', title: 'District load', datasetId: 'district_load', x: 0, y: 4, w: 4, h: 3 },
      { id: 'w-04', type: 'radar', title: 'District resilience', datasetId: 'radar_resilience', x: 4, y: 4, w: 4, h: 3 },
      { id: 'w-05', type: 'metric', title: 'Operational readiness', datasetId: 'metric_readiness', metricLabel: 'Readiness', metricValue: '81.7', x: 8, y: 4, w: 2, h: 3 },
      { id: 'w-06', type: 'metric', title: 'Active incidents', datasetId: 'metric_incidents', metricLabel: 'Events', metricValue: '8', x: 10, y: 4, w: 2, h: 3 },
    ],
    createdAt: at(4_800),
    updatedAt: at(30),
  },
  {
    id: 'dash-002',
    name: 'Energy & Environment',
    description: 'Load, generation and atmospheric correlation workspace.',
    owner: 'Sera Ilyan',
    widgets: [
      { id: 'w-11', type: 'area', title: 'Grid demand and renewable supply', datasetId: 'energy_demand', x: 0, y: 0, w: 6, h: 4 },
      { id: 'w-12', type: 'timeseries', title: 'Air quality by mesh', datasetId: 'air_quality', x: 6, y: 0, w: 6, h: 4 },
      { id: 'w-13', type: 'bar', title: 'Generation mix', datasetId: 'generation_mix', x: 0, y: 4, w: 5, h: 3 },
      { id: 'w-14', type: 'distribution', title: 'Response distribution', datasetId: 'distribution', x: 5, y: 4, w: 4, h: 3 },
      { id: 'w-15', type: 'metric', title: 'Reserve margin', datasetId: 'metric_reserve', metricLabel: 'Margin', metricValue: '11.4%', x: 9, y: 4, w: 3, h: 3 },
    ],
    createdAt: at(2_100),
    updatedAt: at(90),
  },
]

export const REPORTS: Report[] = [
  {
    id: 'rpt-001',
    title: 'Aurelia Daily Intelligence Brief',
    template: 'Daily intelligence brief',
    classification: 'internal',
    status: 'review',
    summary:
      'Eastern grid instability and the Tidal Bridge vibration event are the dominant operational signals this cycle. Environmental conditions are deteriorating in Foundry Belt, while trade momentum remains positive.',
    author: 'Elena Voss',
    sharedWith: ['Dain Rook', 'Mira Chen'],
    blocks: [
      {
        id: 'blk-01',
        type: 'metrics',
        title: 'Cycle indicators',
        metrics: [
          { label: 'Operational readiness', value: '81.7', delta: '+0.6' },
          { label: 'Active incidents', value: '8', delta: '+2' },
          { label: 'Grid reserve', value: '11.4%', delta: '-6.8%' },
          { label: 'Composite index', value: '1,284.6', delta: '+1.8%' },
        ],
      },
      {
        id: 'blk-02',
        type: 'heading',
        title: 'Executive assessment',
      },
      {
        id: 'blk-03',
        type: 'paragraph',
        body:
          'The eastern grid is operating under a constrained reserve envelope following a frequency excursion at the Lumen node. Fast-reserve dispatch has stabilized frequency, but industrial curtailment remains active. The Tidal Bridge vibration event is under engineering review and has not yet required closure.',
      },
      {
        id: 'blk-04',
        type: 'chart',
        title: 'Metropolitan load and incident velocity',
        chartId: 'metro_load',
      },
      {
        id: 'blk-05',
        type: 'entity',
        title: 'Priority entities',
        entityIds: ['fac-lumen-grid', 'route-bridge-tidal', 'env-air-central'],
      },
      {
        id: 'blk-06',
        type: 'note',
        title: 'Analyst note',
        body:
          'Recommend maintaining Kestrel Medical and Meridian Data Vault on protected feeds until reserve margin exceeds 18% for two consecutive hours.',
      },
    ],
    createdAt: at(280),
    updatedAt: at(18),
  },
  {
    id: 'rpt-002',
    title: 'Foundry Environmental Risk Assessment',
    template: 'Environmental assessment',
    classification: 'restricted',
    status: 'draft',
    summary:
      'Persistent inversion conditions and thermal plume expansion are compounding air quality in the Foundry Belt. The assessment models three mitigation paths and their expected AQI response.',
    author: 'J. Sera',
    sharedWith: ['Elena Voss'],
    blocks: [
      {
        id: 'blk-11',
        type: 'metrics',
        title: 'Environmental snapshot',
        metrics: [
          { label: 'Central AQI', value: '168', delta: '+62' },
          { label: 'PM2.5', value: '71 µg/m³', delta: '+29' },
          { label: 'Inversion depth', value: '240 m', delta: '-80 m' },
          { label: 'Advisory status', value: 'Active', delta: 'new' },
        ],
      },
      { id: 'blk-12', type: 'heading', title: 'Observed conditions' },
      {
        id: 'blk-13',
        type: 'paragraph',
        body:
          'The current boundary-layer inversion is trapping emissions below 240 metres. Foundry thermal output and freight activity are the dominant contributors. Air quality is not expected to recover until wind speed exceeds 18 km/h or production throttling is applied.',
      },
      { id: 'blk-14', type: 'chart', title: 'Air quality by mesh', chartId: 'air_quality' },
      { id: 'blk-15', type: 'entity', title: 'Monitored assets', entityIds: ['env-air-central', 'fac-foundry-plant', 'fac-vantage-air'] },
    ],
    createdAt: at(1_460),
    updatedAt: at(62),
  },
  {
    id: 'rpt-003',
    title: 'Tidal Corridor Resilience Review',
    template: 'Infrastructure review',
    classification: 'internal',
    status: 'published',
    summary:
      'The Tidal Bridge and port freight corridor remain the most consequential single points of failure in the southern theater. A staged reinforcement program is recommended.',
    author: 'Mira Chen',
    sharedWith: ['Dain Rook', 'Elena Voss', 'Aris Thorne'],
    blocks: [
      { id: 'blk-21', type: 'heading', title: 'Resilience finding' },
      {
        id: 'blk-22',
        type: 'paragraph',
        body:
          'A simultaneous closure of the Tidal Bridge and freight corridor would isolate the port from the Meridian core for at least 4.5 hours. Current redundancy is insufficient for a peak-hour event. The recommended program combines bearing replacement, corridor diversions and a temporary rail bypass.',
      },
      { id: 'blk-23', type: 'chart', title: 'Incident velocity', chartId: 'incident_velocity' },
      { id: 'blk-24', type: 'entity', title: 'Corridor assets', entityIds: ['route-bridge-tidal', 'route-freight-09', 'fac-port'] },
      {
        id: 'blk-25',
        type: 'table',
        title: 'Recommended interventions',
        table: {
          columns: ['Intervention', 'Horizon', 'Est. cost', 'Risk reduction'],
          rows: [
            ['Bearing assembly replacement', '0–3 months', '$18.4M', 'High'],
            ['Freight corridor diversion plan', '3–6 months', '$6.2M', 'Moderate'],
            ['Temporary rail bypass', '6–12 months', '$42.0M', 'High'],
          ],
        },
      },
    ],
    createdAt: at(12_200),
    updatedAt: at(3_100),
  },
]

export const CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-001',
    title: 'Eastern grid instability',
    createdAt: at(90),
    updatedAt: at(6),
    messages: [
      {
        id: 'msg-001',
        role: 'user',
        content: 'Summarize the current eastern grid situation and identify the highest-risk dependencies.',
        createdAt: at(12),
      },
      {
        id: 'msg-002',
        role: 'assistant',
        content:
          'Eastern grid posture is degraded but contained. The Lumen Grid Node is carrying 87% load with reserve margin at 11.4% — below the 18% target — following a 0.14 Hz frequency excursion. Fast-reserve storage dispatched 280 MW and industrial curtailment is active.\n\nThe highest-risk dependency chain is Lumen Grid Node → Meridian Data Vault → Aurelia Response Center. The vault has already shifted workload to backup cooling and remains above 99.9% service availability. Kestrel Regional Medical is protected but should be monitored if the reserve margin falls again.\n\nRecommended next checks: confirm the battery array thermal state, validate the data vault backup feed, and hold industrial curtailment until reserve margin exceeds 18% for two consecutive hours.',
        createdAt: at(11),
        engine: 'deterministic',
        sources: [
          { label: 'Lumen Grid Node', entityId: 'fac-lumen-grid', href: '/entity/fac-lumen-grid' },
          { label: 'INC-2841', href: '/incidents/inc-2841' },
          { label: 'Meridian Data Vault', entityId: 'fac-nexus-dc', href: '/entity/fac-nexus-dc' },
        ],
      },
    ],
  },
]

export const AUDIT_LOGS: AuditLog[] = [
  { id: 'aud-001', actor: 'Dain Rook', action: 'incident.transition', targetType: 'incident', targetId: 'INC-2841', metadata: { to: 'mitigating' }, at: at(31) },
  { id: 'aud-002', actor: 'Mira Chen', action: 'incident.assign', targetType: 'incident', targetId: 'INC-2836', metadata: { team: 'Cyber Cell' }, at: at(24) },
  { id: 'aud-003', actor: 'Elena Voss', action: 'simulation.save', targetType: 'simulation', targetId: 'sim-001', metadata: { kind: 'route_closure' }, at: at(26) },
  { id: 'aud-004', actor: 'Aris Thorne', action: 'user.role.assign', targetType: 'profile', targetId: 'usr-sera', metadata: { role: 'researcher' }, at: at(140) },
  { id: 'aud-005', actor: 'Elena Voss', action: 'report.update', targetType: 'report', targetId: 'rpt-001', metadata: { status: 'review' }, at: at(18) },
  { id: 'aud-006', actor: 'J. Sera', action: 'incident.note', targetType: 'incident', targetId: 'INC-2839', metadata: {}, at: at(52) },
  { id: 'aud-007', actor: 'Mira Chen', action: 'workspace.share', targetType: 'dashboard', targetId: 'dash-001', metadata: { user: 'Elena Voss' }, at: at(72) },
  { id: 'aud-008', actor: 'System', action: 'digital_twin.sync', targetType: 'system', targetId: 'geospatial-v4', metadata: { fidelity: '98.2%' }, at: at(95) },
]
