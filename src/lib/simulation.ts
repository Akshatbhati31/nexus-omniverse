import type {
  SimulationImpact,
  SimulationKind,
  SimulationParameters,
  SimulationResult,
  SimulationSeriesPoint,
} from '../types'
import { createRng, hashString } from './seeded'

export interface SimulationModel {
  kind: SimulationKind
  label: string
  code: string
  description: string
  hypothesis: string
  accent: string
  nodeLabel: string
  nodeOptions: string[]
  defaults: SimulationParameters
  primaryLabel: string
  secondaryLabel: string
  tertiaryLabel: string
}

export const SIMULATION_MODELS: Record<SimulationKind, SimulationModel> = {
  route_closure: {
    kind: 'route_closure',
    label: 'Corridor closure',
    code: 'TRN-01',
    description: 'Propagate a transport corridor closure across connected route nodes and estimate travel-time response.',
    hypothesis: 'If a primary corridor is removed, adjacent nodes absorb displaced load until saturation.',
    accent: '#56e1ff',
    nodeLabel: 'Closure node',
    nodeOptions: ['Arterial N-7', 'Tidal Bridge', 'Cross-City Line', 'Port Freight Corridor', 'Helix Interchange'],
    defaults: { duration: 12, intensity: 78, affectedNode: 'Arterial N-7', rainfall: 22, populationChange: 4, redundancy: true, cascadeDepth: 3 },
    primaryLabel: 'Mean travel time',
    secondaryLabel: 'Displaced commuters',
    tertiaryLabel: 'Network load',
  },
  power_shortage: {
    kind: 'power_shortage',
    label: 'Power deficit',
    code: 'NRG-02',
    description: 'Model a generation or substation deficit, cascade depth and service restoration envelope.',
    hypothesis: 'Load transfer is possible only while remaining substations retain headroom above safe reserve.',
    accent: '#f3b85a',
    nodeLabel: 'Origin node',
    nodeOptions: ['Lumen Grid Node', 'Meridian Command', 'Foundry Desalination', 'Kestrel Medical', 'Solace Solar Array'],
    defaults: { duration: 24, intensity: 64, affectedNode: 'Lumen Grid Node', rainfall: 0, populationChange: 0, redundancy: true, cascadeDepth: 2 },
    primaryLabel: 'Unserved load',
    secondaryLabel: 'Customers affected',
    tertiaryLabel: 'Reserve margin',
  },
  supply_chain: {
    kind: 'supply_chain',
    label: 'Supply chain shock',
    code: 'ECO-03',
    description: 'Simulate a supply chain node disruption and its propagation into throughput and regional cost.',
    hypothesis: 'Buffer inventory absorbs the first hours; downstream effects compound after replenishment windows close.',
    accent: '#c2a8ff',
    nodeLabel: 'Disrupted node',
    nodeOptions: ['Port of Aurelia', 'Helix Interchange', 'Foundry Fabrication', 'Meridian Finance', 'Tidal Reclamation'],
    defaults: { duration: 48, intensity: 71, affectedNode: 'Port of Aurelia', rainfall: 0, populationChange: 0, redundancy: false, cascadeDepth: 3 },
    primaryLabel: 'Throughput loss',
    secondaryLabel: 'Delay exposure',
    tertiaryLabel: 'Cost pressure',
  },
  rainfall: {
    kind: 'rainfall',
    label: 'Rainfall surge',
    code: 'ENV-04',
    description: 'Evaluate drainage saturation, surface accumulation and district-level flood exposure.',
    hypothesis: 'Drainage capacity is the binding constraint; low-elevation districts accumulate water after 90 minutes.',
    accent: '#5ce1a4',
    nodeLabel: 'Focus district',
    nodeOptions: ['Tidal Basin', 'Solace Ring', 'Vantage Ridge', 'Foundry Belt', 'Meridian Core'],
    defaults: { duration: 18, intensity: 58, affectedNode: 'Tidal Basin', rainfall: 64, populationChange: 0, redundancy: false, cascadeDepth: 2 },
    primaryLabel: 'Drainage load',
    secondaryLabel: 'Flood exposure',
    tertiaryLabel: 'Response demand',
  },
  population_growth: {
    kind: 'population_growth',
    label: 'Population pressure',
    code: 'POP-05',
    description: 'Project resource demand under a population growth assumption over a rolling planning horizon.',
    hypothesis: 'Water and transit capacity respond non-linearly once district density exceeds current headroom.',
    accent: '#9ceeff',
    nodeLabel: 'Planning district',
    nodeOptions: ['Meridian Core', 'Helix Quarter', 'Kestrel Heights', 'Tidal Basin', 'Vantage Point'],
    defaults: { duration: 72, intensity: 42, affectedNode: 'Meridian Core', rainfall: 0, populationChange: 12, redundancy: true, cascadeDepth: 2 },
    primaryLabel: 'Resource demand',
    secondaryLabel: 'Capacity headroom',
    tertiaryLabel: 'Service strain',
  },
}

