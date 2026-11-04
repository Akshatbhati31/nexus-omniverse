import type {
  Evidence,
  Incident,
  IncidentCategory,
  IncidentNote,
  IncidentSeverity,
  IncidentStatus,
  IncidentTimelineEntry,
  MapPoint,
} from '../types'
import { DEMO_EPOCH, INCIDENT_STATUS_FLOW } from './constants'
import { getEntity } from './entities'

const at = (minutesAgo: number) => new Date(DEMO_EPOCH - minutesAgo * 60_000).toISOString()

interface IncidentSeed {
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
  detectedMinutesAgo: number
  notes?: Array<{ author: string; body: string; minutesAgo: number }>
  evidence?: Array<{ label: string; kind: Evidence['kind']; reference: string; addedBy: string }>
}

function buildTimeline(seed: IncidentSeed): IncidentTimelineEntry[] {
  const targetIndex = INCIDENT_STATUS_FLOW.indexOf(seed.status)
  const entries: IncidentTimelineEntry[] = []
  const detectedAt = at(seed.detectedMinutesAgo)
  entries.push({
    id: `${seed.id}-evt-detected`,
    at: detectedAt,
    kind: 'detected',
    title: 'Detection event',
    detail: `Automated sensor fusion raised ${seed.reference} with ${seed.confidence}% confidence.`,
  })

  for (let index = 1; index <= targetIndex; index += 1) {
    const from = INCIDENT_STATUS_FLOW[index - 1]
    const to = INCIDENT_STATUS_FLOW[index]
    const offset = Math.round((seed.detectedMinutesAgo * index) / (targetIndex + 1.4))
    entries.push({
      id: `${seed.id}-evt-${index}`,
      at: at(Math.max(1, seed.detectedMinutesAgo - offset)),
      kind: to === 'resolved' ? 'resolution' : 'status',
      title: `Status → ${to.charAt(0).toUpperCase()}${to.slice(1)}`,
      detail:
        to === 'assigned'
          ? `Response ownership transferred to ${seed.teams.join(' + ') || 'operations command'}.`
          : to === 'mitigating'
            ? 'Containment actions initiated; telemetry under continuous review.'
            : to === 'resolved'
              ? 'Stabilization confirmed across monitored metrics.'
              : to === 'archived'
                ? 'Resolution report verified and incident record archived.'
                : 'Workflow advanced by command authority.',
      from,
      to,
      actor: seed.commander,
    })
  }

  return entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
}

function buildNotes(seed: IncidentSeed): IncidentNote[] {
  return (seed.notes ?? []).map((note, index) => ({
    id: `${seed.id}-note-${index}`,
    author: note.author,
    body: note.body,
    createdAt: at(note.minutesAgo),
  }))
}

function buildEvidence(seed: IncidentSeed): Evidence[] {
  return (seed.evidence ?? []).map((evidence, index) => ({
    id: `${seed.id}-evidence-${index}`,
    label: evidence.label,
    kind: evidence.kind,
    reference: evidence.reference,
    addedBy: evidence.addedBy,
    addedAt: at(Math.max(2, seed.detectedMinutesAgo - 10 - index * 4)),
  }))
}

function makeIncident(seed: IncidentSeed): Incident {
  const entity = getEntity(seed.primaryEntityId)
  const map: MapPoint = entity?.map ?? { x: 500, y: 300 }
  const timeline = buildTimeline(seed)
  const lastEvent = timeline[timeline.length - 1]
  const resolved = seed.status === 'resolved' || seed.status === 'archived'
  return {
    id: seed.id,
    reference: seed.reference,
    title: seed.title,
    category: seed.category,
    severity: seed.severity,
    status: seed.status,
    districtId: seed.districtId,
    primaryEntityId: seed.primaryEntityId,
    relatedEntityIds: seed.relatedEntityIds,
    commander: seed.commander,
    teams: seed.teams,
    summary: seed.summary,
    confidence: seed.confidence,
    impactScore: seed.impactScore,
    detectedAt: at(seed.detectedMinutesAgo),
    updatedAt: lastEvent?.at ?? at(seed.detectedMinutesAgo),
    resolvedAt: resolved ? lastEvent?.at : undefined,
    resolution: resolved
      ? seed.status === 'archived'
        ? 'Corrective actions verified. Monitoring returned to baseline. Record retained in the historical archive.'
        : 'Primary indicators stabilized. Follow-up inspection scheduled and residual risk accepted by command.'
      : undefined,
    timeline,
    notes: buildNotes(seed),
    evidence: buildEvidence(seed),
    map,
  }
}

