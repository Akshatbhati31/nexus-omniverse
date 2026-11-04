import {
  ChartNoAxesCombined,
  Globe2,
  Leaf,
  Network,
  Route,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { Entity, EntityKind } from '../types'

export type DomainId = 'geoint' | 'infrastructure' | 'environment' | 'economy' | 'mobility' | 'energy'

export interface DomainDefinition {
  id: DomainId
  label: string
  shortLabel: string
  code: string
  path: string
  description: string
  icon: LucideIcon
}

export const DOMAINS: DomainDefinition[] = [
  {
    id: 'geoint',
    label: 'Geographic Intelligence',
    shortLabel: 'GeoInt',
    code: 'GEO',
    path: '/geoint',
    description: 'Digital twin, district geometry and sensor coverage.',
    icon: Globe2,
  },
  {
    id: 'infrastructure',
    label: 'Infrastructure',
    shortLabel: 'Infra',
    code: 'INF',
    path: '/infrastructure',
    description: 'Critical assets, dependencies and continuity posture.',
    icon: Network,
  },
  {
    id: 'environment',
    label: 'Environmental',
    shortLabel: 'Environ',
    code: 'ENV',
    path: '/environment',
    description: 'Air, water, climate and environmental hazard telemetry.',
    icon: Leaf,
  },
  {
    id: 'economy',
    label: 'Economic',
    shortLabel: 'Economy',
    code: 'ECO',
    path: '/economy',
    description: 'Markets, trade corridors and supply-chain exposure.',
    icon: ChartNoAxesCombined,
  },
  {
    id: 'mobility',
    label: 'Mobility',
    shortLabel: 'Mobility',
    code: 'MOB',
    path: '/mobility',
    description: 'Transit lines, arterial corridors and network resilience.',
    icon: Route,
  },
  {
    id: 'energy',
    label: 'Energy Systems',
    shortLabel: 'Energy',
    code: 'NRG',
    path: '/energy',
    description: 'Generation, demand, storage and grid resilience.',
    icon: Zap,
  },
]

export const DOMAINS_BY_ID: Record<string, DomainDefinition> = Object.fromEntries(
  DOMAINS.map((domain) => [domain.id, domain]),
)

export type WorkspaceTone = 'cyan' | 'green' | 'amber' | 'red' | 'violet'

export interface WorkspaceMetric {
  label: string
  value: string
  unit: string
  delta: string
  tone: WorkspaceTone
  detail: string
}

export interface DomainWorkspace {
  id: string
  domain: DomainId
  label: string
  code: string
  tagline: string
  description: string
  entityKinds?: EntityKind[]
  entityTags: string[]
  entityIds?: string[]
  includeDistricts?: boolean
  chartDatasetId: string
  chartTitle: string
  chartType: 'line' | 'area' | 'bar'
  metrics: WorkspaceMetric[]
  brief: {
    title: string
    body: string
    factors: string[]
  }
  relatedWorkspaceIds: string[]
  relatedModules: Array<{ label: string; path: string; note: string }>
}

export const WORKSPACES: DomainWorkspace[] = [
  {
    id: 'twin-integrity',
    domain: 'geoint',
    label: 'Twin Integrity',
    code: 'GEO-L2-01',
    tagline: 'Reconciliation between the operating model and the city.',
    description:
      'Audit geometry, sensor coverage and record reconciliation across every district in the Aurelia digital twin. This workspace treats the twin itself as an operational asset.',
    entityTags: ['digital-twin', 'sensor', 'civic', 'command'],
    includeDistricts: true,
    chartDatasetId: 'metro_load',
    chartTitle: 'Twin telemetry reconciliation',
    chartType: 'area',
    metrics: [
      { label: 'Twin fidelity', value: '98.2', unit: '%', delta: '+0.4', tone: 'green', detail: 'Geometry reconciled to v4.6' },
      { label: 'Geometry drift', value: '0.6', unit: '%', delta: '-0.2', tone: 'cyan', detail: 'Below the 1.5% tolerance' },
      { label: 'Sensor coverage', value: '94.1', unit: '%', delta: '+1.1', tone: 'violet', detail: '142 of 151 mesh points reporting' },
      { label: 'Open record gaps', value: '3', unit: 'gaps', delta: '-1', tone: 'amber', detail: 'Two require field verification' },
    ],
    brief: {
      title: 'The twin is coherent, but three edges remain unverified.',
      body:
        'Reconciliation is holding above the operating threshold. The remaining gaps cluster around the Foundry industrial edge and the Tidal bridge interface, where geometry and live telemetry disagree by more than the accepted tolerance.',
      factors: [
        'Foundry thermal geometry lags the live sensor field by 11 minutes.',
        'Tidal bridge vibration records are reconciled against a structural model last updated 46 hours ago.',
        'No district has lost primary mesh coverage in the current window.',
      ],
    },
    relatedWorkspaceIds: ['coverage-gaps', 'dependency-analysis'],
    relatedModules: [
      { label: 'Incident command', path: '/incidents', note: 'Open response records touching reconciliation gaps' },
      { label: 'Infrastructure', path: '/infrastructure', note: 'Critical assets represented in the twin' },
    ],
  },
  {
    id: 'coverage-gaps',
    domain: 'geoint',
    label: 'Coverage Gaps',
    code: 'GEO-L2-02',
    tagline: 'Where the observation mesh thins out.',
    description:
      'Trace sensor density, mesh latency and environmental blind spots. This workspace separates true coverage gaps from normal telemetry variance before field resources are committed.',
    entityTags: ['sensor', 'air-quality', 'environment', 'science'],
    chartDatasetId: 'air_quality',
    chartTitle: 'Observation mesh variance',
    chartType: 'line',
    metrics: [
      { label: 'Active sensors', value: '142', unit: 'nodes', delta: '+3', tone: 'cyan', detail: 'Nine nodes in maintenance' },
      { label: 'Blind spots', value: '3', unit: 'zones', delta: '0', tone: 'amber', detail: 'All in the Foundry industrial edge' },
      { label: 'Mesh latency', value: '2.4', unit: 's', delta: '-0.3', tone: 'green', detail: 'Median ingestion delay' },
      { label: 'Coverage confidence', value: '91.6', unit: '%', delta: '+0.8', tone: 'violet', detail: 'Weighted by population exposure' },
    ],
    brief: {
      title: 'Coverage is acceptable, but the Foundry edge is structurally thin.',
      body:
        'The observation network is healthy at theater scale. The three persistent blind spots share a single cause: industrial interference around the Foundry thermal plume reduces effective sensor range and delays ingestion.',
      factors: [
        'Foundry mesh reports 18% lower sample density than the theater median.',
        'Vantage air observatory is carrying two adjacent mesh responsibilities.',
        'No coverage gap currently overlaps a Tier-0 facility footprint.',
      ],
    },
    relatedWorkspaceIds: ['twin-integrity', 'air-quality'],
    relatedModules: [
      { label: 'Environmental', path: '/environment', note: 'Air and water telemetry context' },
      { label: 'Energy systems', path: '/energy', note: 'Generation and industrial load correlation' },
    ],
  },
  {
    id: 'dependency-analysis',
    domain: 'infrastructure',
    label: 'Dependency Analysis',
    code: 'INF-L2-01',
    tagline: 'The critical paths hidden inside the asset inventory.',
    description:
      'Examine typed relationships, cascade depth and single points of failure across command, medical, data and utility assets. This is the working view for continuity planning, not a flat inventory.',
    entityTags: ['critical', 'data-center', 'command', 'transit', 'energy', 'water', 'medical'],
    chartDatasetId: 'metro_load',
    chartTitle: 'Dependency load propagation',
    chartType: 'area',
    metrics: [
      { label: 'Tier-0 nodes', value: '4', unit: 'assets', delta: '0', tone: 'red', detail: 'Command, data, medical and response' },
      { label: 'Dependency edges', value: '38', unit: 'links', delta: '+2', tone: 'cyan', detail: 'Typed relationships in scope' },
      { label: 'Single points', value: '2', unit: 'nodes', delta: '0', tone: 'amber', detail: 'Lumen grid and Meridian vault' },
      { label: 'Max cascade depth', value: '3', unit: 'hops', delta: '+1', tone: 'violet', detail: 'Grid → data → command' },
    ],
    brief: {
      title: 'Two nodes carry disproportionate cross-domain weight.',
      body:
        'Lumen Grid Node and Meridian Data Vault remain the highest-leverage dependencies in the theater. A sustained failure at either node reaches command and medical services within three hops, even when local redundancy is available.',
      factors: [
        'Lumen Grid Node supplies the data vault, response center and Foundry desalination.',
        'Meridian Data Vault is the only Tier-0 record store without a second physical site.',
        'Medical continuity depends on both nodes but retains 72 hours of protected fuel.',
      ],
    },
    relatedWorkspaceIds: ['continuity-review', 'grid-resilience'],
    relatedModules: [
      { label: 'Relationship network', path: '/network', note: 'Open the full typed graph' },
      { label: 'Incident command', path: '/incidents', note: 'Active events touching dependent assets' },
    ],
  },
  {
    id: 'continuity-review',
    domain: 'infrastructure',
    label: 'Continuity Review',
    code: 'INF-L2-02',
    tagline: 'Which services survive the next interruption?',
    description:
      'Review continuity coverage, failover evidence and untested assumptions across protected services. The workspace is designed for evidence review before a disruption, not after one.',
    entityTags: ['critical', 'continuity', 'tier-1', 'medical', 'data-center', 'command'],
    chartDatasetId: 'incident_velocity',
    chartTitle: 'Continuity exercise and incident velocity',
    chartType: 'line',
    metrics: [
      { label: 'Continuity coverage', value: '96.4', unit: '%', delta: '+0.6', tone: 'green', detail: 'Protected service baseline' },
      { label: 'Untested paths', value: '2', unit: 'paths', delta: '-1', tone: 'amber', detail: 'Vault failover and Foundry water' },
      { label: 'Last failover', value: '11m 42s', unit: 'elapsed', delta: '-2m', tone: 'cyan', detail: 'Response center continuity drill' },
      { label: 'Exercises passed', value: '7 / 8', unit: 'districts', delta: '+1', tone: 'violet', detail: 'Solace remains scheduled' },
    ],
    brief: {
      title: 'Continuity evidence is strong, with two assumptions still untested.',
      body:
        'Seven of eight districts have exercised a continuity path in the current cycle. The data vault failover and Foundry water substitution remain modeled rather than demonstrated, which limits confidence in a compound event.',
      factors: [
        'Response center failover completed in 11m 42s against a 20 minute objective.',
        'Kestrel Medical retains protected fuel and a validated alternate supply path.',
        'The Foundry water substitution plan has no recorded exercise in the last 90 days.',
      ],
    },
    relatedWorkspaceIds: ['dependency-analysis', 'generation-mix'],
    relatedModules: [
      { label: 'Reports', path: '/reports', note: 'Continuity products and evidence packages' },
      { label: 'Simulation lab', path: '/simulation', note: 'Stress the untested paths' },
    ],
  },
  {
    id: 'air-quality',
    domain: 'environment',
    label: 'Air Quality',
    code: 'ENV-L2-01',
    tagline: 'The atmospheric layer, read as an operational signal.',
    description:
      'Track mesh-level air quality, industrial thermal load and sensitive-zone exposure. This workspace links environmental readings to the facilities and response decisions that produce them.',
    entityTags: ['air-quality', 'sensor', 'industrial', 'thermal', 'environment', 'air'],
    chartDatasetId: 'air_quality',
    chartTitle: 'Air quality by observation mesh',
    chartType: 'area',
    metrics: [
      { label: 'Peak AQI', value: '184', unit: 'AQI', delta: '+12', tone: 'red', detail: 'Foundry industrial mesh' },
      { label: 'Sensitive zones', value: '2', unit: 'zones', delta: '0', tone: 'amber', detail: 'Foundry and Tidal edge' },
      { label: 'Sensor drift', value: '1.2', unit: '%', delta: '+0.1', tone: 'cyan', detail: 'Within calibration tolerance' },
      { label: 'Active advisories', value: '1', unit: 'advisory', delta: '0', tone: 'violet', detail: 'Sensitive-group guidance active' },
    ],
    brief: {
      title: 'The Foundry inversion is the dominant environmental constraint.',
      body:
        'Foundry air quality remains in the unhealthy band while the central and Vantage meshes sit closer to seasonal norms. The inversion is compounded by thermal load from the desalination complex and should be treated as an industrial coordination problem, not only a sensor anomaly.',
      factors: [
        'Foundry mesh AQI is 66 points above the theater median.',
        'Thermal load at Foundry Desalination is 11% above its nominal envelope.',
        'Vantage observatory provides the cleanest comparison series for attribution.',
      ],
    },
    relatedWorkspaceIds: ['water-stress', 'coverage-gaps'],
    relatedModules: [
      { label: 'Incident command', path: '/incidents', note: 'Environmental response records' },
      { label: 'GeoInt twin', path: '/geoint', note: 'Locate the affected mesh' },
    ],
  },
  {
    id: 'water-stress',
    domain: 'environment',
    label: 'Water Stress',
    code: 'ENV-L2-02',
    tagline: 'Reclamation, pressure and the tidal interface.',
    description:
      'Examine water production, network pressure, reclamation efficiency and tidal exposure across the southern basin. The workspace is scoped to the facilities that actually move water.',
    entityTags: ['water', 'coastal', 'reclamation', 'pumping', 'water-quality', 'tidal', 'bridge'],
    chartDatasetId: 'water_quality',
    chartTitle: 'Tidal water quality and reclamation',
    chartType: 'line',
    metrics: [
      { label: 'Reclamation rate', value: '96.4', unit: '%', delta: '+1.2', tone: 'green', detail: 'Tidal facility throughput' },
      { label: 'Network pressure', value: '74', unit: '%', delta: '+5.1', tone: 'cyan', detail: 'Vantage north pump load' },
      { label: 'Distribution loss', value: '6.8', unit: '%', delta: '-0.4', tone: 'violet', detail: 'Below the 8% target' },
      { label: 'Tidal gates active', value: '3', unit: 'gates', delta: '0', tone: 'amber', detail: 'Flood interface at watch' },
    ],
    brief: {
      title: 'The water network is stable, with the Foundry interface under load.',
      body:
        'Reclamation and pressure are within operating tolerances. Foundry Desalination is the weak link: thermal load is reducing membrane efficiency and constraining output while tidal gates remain at watch level.',
      factors: [
        'Foundry desalination output is 18.6 ML/day below its scheduled production.',
        'Tidal reclamation continues to exceed its 96% throughput objective.',
        'No distribution zone is currently below minimum pressure.',
      ],
    },
    relatedWorkspaceIds: ['air-quality', 'continuity-review'],
    relatedModules: [
      { label: 'Infrastructure', path: '/infrastructure', note: 'Water asset dependencies' },
      { label: 'Energy systems', path: '/energy', note: 'Pumping and desalination load' },
    ],
  },
  {
    id: 'supply-chain',
    domain: 'economy',
    label: 'Supply Chain',
    code: 'ECO-L2-01',
    tagline: 'Trade movement from port gate to industrial offtake.',
    description:
      'Trace freight corridors, port throughput and industrial dependencies as one movement system. This workspace connects economic records to the physical routes and assets they rely on.',
    entityTags: ['port', 'logistics', 'autonomous', 'industrial', 'freight', 'development'],
    chartDatasetId: 'economic_index',
    chartTitle: 'Trade momentum and corridor exposure',
    chartType: 'line',
    metrics: [
      { label: 'Port throughput', value: '96.4', unit: '%', delta: '+1.8', tone: 'green', detail: 'Autonomous freight orchestration' },
      { label: 'Freight delay', value: '18', unit: 'min', delta: '+6', tone: 'amber', detail: 'Tidal bridge restriction' },
      { label: 'Active lanes', value: '6', unit: 'lanes', delta: '0', tone: 'cyan', detail: 'Port, rail and arterial corridors' },
      { label: 'Exposed industries', value: '2', unit: 'sectors', delta: '+1', tone: 'violet', detail: 'Fabrication and retail' },
    ],
    brief: {
      title: 'Port capacity is strong; the bridge restriction is the constraint.',
      body:
        'Port throughput remains near its operating ceiling. The Tidal bridge restriction adds a predictable delay to the freight corridor and propagates into Foundry fabrication schedules, but current inventory buffers absorb the variance.',
      factors: [
        'Autonomous port orchestration is holding 96.4% throughput.',
        'The Port Freight Corridor is the most exposed physical link in the chain.',
        'Foundry fabrication carries less than two days of inbound buffer.',
      ],
    },
    relatedWorkspaceIds: ['market-stability', 'corridor-flow'],
    relatedModules: [
      { label: 'Mobility', path: '/mobility', note: 'Freight corridor and bridge status' },
      { label: 'Incident command', path: '/incidents', note: 'Logistics disruptions in scope' },
    ],
  },
  {
    id: 'market-stability',
    domain: 'economy',
    label: 'Market Stability',
    code: 'ECO-L2-02',
    tagline: 'Composite momentum and the institutions behind it.',
    description:
      'Review the simulated Aurelia composite, volatility and institutional exposure. Market records are clearly labeled fixtures and never presented as live exchange data.',
    entityKinds: ['organization', 'economic'],
    entityTags: ['finance', 'market', 'economic', 'capital', 'development'],
    chartDatasetId: 'economic_index',
    chartTitle: 'Aurelia composite and volatility',
    chartType: 'area',
    metrics: [
      { label: 'Composite', value: '1,284.6', unit: 'pts', delta: '+8.4', tone: 'green', detail: 'Simulated Aurelia exchange' },
      { label: 'Volatility', value: '17.4', unit: 'idx', delta: '+2.1', tone: 'amber', detail: '30-day modeled range' },
      { label: 'Liquidity', value: '82', unit: '%', delta: '-1.2', tone: 'cyan', detail: 'Institutional depth proxy' },
      { label: 'Watchlist', value: '3', unit: 'entities', delta: '0', tone: 'violet', detail: 'Development, energy and port exposure' },
    ],
    brief: {
      title: 'Momentum is positive, but volatility is concentrated in physical exposure.',
      body:
        'The composite is advancing on logistics and research strength. Volatility is not broad-based: it clusters around institutions whose balance sheets depend on port throughput and eastern grid capacity.',
      factors: [
        'Logistics and research carry the strongest positive contribution.',
        'Meridian Development Bank has the highest modeled exposure to industrial delay.',
        'All values are deterministic fixtures, not live market feeds.',
      ],
    },
    relatedWorkspaceIds: ['supply-chain', 'continuity-review'],
    relatedModules: [
      { label: 'Reports', path: '/reports', note: 'Market intelligence products' },
      { label: 'Analytics studio', path: '/analytics', note: 'Composite and volatility analysis' },
    ],
  },
  {
    id: 'corridor-flow',
    domain: 'mobility',
    label: 'Corridor Flow',
    code: 'MOB-L2-01',
    tagline: 'Movement as a measurable, constrained system.',
    description:
      'Inspect arterial throughput, transit load and freight movement together. The workspace exposes where a local restriction becomes a city-scale delay.',
    entityTags: ['arterial', 'road', 'transit', 'rail', 'bridge', 'priority-corridor', 'interchange'],
    chartDatasetId: 'mobility_flow',
    chartTitle: 'Corridor throughput by mode',
    chartType: 'area',
    metrics: [
      { label: 'Arterial speed', value: '46', unit: 'km/h', delta: '-4', tone: 'amber', detail: 'Weighted across N-7 and bridge links' },
      { label: 'Transit load', value: '78', unit: '%', delta: '+6', tone: 'cyan', detail: 'Peak cross-city line' },
      { label: 'Freight share', value: '17', unit: '%', delta: '+1', tone: 'violet', detail: 'Port corridor contribution' },
      { label: 'Restrictions', value: '2', unit: 'links', delta: '0', tone: 'red', detail: 'Tidal bridge and cross-city line' },
    ],
    brief: {
      title: 'The bridge restriction is propagating into the cross-city line.',
      body:
        'Arterial speed is below the morning target while transit load is above the comfort threshold. The two signals share a cause: the Tidal bridge restriction is shifting both private and freight demand onto the cross-city corridor.',
      factors: [
        'Tidal bridge is operating under a 40 km/h structural restriction.',
        'Cross-city line headway has widened from 6 to 8 minutes.',
        'The Port Freight Corridor remains nominal and is absorbing diverted freight.',
      ],
    },
    relatedWorkspaceIds: ['transit-resilience', 'supply-chain'],
    relatedModules: [
      { label: 'GeoInt twin', path: '/geoint', note: 'Locate the constrained corridor' },
      { label: 'Incident command', path: '/incidents', note: 'Transport disruption records' },
    ],
  },
  {
    id: 'transit-resilience',
    domain: 'mobility',
    label: 'Transit Resilience',
    code: 'MOB-L2-02',
    tagline: 'Headway, recovery and the limits of substitution.',
    description:
      'Assess transit line health, recovery time and the capacity available when a corridor fails. This workspace focuses on the routes and interchanges that carry substitution demand.',
    entityTags: ['rail', 'transit', 'freight', 'bridge', 'critical', 'loop', 'spine'],
    chartDatasetId: 'mobility_flow',
    chartTitle: 'Transit substitution and recovery',
    chartType: 'line',
    metrics: [
      { label: 'Lines monitored', value: '4', unit: 'lines', delta: '0', tone: 'cyan', detail: 'Rail, loop and cross-city' },
      { label: 'Degraded lines', value: '2', unit: 'lines', delta: '+1', tone: 'amber', detail: 'Cross-city and Tidal Express' },
      { label: 'Median headway', value: '8', unit: 'min', delta: '+2', tone: 'violet', detail: 'Weighted peak service' },
      { label: 'Recovery objective', value: '22', unit: 'min', delta: '-3', tone: 'green', detail: 'Modeled restoration window' },
    ],
    brief: {
      title: 'Substitution capacity exists, but it is concentrated at Helix.',
      body:
        'Two lines are degraded and recovery remains within the modeled objective. Helix Interchange is carrying the substitution load; if it becomes constrained, the network loses most of its remaining flexibility.',
      factors: [
        'Cross-city line is running at 86% load with an 8 minute headway.',
        'Helix Interchange is the only transfer point between both degraded lines.',
        'Freight diversion to the port corridor is relieving some arterial pressure.',
      ],
    },
    relatedWorkspaceIds: ['corridor-flow', 'continuity-review'],
    relatedModules: [
      { label: 'Infrastructure', path: '/infrastructure', note: 'Interchange and bridge dependencies' },
      { label: 'Simulation lab', path: '/simulation', note: 'Test closure and substitution scenarios' },
    ],
  },
  {
    id: 'grid-resilience',
    domain: 'energy',
    label: 'Grid Resilience',
    code: 'NRG-L2-01',
    tagline: 'Reserve margin, frequency and protected load.',
    description:
      'Read the eastern grid as a dependency system: generation, storage, substation load and the protected services that cannot tolerate interruption.',
    entityTags: ['energy', 'substation', 'storage', 'utility', 'operator'],
    entityIds: ['fac-nexus-dc', 'fac-foundry-plant', 'fac-kestrel-hospital', 'fac-north-pump'],
    chartDatasetId: 'energy_demand',
    chartTitle: 'Grid demand, renewable supply and reserve',
    chartType: 'area',
    metrics: [
      { label: 'Reserve margin', value: '11.4', unit: '%', delta: '-6.8', tone: 'red', detail: 'Below the 18% operating target' },
      { label: 'Frequency', value: '49.81', unit: 'Hz', delta: '-0.14', tone: 'amber', detail: 'Outside the narrow band' },
      { label: 'Storage reserve', value: '42', unit: '%', delta: '-12.6', tone: 'violet', detail: 'Lumen battery array' },
      { label: 'Protected loads', value: '6', unit: 'assets', delta: '0', tone: 'cyan', detail: 'Medical, data, water and command' },
    ],
    brief: {
      title: 'The eastern grid is stable but operating without a comfortable margin.',
      body:
        'Reserve is well below target and storage has been dispatched twice in the current window. The risk is not an immediate outage; it is the loss of headroom needed to absorb a second contingency at Lumen or Foundry.',
      factors: [
        'Lumen Grid Node is carrying 87% substation load with 42% battery reserve.',
        'Foundry Desalination is the largest flexible industrial offtake in scope.',
        'Protected loads retain priority feed but no additional reserve.',
      ],
    },
    relatedWorkspaceIds: ['generation-mix', 'dependency-analysis'],
    relatedModules: [
      { label: 'Incident command', path: '/incidents', note: 'Power and infrastructure events' },
      { label: 'Infrastructure', path: '/infrastructure', note: 'Grid dependency chain' },
    ],
  },
  {
    id: 'generation-mix',
    domain: 'energy',
    label: 'Generation Mix',
    code: 'NRG-L2-02',
    tagline: 'What is actually producing, and what is only forecast.',
    description:
      'Compare renewable yield, firm capacity and curtailment across the generation estate. This workspace keeps modeled forecasts distinct from observed production.',
    entityTags: ['solar', 'renewable', 'energy', 'utility'],
    entityIds: ['fac-lumen-grid', 'fac-nexus-dc'],
    chartDatasetId: 'energy_demand',
    chartTitle: 'Observed supply against modeled demand',
    chartType: 'line',
    metrics: [
      { label: 'Renewable share', value: '37', unit: '%', delta: '+2', tone: 'green', detail: 'Of observed metropolitan supply' },
      { label: 'Solar yield', value: '82', unit: '%', delta: '+3.2', tone: 'amber', detail: 'Solace array performance' },
      { label: 'Curtailment', value: '4.1', unit: '%', delta: '-1.4', tone: 'cyan', detail: 'Renewable energy discarded' },
      { label: 'Firm capacity', value: '1.8', unit: 'GW', delta: '0', tone: 'violet', detail: 'Lumen node nameplate' },
    ],
    brief: {
      title: 'Renewable output is healthy; firm capacity is the binding constraint.',
      body:
        'Solar yield is above its seasonal model and curtailment is falling. The grid still depends on firm capacity at Lumen to cover the evening transition, which is why generation mix cannot be assessed separately from reserve margin.',
      factors: [
        'Solace Solar Array is producing 318 MW against a 420 MW nameplate.',
        'Curtailment is down 1.4 points as midday storage arbitration improves.',
        'Evening firm capacity remains the limiting factor for reserve recovery.',
      ],
    },
    relatedWorkspaceIds: ['grid-resilience', 'water-stress'],
    relatedModules: [
      { label: 'Environmental', path: '/environment', note: 'Renewable and thermal context' },
      { label: 'Analytics studio', path: '/analytics', note: 'Compare generation scenarios' },
    ],
  },
]

export function getDomain(id: string | null | undefined) {
  return id ? DOMAINS_BY_ID[id] : undefined
}

export function getWorkspaceById(id: string | null | undefined) {
  return id ? WORKSPACES.find((workspace) => workspace.id === id) : undefined
}

export function getWorkspacesForDomain(domain: DomainId) {
  return WORKSPACES.filter((workspace) => workspace.domain === domain)
}

export function getWorkspaceHref(workspace: DomainWorkspace) {
  return `${DOMAINS_BY_ID[workspace.domain]?.path ?? '/overview'}/workspace/${workspace.id}`
}

export function workspaceMatchesEntity(workspace: DomainWorkspace, entity: Entity) {
  if (workspace.entityIds?.includes(entity.id)) return true
  const kindMatch = workspace.entityKinds?.includes(entity.kind) ?? false
  const tagMatch = workspace.entityTags.some((tag) => entity.tags.includes(tag))
  return kindMatch || tagMatch
}

export function getWorkspaceEntities(workspace: DomainWorkspace, entities: Entity[]) {
  return entities.filter((entity) => {
    if (entity.kind === 'city') return false
    if (workspace.includeDistricts && entity.kind === 'district') return true
    return workspaceMatchesEntity(workspace, entity)
  })
}