function buildSeries(
  params: SimulationParameters,
  kind: SimulationKind,
  labels: [string, string, string],
): SimulationSeriesPoint[] {
  const random = createRng(hashString(JSON.stringify(params) + kind))
  const points = 17
  const duration = Math.max(4, params.duration)
  const intensity = params.intensity / 100
  const redundancy = params.redundancy ? 0.68 : 1
  const cascade = 1 + params.cascadeDepth * 0.12
  const rainfall = params.rainfall / 100
  const growth = params.populationChange / 100

  return Array.from({ length: points }, (_, index) => {
    const progress = index / (points - 1)
    const hour = Math.round(progress * duration)
    const onset = 1 - Math.exp(-progress * (kind === 'rainfall' ? 6 : 3.2))
    const recovery = kind === 'population_growth' ? 0 : Math.max(0, progress - 0.7) * 1.5
    const wave = Math.sin(progress * Math.PI * 3 + random()) * 0.035
    let primary = 0
    let secondary = 0
    let tertiary = 0

    switch (kind) {
      case 'route_closure':
        primary = 18 + 18 * intensity * redundancy * cascade * onset - recovery * 4 + wave * 16
        secondary = 26 + 88 * intensity * onset * cascade + wave * 22
        tertiary = 54 + 44 * intensity * redundancy * onset - recovery * 11
        break
      case 'power_shortage':
        primary = 40 + 230 * intensity * redundancy * onset * cascade + wave * 70
        secondary = 8_000 + 71_000 * intensity * onset * cascade + wave * 6_000
        tertiary = 26 - 18 * intensity * onset * redundancy + recovery * 8 + wave * 8
        break
      case 'supply_chain':
        primary = 3 + 31 * intensity * onset * (1 + params.cascadeDepth * 0.16) + wave * 4
        secondary = 1.5 + 8.6 * intensity * onset * cascade + wave * 1.4
        tertiary = 1 + 15 * intensity * onset * cascade + wave * 2.4
        break
      case 'rainfall':
        primary = 32 + 67 * intensity * rainfall * onset * (params.redundancy ? 0.8 : 1) + wave * 14
        secondary = 3 + 38 * intensity * rainfall * onset * cascade + wave * 7
        tertiary = 18 + 62 * intensity * rainfall * onset + wave * 12
        break
      case 'population_growth':
        primary = 100 + 38 * growth * progress + 10 * intensity * progress + wave * 4
        secondary = 44 - 29 * growth * progress - 8 * intensity * progress + wave * 3
        tertiary = 20 + 44 * growth * progress + 15 * intensity * progress + wave * 6
        break
    }

    return {
      hour,
      label: `${hour}h`,
      primary: Number(Math.max(0, primary).toFixed(1)),
      secondary: Number(Math.max(0, secondary).toFixed(1)),
      tertiary: Number(Math.max(0, tertiary).toFixed(1)),
      ...{ primaryLabel: labels[0], secondaryLabel: labels[1], tertiaryLabel: labels[2] },
    }
  })
}