const seeds: IncidentSeed[] = [
  {
    id: 'inc-2841',
    reference: 'INC-2841',
    title: 'Lumen grid frequency instability',
    category: 'power_outage',
    severity: 'critical',
    status: 'mitigating',
    districtId: 'dist-lumen',
    primaryEntityId: 'fac-lumen-grid',
    relatedEntityIds: ['org-helios', 'fac-nexus-dc', 'fac-solace-solar'],
    commander: 'Dain Rook',
    teams: ['Grid Response', 'Meridian Response'],
    summary:
      'A 0.14 Hz frequency excursion at the Lumen grid node triggered fast-reserve dispatch and selective industrial load reduction. Data vault services remain on backup feed. Grid operators are stabilizing the eastern transmission interface.',
    confidence: 94,
    impactScore: 88,
    detectedMinutesAgo: 42,
    notes: [
      { author: 'M. Orin', body: 'Battery array dispatched 280 MW. Reserve margin recovered to 11.4%, still below target. Holding industrial curtailment for now.', minutesAgo: 21 },
      { author: 'Dain Rook', body: 'Priority loads protected: Meridian Data Vault, Kestrel Medical, North Pump. Prepare escalation if frequency breaches 49.75 again.', minutesAgo: 9 },
    ],
    evidence: [
      { label: 'Frequency telemetry 14:02–14:30 UTC', kind: 'telemetry', reference: 'telemetry/lumen-frequency-2841.json', addedBy: 'M. Orin' },
      { label: 'Reserve dispatch log', kind: 'document', reference: 'logs/grid-dispatch-2841.txt', addedBy: 'Dain Rook' },
    ],
  },
  {
    id: 'inc-2840',
    reference: 'INC-2840',
    title: 'Tidal Bridge structural vibration',
    category: 'infrastructure_failure',
    severity: 'high',
    status: 'investigating',
    districtId: 'dist-tidal',
    primaryEntityId: 'route-bridge-tidal',
    relatedEntityIds: ['route-transit-01', 'fac-port', 'dist-tidal'],
    commander: 'Dain Rook',
    teams: ['Meridian Response', 'Transit Control'],
    summary:
      'Mid-span accelerometers recorded elevated vibration during a freight-heavy traffic window. Rail service continues at reduced speed while structural engineering assesses the expansion joint and bearing assembly.',
    confidence: 87,
    impactScore: 71,
    detectedMinutesAgo: 96,
    notes: [
      { author: 'T. Nix', body: 'Loop trains restricted to 40 km/h across the central span. No visible track geometry deviation.', minutesAgo: 48 },
    ],
    evidence: [
      { label: 'Accelerometer trace — span 4', kind: 'telemetry', reference: 'telemetry/tidal-span4-2840.csv', addedBy: 'T. Nix' },
    ],
  },
  {
    id: 'inc-2839',
    reference: 'INC-2839',
    title: 'Foundry inversion air quality exceedance',
    category: 'environmental_emergency',
    severity: 'high',
    status: 'assigned',
    districtId: 'dist-foundry',
    primaryEntityId: 'env-air-central',
    relatedEntityIds: ['fac-foundry-plant', 'dist-foundry', 'fac-vantage-air'],
    commander: 'J. Sera',
    teams: ['Environmental Response'],
    summary:
      'A boundary-layer inversion trapped industrial emissions over the Foundry Belt. Central AQI reached 168 with PM2.5 at 71 µg/m³. A public advisory is in force for sensitive groups in Foundry and eastern Tidal Basin.',
    confidence: 91,
    impactScore: 76,
    detectedMinutesAgo: 138,
    notes: [
      { author: 'J. Sera', body: 'Advisory issued. Foundry thermal plume remains the dominant source signature. Requesting production throttling options.', minutesAgo: 52 },
    ],
    evidence: [
      { label: 'AQI mesh snapshot', kind: 'image', reference: 'imagery/aqi-foundry-2839.png', addedBy: 'J. Sera' },
    ],
  },
  {
    id: 'inc-2838',
    reference: 'INC-2838',
    title: 'Cross-City signal interlocking fault',
    category: 'transport_disruption',
    severity: 'moderate',
    status: 'assigned',
    districtId: 'dist-helix',
    primaryEntityId: 'route-transit-02',
    relatedEntityIds: ['fac-helix-tower', 'dist-helix', 'dist-lumen'],
    commander: 'Dain Rook',
    teams: ['Transit Control', 'Signals Intelligence'],
    summary:
      'Interlocking node 7 failed to acknowledge a route set, reducing Cross-City Line service to an 8-minute headway between Helix Interchange and Lumen Fields. A diagnostic bypass is being validated.',
    confidence: 98,
    impactScore: 54,
    detectedMinutesAgo: 55,
    notes: [
      { author: 'R. Ilyan', body: 'Fault isolated to the westbound route-set acknowledgement path. No evidence of external interference.', minutesAgo: 18 },
    ],
    evidence: [
      { label: 'Interlocking event log', kind: 'document', reference: 'logs/interlock-node7-2838.log', addedBy: 'R. Ilyan' },
    ],
  },
  {
    id: 'inc-2837',
    reference: 'INC-2837',
    title: 'Vantage water pressure collapse',
    category: 'water_disruption',
    severity: 'high',
    status: 'mitigating',
    districtId: 'dist-vantage',
    primaryEntityId: 'fac-north-pump',
    relatedEntityIds: ['fac-kestrel-hospital', 'dist-vantage', 'fac-foundry-plant'],
    commander: 'S. Vale',
    teams: ['Water Authority'],
    summary:
      'Pump 4 seal failure dropped discharge pressure to 3.1 bar across the western pressure zone. A bypass manifold restored partial service; Kestrel Medical remains on protected supply.',
    confidence: 96,
    impactScore: 69,
    detectedMinutesAgo: 210,
    notes: [
      { author: 'S. Vale', body: 'Bypass is holding at 4.8 bar. Seal replacement kit en route, ETA 38 minutes.', minutesAgo: 35 },
      { author: 'Dain Rook', body: 'Medical priority confirmed. Notify Vantage residents if pressure falls below 3.5 bar again.', minutesAgo: 28 },
    ],
    evidence: [
      { label: 'Pump 4 pressure trace', kind: 'telemetry', reference: 'telemetry/northpump-pressure-2837.json', addedBy: 'S. Vale' },
    ],
  },
  {
    id: 'inc-2836',
    reference: 'INC-2836',
    title: 'Port telemetry intrusion attempt',
    category: 'network_failure',
    severity: 'critical',
    status: 'investigating',
    districtId: 'dist-tidal',
    primaryEntityId: 'fac-nexus-dc',
    relatedEntityIds: ['fac-port', 'org-aurelia-port', 'dist-tidal'],
    commander: 'K. Maren',
    teams: ['Cyber Cell', 'Signals Intelligence'],
    summary:
      'Anomalous eastbound traffic against the port terminal control segment triggered automated isolation. Freight operations are unaffected. Forensic analysis is tracing a credential-stuffing pattern against a decommissioned partner endpoint.',
    confidence: 83,
    impactScore: 82,
    detectedMinutesAgo: 34,
    notes: [
      { author: 'K. Maren', body: 'Segment isolation confirmed. No lateral movement observed. Rotating partner credentials as precaution.', minutesAgo: 11 },
    ],
    evidence: [
      { label: 'Network flow anomaly capture', kind: 'telemetry', reference: 'telemetry/port-netflow-2836.pcap', addedBy: 'K. Maren' },
    ],
  },
  {
    id: 'inc-2835',
    reference: 'INC-2835',
    title: 'Foundry thermal plume expansion',
    category: 'environmental_emergency',
    severity: 'moderate',
    status: 'detected',
    districtId: 'dist-foundry',
    primaryEntityId: 'fac-foundry-plant',
    relatedEntityIds: ['env-air-central', 'dist-foundry'],
    commander: 'Unassigned',
    teams: [],
    summary:
      'Thermal imaging indicates the Foundry desalination plume has expanded 400 m beyond its normal envelope. Automated correlation with the AQI mesh is underway.',
    confidence: 74,
    impactScore: 48,
    detectedMinutesAgo: 18,
    evidence: [
      { label: 'Thermal plume frame', kind: 'image', reference: 'imagery/foundry-thermal-2835.png', addedBy: 'System' },
    ],
  },
  {
    id: 'inc-2834',
    reference: 'INC-2834',
    title: 'Freight corridor debris blockage',
    category: 'transport_disruption',
    severity: 'low',
    status: 'resolved',
    districtId: 'dist-tidal',
    primaryEntityId: 'route-freight-09',
    relatedEntityIds: ['fac-port', 'dist-foundry'],
    commander: 'T. Nix',
    teams: ['Transit Control'],
    summary:
      'Debris from a construction vehicle blocked the southbound autonomous freight lane for 44 minutes. Traffic was rerouted and the lane reopened after inspection.',
    confidence: 99,
    impactScore: 24,
    detectedMinutesAgo: 320,
    notes: [
      { author: 'T. Nix', body: 'Corridor reopened. Autonomous platoon queue cleared in 12 minutes.', minutesAgo: 210 },
    ],
    evidence: [
      { label: 'Lane inspection image', kind: 'image', reference: 'imagery/freight-lane-2834.jpg', addedBy: 'T. Nix' },
    ],
  },
  {
    id: 'inc-2833',
    reference: 'INC-2833',
    title: 'Kestrel backup power transfer anomaly',
    category: 'power_outage',
    severity: 'moderate',
    status: 'resolved',
    districtId: 'dist-kestrel',
    primaryEntityId: 'fac-kestrel-hospital',
    relatedEntityIds: ['fac-north-pump', 'dist-kestrel'],
    commander: 'M. Orin',
    teams: ['Grid Response'],
    summary:
      'A scheduled backup power transfer produced a 4.2 second voltage sag in the eastern medical wing. Patient-critical systems remained on uninterruptible supply; generator synchronization was recalibrated.',
    confidence: 97,
    impactScore: 38,
    detectedMinutesAgo: 620,
    notes: [
      { author: 'M. Orin', body: 'Transfer test passed after governor adjustment. No clinical impact reported.', minutesAgo: 420 },
    ],
    evidence: [
      { label: 'Generator transfer trace', kind: 'telemetry', reference: 'telemetry/kestrel-gen-2833.csv', addedBy: 'M. Orin' },
    ],
  },
  {
    id: 'inc-2832',
    reference: 'INC-2832',
    title: 'Solace inverter cluster offline',
    category: 'power_outage',
    severity: 'low',
    status: 'archived',
    districtId: 'dist-solace',
    primaryEntityId: 'fac-solace-solar',
    relatedEntityIds: ['fac-lumen-grid', 'org-helios'],
    commander: 'M. Orin',
    teams: ['Grid Response'],
    summary:
      'A firmware fault took inverter cluster B4 offline for 27 minutes, reducing solar output by 38 MW. Firmware rollback restored operation; the event record has been archived.',
    confidence: 99,
    impactScore: 18,
    detectedMinutesAgo: 1_580,
    evidence: [
      { label: 'Inverter fault dump', kind: 'document', reference: 'logs/inverter-b4-2832.txt', addedBy: 'M. Orin' },
    ],
  },
  {
    id: 'inc-2831',
    reference: 'INC-2831',
    title: 'Data vault cooling loop drift',
    category: 'infrastructure_failure',
    severity: 'high',
    status: 'assigned',
    districtId: 'dist-meridian',
    primaryEntityId: 'fac-nexus-dc',
    relatedEntityIds: ['fac-arc', 'fac-lumen-grid'],
    commander: 'Mira Chen',
    teams: ['Meridian Response', 'Grid Response'],
    summary:
      'Secondary coolant loop pressure drift reduced data vault cooling headroom to 12%. Workloads were shifted to the northern hall; no service interruption has occurred.',
    confidence: 95,
    impactScore: 64,
    detectedMinutesAgo: 72,
    notes: [
      { author: 'Mira Chen', body: 'Workload migration complete. Holding on backup cooling while seal inspection proceeds.', minutesAgo: 26 },
    ],
    evidence: [
      { label: 'Cooling loop pressure log', kind: 'telemetry', reference: 'telemetry/vault-cooling-2831.json', addedBy: 'Mira Chen' },
    ],
  },
  {
    id: 'inc-2830',
    reference: 'INC-2830',
    title: 'Tidal water quality excursion',
    category: 'water_disruption',
    severity: 'moderate',
    status: 'archived',
    districtId: 'dist-tidal',
    primaryEntityId: 'env-water-tidal',
    relatedEntityIds: ['fac-tidal-water', 'dist-tidal'],
    commander: 'S. Vale',
    teams: ['Water Authority', 'Environmental Response'],
    summary:
      'Turbidity briefly exceeded the operational threshold at outfall node 4 following a maintenance backwash. Discharge was rerouted to retention, and the outfall returned to standard after 41 minutes.',
    confidence: 98,
    impactScore: 29,
    detectedMinutesAgo: 2_300,
    evidence: [
      { label: 'Outfall sample results', kind: 'document', reference: 'samples/outfall-2830.pdf', addedBy: 'S. Vale' },
    ],
  },
]

export const INCIDENTS: Incident[] = seeds.map(makeIncident)
