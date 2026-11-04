import type {
  CityLayer,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  MapPoint,
  Team,
} from '../types'

export const DEMO_EPOCH_ISO = '2026-11-04T14:32:00.000Z'
export const DEMO_EPOCH = new Date(DEMO_EPOCH_ISO).getTime()
export const CITY_NAME = 'AURELIA PRIME'
export const THEATER_NAME = 'Aurelia Metropolitan Theater'

export const COLORS = {
  cyan: '#56e1ff',
  cyanSoft: '#9ceeff',
  violet: '#8f7cff',
  blue: '#5b8def',
  amber: '#f3b85a',
  red: '#ff5d73',
  green: '#5ce1a4',
  muted: '#7b8da4',
  grid: 'rgba(136, 165, 196, 0.12)',
}

export const CHART_COLORS = [COLORS.cyan, COLORS.violet, COLORS.amber, COLORS.green, COLORS.blue, COLORS.red]

export interface DistrictDefinition {
  id: string
  name: string
  code: string
  center: MapPoint
  path: string
  color: string
  population: number
  risk: number
  description: string
}

export const DISTRICTS: DistrictDefinition[] = [
  {
    id: 'dist-meridian',
    name: 'Meridian Core',
    code: 'MER',
    center: { x: 500, y: 300 },
    path: 'M 410 230 L 565 218 L 630 286 L 604 376 L 458 390 L 398 326 Z',
    color: '#56e1ff',
    population: 1_840_000,
    risk: 62,
    description: 'Civic command, finance and the densest vertical footprint in the theater.',
  },
  {
    id: 'dist-helix',
    name: 'Helix Quarter',
    code: 'HLX',
    center: { x: 674, y: 312 },
    path: 'M 620 250 L 742 238 L 792 330 L 734 398 L 626 382 L 604 316 Z',
    color: '#8f7cff',
    population: 960_000,
    risk: 48,
    description: 'Research campuses, biomedical facilities and the central transit interchange.',
  },
  {
    id: 'dist-kestrel',
    name: 'Kestrel Heights',
    code: 'KST',
    center: { x: 324, y: 204 },
    path: 'M 240 142 L 386 124 L 444 210 L 398 294 L 262 286 L 208 220 Z',
    color: '#5b8def',
    population: 720_000,
    risk: 36,
    description: 'Elevated residential terraces and regional emergency medical capability.',
  },
  {
    id: 'dist-lumen',
    name: 'Lumen Fields',
    code: 'LMN',
    center: { x: 786, y: 168 },
    path: 'M 686 102 L 860 84 L 926 162 L 864 244 L 720 232 L 672 164 Z',
    color: '#f3b85a',
    population: 410_000,
    risk: 74,
    description: 'Generation, storage and industrial telemetry at the eastern grid edge.',
  },
  {
    id: 'dist-foundry',
    name: 'Foundry Belt',
    code: 'FND',
    center: { x: 748, y: 464 },
    path: 'M 660 410 L 810 398 L 878 476 L 800 552 L 678 534 L 636 466 Z',
    color: '#ff5d73',
    population: 530_000,
    risk: 81,
    description: 'Heavy fabrication, desalination and the highest environmental load in the city.',
  },
  {
    id: 'dist-tidal',
    name: 'Tidal Basin',
    code: 'TDL',
    center: { x: 500, y: 514 },
    path: 'M 414 458 L 588 450 L 626 526 L 556 584 L 424 570 L 388 514 Z',
    color: '#5ce1a4',
    population: 660_000,
    risk: 57,
    description: 'Port operations, water reclamation and the primary tidal flood interface.',
  },
  {
    id: 'dist-vantage',
    name: 'Vantage Point',
    code: 'VNT',
    center: { x: 244, y: 424 },
    path: 'M 172 356 L 320 340 L 370 430 L 302 502 L 182 480 L 146 414 Z',
    color: '#9ceeff',
    population: 480_000,
    risk: 44,
    description: 'Western residential ridge, water pumping and regional air monitoring.',
  },
  {
    id: 'dist-solace',
    name: 'Solace Ring',
    code: 'SLC',
    center: { x: 508, y: 108 },
    path: 'M 408 56 L 596 52 L 654 112 L 592 168 L 422 166 L 374 112 Z',
    color: '#c2a8ff',
    population: 350_000,
    risk: 29,
    description: 'Solar array, observatory and low-density northern buffer.',
  },
]