function impact(
  label: string,
  value: string,
  delta: number,
  direction: 'up' | 'down' | 'neutral',
  severity: SimulationImpact['severity'],
  description: string,
): SimulationImpact {
  return { label, value, delta, direction, severity, description }
}

export function runSimulation(kind: SimulationKind, params: SimulationParameters): SimulationResult {
  const model = SIMULATION_MODELS[kind]
  const series = buildSeries(params, kind, [model.primaryLabel, model.secondaryLabel, model.tertiaryLabel])
  const last = series[series.length - 1]
  const peak = series.reduce((max, point) => (point.primary > max.primary ? point : max), series[0])
  const intensity = params.intensity / 100
  const cascadeFactor = 1 + params.cascadeDepth * 0.14
  const confidence = Math.max(63, Math.round(94 - params.cascadeDepth * 3.1 - (params.redundancy ? 0 : 4.5)))
  const impacts: SimulationImpact[] = []
  let summary = ''

  switch (kind) {
    case 'route_closure':
      impacts.push(
        impact('Peak travel-time increase', `+${Math.round(last.primary - 18)} min`, Math.round(((last.primary - 18) / 18) * 100), 'up', 'high', `${params.affectedNode} closure diverts flow into adjacent corridors.`),
        impact('Displaced commuters', `${Math.round(last.secondary)}k`, Math.round(last.secondary), 'up', 'critical', 'Estimated trips requiring rerouting during the peak window.'),
        impact('Economic delay cost', `$${(1.8 * intensity * cascadeFactor * 10).toFixed(1)}M`, Math.round(18 * intensity), 'up', 'moderate', 'Value-of-time model across affected trips and freight.'),
        impact('Redundancy relief', params.redundancy ? 'Active' : 'Unavailable', params.redundancy ? -22 : 0, params.redundancy ? 'down' : 'neutral', params.redundancy ? 'low' : 'high', 'Alternate corridor capacity is included in the model.'),
      )
      summary = `Closing ${params.affectedNode} for ${params.duration}h produces a peak mean travel-time penalty of ${Math.round(last.primary - 18)} minutes. Load propagates through ${params.cascadeDepth} connected node tiers; ${params.redundancy ? 'alternate corridor capacity materially reduces' : 'the absence of corridor redundancy amplifies'} the disruption.`
      break
    case 'power_shortage':
      impacts.push(
        impact('Peak unserved load', `${Math.round(peak.primary)} MW`, Math.round((peak.primary / 80) * 100), 'up', 'critical', 'Maximum simultaneous load shedding during the event.'),
        impact('Customers affected', `${Math.round(last.secondary / 1000)}k`, Math.round(last.secondary / 1000), 'up', 'critical', 'Residential, civic and industrial service points.'),
        impact('Reserve margin low', `${Math.max(2, last.tertiary).toFixed(0)}%`, -Math.round(28 - last.tertiary), 'down', 'high', 'Remaining headroom below the 18% operating reserve.'),
        impact('Restoration window', `${Math.max(3, Math.round(params.duration * 0.42))}h`, -12, 'down', 'moderate', 'Estimated stabilization time after load transfer.'),
      )
      summary = `A ${Math.round(params.intensity)}% deficit at ${params.affectedNode} propagates across ${params.cascadeDepth} transfer tiers. The model projects up to ${Math.round(peak.primary)} MW of unserved load and prioritizes medical, command and water assets.`
      break
    case 'supply_chain':
      impacts.push(
        impact('Throughput loss', `${last.primary.toFixed(0)}%`, Math.round(last.primary), 'up', 'high', 'Cumulative throughput shortfall across the downstream network.'),
        impact('Delay exposure', `${last.secondary.toFixed(1)} days`, Math.round(last.secondary * 12), 'up', 'high', 'Mean replenishment delay at first-tier dependents.'),
        impact('Cost pressure', `$${last.tertiary.toFixed(1)}M`, Math.round(last.tertiary * 7), 'up', 'moderate', 'Freight, substitution and expedited sourcing premium.'),
        impact('Buffer absorption', params.redundancy ? '34 hours' : '11 hours', params.redundancy ? -31 : 0, params.redundancy ? 'down' : 'neutral', params.redundancy ? 'low' : 'high', 'Regional buffer stock delays downstream impact.'),
      )
      summary = `Disruption at ${params.affectedNode} produces a ${last.primary.toFixed(0)}% throughput loss over ${params.duration}h. Cascade depth ${params.cascadeDepth} reaches second-tier suppliers; ${params.redundancy ? 'regional buffer inventory absorbs the initial shock' : 'thin buffers allow immediate propagation into dependent sectors'}.`
      break
    case 'rainfall':
      impacts.push(
        impact('Peak drainage load', `${Math.min(132, peak.primary).toFixed(0)}%`, Math.round(peak.primary - 32), 'up', peak.primary > 100 ? 'critical' : 'high', 'Utilization of combined drainage and retention capacity.'),
        impact('Flood exposure', `${Math.round(last.secondary)} km²`, Math.round(last.secondary * 8), 'up', 'high', 'Low-elevation surface area with accumulation risk.'),
        impact('Response demand', `${Math.round(last.tertiary)} units`, Math.round(last.tertiary), 'up', 'moderate', 'Pumping, barrier and emergency response requirements.'),
        impact('Retention deficit', `${Math.max(0, Math.round(peak.primary - 92))}%`, Math.round(peak.primary - 92), 'up', peak.primary > 100 ? 'critical' : 'moderate', 'Volume exceeding real-time retention capacity.'),
      )
      summary = `A ${params.rainfall} mm rainfall event focused on ${params.affectedNode} saturates drainage within the first 90 minutes. Peak system load reaches ${Math.min(132, peak.primary).toFixed(0)}%; flood exposure concentrates in low-elevation blocks.`
      break
    case 'population_growth':
      impacts.push(
        impact('Resource demand', `${last.primary.toFixed(0)} index`, Math.round(last.primary - 100), 'up', 'high', 'Composite water, power and transit demand index.'),
        impact('Capacity headroom', `${Math.max(4, last.secondary).toFixed(0)}%`, -Math.round(44 - last.secondary), 'down', 'high', 'Remaining planning headroom under current capital projects.'),
        impact('Service strain', `${last.tertiary.toFixed(0)} index`, Math.round(last.tertiary - 20), 'up', 'moderate', 'Non-linear service pressure at peak demand.'),
        impact('Population added', `${Math.round(params.populationChange * 11.4)}k`, Math.round(params.populationChange * 11.4), 'up', 'moderate', `Planning increment applied to ${params.affectedNode}.`),
      )
      summary = `A ${params.populationChange}% population increase in ${params.affectedNode} over the planning horizon raises composite resource demand to ${last.primary.toFixed(0)}. Water and transit headroom fall below target thresholds before the horizon closes.`
      break
  }

  return {
    kind,
    title: `${model.label} / ${params.affectedNode}`,
    horizonHours: params.duration,
    confidence,
    summary,
    series,
    impacts,
    affectedNodes: [
      params.affectedNode,
      ...model.nodeOptions.filter((node) => node !== params.affectedNode).slice(0, params.cascadeDepth),
    ],
    modelNotes: [
      'Hypothetical scenario — not a real-world prediction.',
      'Deterministic graph propagation with bounded capacity assumptions.',
      `Cascade depth ${params.cascadeDepth}; redundancy ${params.redundancy ? 'enabled' : 'disabled'}.`,
      'Outputs are intended for demonstration and decision-support exploration only.',
    ],
  }
}

export function defaultParameters(kind: SimulationKind): SimulationParameters {
  return { ...SIMULATION_MODELS[kind].defaults }
}