export const RIVER_PATH = 'M -20 554 C 150 520 252 574 406 520 S 660 428 780 458 S 918 500 1020 462'
export const BRIDGES = [
  { id: 'bridge-west', x: 330, y: 534, label: 'Vantage Span' },
  { id: 'bridge-central', x: 505, y: 498, label: 'Meridian Crossing' },
  { id: 'bridge-east', x: 704, y: 449, label: 'Foundry Link' },
]

export const DISTRICTS_BY_ID = Object.fromEntries(DISTRICTS.map((district) => [district.id, district]))

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  detected: 'Detected',
  investigating: 'Investigating',
  assigned: 'Assigned',
  mitigating: 'Mitigating',
  resolved: 'Resolved',
  archived: 'Archived',
}

export const INCIDENT_STATUS_FLOW: IncidentStatus[] = [
  'detected',
  'investigating',
  'assigned',
  'mitigating',
  'resolved',
  'archived',
]

export const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
}

export const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  infrastructure_failure: 'Infrastructure failure',
  transport_disruption: 'Transport disruption',
  environmental_emergency: 'Environmental emergency',
  power_outage: 'Power outage',
  water_disruption: 'Water disruption',
  network_failure: 'Network failure',
  natural_disaster: 'Natural disaster',
}

export const SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  critical: '#ff5d73',
  high: '#f3b85a',
  moderate: '#56e1ff',
  low: '#7b8da4',
}

export const TEAMS: Team[] = [
  { id: 'team-meridian', name: 'Meridian Response', discipline: 'Civic operations', status: 'deployed', lead: 'A. Kade', members: 12 },
  { id: 'team-grid', name: 'Grid Response', discipline: 'Power systems', status: 'deployed', lead: 'M. Orin', members: 8 },
  { id: 'team-water', name: 'Water Authority', discipline: 'Water infrastructure', status: 'available', lead: 'S. Vale', members: 7 },
  { id: 'team-signals', name: 'Signals Intelligence', discipline: 'Network operations', status: 'deployed', lead: 'R. Ilyan', members: 9 },
  { id: 'team-environment', name: 'Environmental Response', discipline: 'Hazard assessment', status: 'standby', lead: 'J. Sera', members: 6 },
  { id: 'team-transit', name: 'Transit Control', discipline: 'Mobility operations', status: 'available', lead: 'T. Nix', members: 11 },
  { id: 'team-cyber', name: 'Cyber Cell', discipline: 'Digital security', status: 'deployed', lead: 'K. Maren', members: 5 },
]

export interface CityLayerDefinition {
  id: CityLayer
  label: string
  code: string
  color: string
  description: string
  legend: string
}

export const CITY_LAYERS: CityLayerDefinition[] = [
  { id: 'transport', label: 'Transport', code: 'TRN', color: '#56e1ff', description: 'Arterial flow, transit pods and corridor load', legend: 'Live route intensity' },
  { id: 'energy', label: 'Energy grid', code: 'NRG', color: '#f3b85a', description: 'Substations, transmission and load pulses', legend: 'Substation feed' },
  { id: 'water', label: 'Water network', code: 'WTR', color: '#5ce1a4', description: 'Pump pressure, reclamation and mains', legend: 'Pressure nodes' },
  { id: 'environment', label: 'Environment', code: 'ENV', color: '#8f7cff', description: 'Air quality field and thermal load', legend: 'AQI concentration' },
  { id: 'population', label: 'Population', code: 'POP', color: '#9ceeff', description: 'Density weighting across vertical districts', legend: 'Residents per cell' },
  { id: 'infrastructure', label: 'Critical assets', code: 'CRT', color: '#5b8def', description: 'Command, medical and data criticality', legend: 'Asset criticality' },
  { id: 'incidents', label: 'Incidents', code: 'INC', color: '#ff5d73', description: 'Active response markers and severity rings', legend: 'Severity' },
  { id: 'economy', label: 'Economic activity', code: 'ECO', color: '#c2a8ff', description: 'Market intensity and trade node activity', legend: 'Activity index' },
]

export const ACTIVE_INCIDENT_STATUSES: IncidentStatus[] = ['detected', 'investigating', 'assigned', 'mitigating']

export const DEMO_USERS = [
  {
    id: 'usr-elena',
    name: 'Elena Voss',
    email: 'elena.voss@nexus.local',
    password: 'nexus',
    roleId: 'analyst' as const,
    title: 'Principal Intelligence Analyst',
    clearance: 'L4 / SIGMA',
    status: 'active' as const,
    initials: 'EV',
    color: '#56e1ff',
    lastActive: DEMO_EPOCH_ISO,
  },
  {
    id: 'usr-aris',
    name: 'Aris Thorne',
    email: 'aris.thorne@nexus.local',
    password: 'nexus',
    roleId: 'super_admin' as const,
    title: 'Super Administrator',
    clearance: 'L6 / ROOT',
    status: 'active' as const,
    initials: 'AT',
    color: '#8f7cff',
    lastActive: '2026-11-04T14:18:00.000Z',
  },
  {
    id: 'usr-mira',
    name: 'Mira Chen',
    email: 'mira.chen@nexus.local',
    password: 'nexus',
    roleId: 'sys_admin' as const,
    title: 'Systems Administrator',
    clearance: 'L5 / KERNEL',
    status: 'active' as const,
    initials: 'MC',
    color: '#5b8def',
    lastActive: '2026-11-04T13:54:00.000Z',
  },
  {
    id: 'usr-dain',
    name: 'Dain Rook',
    email: 'dain.rook@nexus.local',
    password: 'nexus',
    roleId: 'ops_manager' as const,
    title: 'Operations Commander',
    clearance: 'L5 / COMMAND',
    status: 'active' as const,
    initials: 'DR',
    color: '#f3b85a',
    lastActive: '2026-11-04T14:29:00.000Z',
  },
  {
    id: 'usr-sera',
    name: 'Sera Ilyan',
    email: 'sera.ilyan@nexus.local',
    password: 'nexus',
    roleId: 'researcher' as const,
    title: 'Complex Systems Researcher',
    clearance: 'L3 / LAB',
    status: 'active' as const,
    initials: 'SI',
    color: '#5ce1a4',
    lastActive: '2026-11-04T12:41:00.000Z',
  },
  {
    id: 'usr-oren',
    name: 'Oren Vale',
    email: 'oren.vale@nexus.local',
    password: 'nexus',
    roleId: 'observer' as const,
    title: 'Liaison Observer',
    clearance: 'L1 / VIEW',
    status: 'active' as const,
    initials: 'OV',
    color: '#9aa8bb',
    lastActive: '2026-11-04T14:06:00.000Z',
  },
]

export const ARCHIVE_EVENTS = [
  { id: 'evt-01', date: '2021-03-18', title: 'Aurelia grid synchronization', type: 'energy', description: 'Eastern and western grids synchronized under the Helios accord.', impact: 62 },
  { id: 'evt-02', date: '2021-11-02', title: 'Tidal reclamation online', type: 'water', description: 'Tidal Basin reclamation expanded to 280 ML/day.', impact: 48 },
  { id: 'evt-03', date: '2022-05-27', title: 'Cross-City Line opens', type: 'mobility', description: 'Helix interchange connected to Meridian core.', impact: 71 },
  { id: 'evt-04', date: '2022-10-11', title: 'Foundry thermal incident', type: 'incident', description: 'Cascade failure at Foundry desalination; 19-hour recovery.', impact: 84 },
  { id: 'evt-05', date: '2023-02-04', title: 'Lumen storage array commissioned', type: 'energy', description: '1.4 GWh battery storage added to the eastern grid.', impact: 57 },
  { id: 'evt-06', date: '2023-08-19', title: 'North rainfall emergency', type: 'environment', description: 'Solace drainage exceeded capacity; 9 districts affected.', impact: 78 },
  { id: 'evt-07', date: '2024-01-23', title: 'Meridian data vault expansion', type: 'infrastructure', description: 'Regional intelligence storage doubled.', impact: 41 },
  { id: 'evt-08', date: '2024-06-30', title: 'Port automation transition', type: 'economy', description: 'Tidal port moved to autonomous freight orchestration.', impact: 66 },
  { id: 'evt-09', date: '2025-03-12', title: 'Aurelia composite peak', type: 'economy', description: 'Composite index reached its five-year high.', impact: 54 },
  { id: 'evt-10', date: '2025-09-08', title: 'Environmental inversion', type: 'environment', description: 'Foundry air quality index exceeded 210 for 36 hours.', impact: 69 },
  { id: 'evt-11', date: '2026-04-16', title: 'Digital twin v4 migration', type: 'infrastructure', description: 'Geospatial telemetry moved to the NEXUS digital twin.', impact: 39 },
  { id: 'evt-12', date: '2026-10-28', title: 'Kestrel medical surge exercise', type: 'incident', description: 'Regional emergency capability stress test.', impact: 32 },
]
