import type { ChatMessage, Entity, Incident, MessageSource, Report, SimulationRun } from '../types'
import { formatDateTime } from './format'

export interface AIResponse {
  content: string
  sources: MessageSource[]
  engine: 'deterministic' | 'external'
}

export interface AIContext {
  entities: Entity[]
  incidents: Incident[]
  simulations: SimulationRun[]
  reports: Report[]
}

export const AI_ENDPOINT = (import.meta.env.VITE_NEXUS_AI_ENDPOINT as string | undefined) ?? ''
export const AI_ENGINE_LABEL = AI_ENDPOINT ? 'EXTERNAL MODEL ENDPOINT' : 'DETERMINISTIC LOCAL ENGINE'
export const AI_ENGINE_DESCRIPTION = AI_ENDPOINT
  ? 'Requests are forwarded to the configured model endpoint.'
  : 'No model endpoint is configured. Responses are generated locally from deterministic platform records.'

function findEntity(query: string, entities: Entity[]) {
  const normalized = query.toLowerCase()
  return entities
    .filter((entity) => normalized.includes(entity.name.toLowerCase()) || normalized.includes(entity.code.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length)[0]
}

function sourceFromEntity(entity: Entity): MessageSource {
  return { label: entity.name, entityId: entity.id, href: `/entity/${entity.id}` }
}

function sourceFromIncident(incident: Incident): MessageSource {
  return { label: `${incident.reference} · ${incident.title}`, href: `/incidents/${incident.id}` }
}

export function generateDeterministicResponse(query: string, context: AIContext): AIResponse {
  const normalized = query.toLowerCase().trim()
  const active = context.incidents.filter((incident) => !['resolved', 'archived'].includes(incident.status))
  const critical = active.filter((incident) => incident.severity === 'critical')
  const entity = findEntity(query, context.entities)

  const incidentMatch = context.incidents.find((incident) => normalized.includes(incident.reference.toLowerCase()))
  if (incidentMatch) {
    return {
      engine: 'deterministic',
      content: `${incidentMatch.reference} — ${incidentMatch.title}\n\nStatus: ${incidentMatch.status.toUpperCase()} · Severity: ${incidentMatch.severity.toUpperCase()} · Confidence: ${incidentMatch.confidence}%\n\n${incidentMatch.summary}\n\nCommand: ${incidentMatch.commander}. Assigned elements: ${incidentMatch.teams.join(', ') || 'none yet'}. The record currently carries an impact score of ${incidentMatch.impactScore}/100. Most recent ledger update: ${formatDateTime(incidentMatch.updatedAt)} UTC.`,
      sources: [
        sourceFromIncident(incidentMatch),
        ...incidentMatch.relatedEntityIds.slice(0, 2).map((id) => {
          const related = context.entities.find((candidate) => candidate.id === id)
          return related ? sourceFromEntity(related) : { label: id }
        }),
      ],
    }
  }

  if (entity) {
    const relatedIncidents = context.incidents.filter(
      (incident) => incident.primaryEntityId === entity.id || incident.relatedEntityIds.includes(entity.id),
    )
    return {
      engine: 'deterministic',
      content: `${entity.name} (${entity.code}) is a ${entity.kind} operating in ${entity.districtId?.replace('dist-', '') ?? 'the metropolitan theater'}.\n\nStatus: ${entity.status.toUpperCase()} · Criticality: ${entity.criticality.toUpperCase()}\n\n${entity.description}\n\nKey telemetry: ${entity.vitals.map((vital) => `${vital.label} ${vital.value.toLocaleString()} ${vital.unit}`).join(' · ')}.\n\n${relatedIncidents.length ? `${relatedIncidents.length} linked incident${relatedIncidents.length === 1 ? '' : 's'} exist in the command ledger, including ${relatedIncidents.slice(0, 2).map((incident) => incident.reference).join(' and ')}.` : 'No active incidents are directly linked to this entity.'}`,
      sources: [
        sourceFromEntity(entity),
        ...relatedIncidents.slice(0, 2).map(sourceFromIncident),
      ],
    }
  }

  if (/(grid|energy|power|reserve|outage)/.test(normalized)) {
    const incident = context.incidents.find((item) => item.id === 'inc-2841')
    const grid = context.entities.find((item) => item.id === 'fac-lumen-grid')
    return {
      engine: 'deterministic',
      content: `Eastern grid posture is degraded but contained. Lumen Grid Node is carrying elevated load with reserve margin below target following the frequency excursion. Fast-reserve storage has been dispatched and selective industrial curtailment remains active.\n\nThe most consequential dependency chain is Lumen → Meridian Data Vault → Aurelia Response Center. The data vault remains available but is operating on backup cooling. Kestrel Medical is on protected supply.\n\nHold industrial curtailment until reserve margin exceeds 18% for two consecutive hours. If frequency breaches 49.75 Hz again, escalate to command and pre-stage the northern reserve.`,
      sources: [
        ...(grid ? [sourceFromEntity(grid)] : []),
        ...(incident ? [sourceFromIncident(incident)] : []),
        { label: 'Energy Systems', href: '/energy' },
      ],
    }
  }

  if (/(bridge|transport|mobility|transit|traffic|route)/.test(normalized)) {
    const bridge = context.entities.find((item) => item.id === 'route-bridge-tidal')
    const incident = context.incidents.find((item) => item.id === 'inc-2840')
    return {
      engine: 'deterministic',
      content: `Mobility posture is constrained in the southern corridor. Tidal Bridge accelerometers recorded elevated vibration during a freight-heavy window. Rail service is restricted to 40 km/h across the central span while structural engineering evaluates the bearing assembly.\n\nCross-City Line is separately degraded due to an interlocking fault, reducing headway between Helix and Lumen. These events are not physically linked, but they compound southern corridor delay.\n\nI recommend keeping the bridge under active monitoring and pre-loading the Vantage diversion plan if vibration exceeds the current envelope.`,
      sources: [
        ...(bridge ? [sourceFromEntity(bridge)] : []),
        ...(incident ? [sourceFromIncident(incident)] : []),
        { label: 'Mobility Intelligence', href: '/mobility' },
      ],
    }
  }

  if (/(air|environment|aqi|climate|rain|water|flood)/.test(normalized)) {
    const air = context.entities.find((item) => item.id === 'env-air-central')
    const water = context.incidents.find((item) => item.id === 'inc-2837')
    return {
      engine: 'deterministic',
      content: `Environmental conditions are mixed. A boundary-layer inversion is trapping emissions over Foundry Belt, with the central AQI mesh above the advisory threshold. Sensitive-group guidance is active for Foundry and eastern Tidal Basin. Thermal plume expansion is the dominant local source signature.\n\nWater pressure in Vantage has been partially restored via bypass, but North Pump remains degraded. Tidal water quality is within standard at the outfall.\n\nRecommended: maintain the Foundry advisory, request production throttling if AQI remains above 150 for another hour, and protect Kestrel Medical supply pressure.`,
      sources: [
        ...(air ? [sourceFromEntity(air)] : []),
        ...(water ? [sourceFromIncident(water)] : []),
        { label: 'Environmental Intelligence', href: '/environment' },
      ],
    }
  }

  if (/(simulation|scenario|what if|impact)/.test(normalized)) {
    const latest = context.simulations[0]
    return {
      engine: 'deterministic',
      content: latest
        ? `The latest saved scenario is “${latest.name}”. It is a hypothetical ${latest.result.kind.replaceAll('_', ' ')} run over ${latest.result.horizonHours} hours at ${latest.result.confidence}% model confidence.\n\n${latest.result.summary}\n\nThis is a deterministic decision-support model, not a real-world prediction. You can compare it against other saved runs or modify the cascade depth and redundancy assumptions in the Simulation Laboratory.`
        : 'No saved scenarios are available yet. Open the Simulation Laboratory to construct a hypothetical route, power, supply-chain, rainfall or population scenario.',
      sources: latest
        ? [{ label: latest.name, href: '/simulation' }, { label: 'Simulation Laboratory', href: '/simulation' }]
        : [{ label: 'Simulation Laboratory', href: '/simulation' }],
    }
  }

  if (/(incident|threat|risk|summary|brief)/.test(normalized)) {
    const top = critical[0] ?? active[0]
    return {
      engine: 'deterministic',
      content: `The operating theater currently has ${active.length} active incidents, including ${critical.length} critical event${critical.length === 1 ? '' : 's'}.\n\nPriority: ${critical.map((incident) => `${incident.reference} ${incident.title}`).join('; ') || 'no critical events'}.\n\n${top ? `The highest-impact active event is ${top.reference} with an impact score of ${top.impactScore}/100. ${top.summary}` : 'No active events require command attention.'}\n\nCross-domain risk is concentrated in the eastern energy corridor, the southern transport corridor and Foundry environmental conditions.`,
      sources: [
        ...critical.slice(0, 3).map(sourceFromIncident),
        { label: 'Incident Command', href: '/incidents' },
      ],
    }
  }

  if (/(econom|market|trade|supply|index|commodity)/.test(normalized)) {
    return {
      engine: 'deterministic',
      content: `The Aurelia Composite Index is holding positive momentum, supported by logistics and energy. Trade throughput remains strong through the Port of Aurelia, though the Foundry environmental event creates a local industrial drag.\n\nPrincipal exposure is concentrated in the port–freight–Foundry chain. A prolonged port or corridor disruption would propagate into manufacturing and consumer sectors within 11–34 hours depending on buffer depth.\n\nUse the Economic Intelligence workspace to inspect the Sankey flow and the supply-chain scenario model.`,
      sources: [
        { label: 'Economic Intelligence', href: '/economy' },
        { label: 'Port of Aurelia', entityId: 'fac-port', href: '/entity/fac-port' },
        { label: 'Aurelia Composite Index', entityId: 'econ-composite', href: '/entity/econ-composite' },
      ],
    }
  }

  if (/(report|draft|briefing)/.test(normalized)) {
    return {
      engine: 'deterministic',
      content: `${context.reports.length} reports are present in the workspace. The Aurelia Daily Intelligence Brief is in review and captures the grid, bridge and air-quality signals. The Foundry Environmental Risk Assessment is in draft. The Tidal Corridor Resilience Review is published.\n\nFor the current cycle, I recommend advancing the daily brief to command review and attaching the latest grid reserve trace before publication.`,
      sources: [
        ...context.reports.slice(0, 3).map((report) => ({ label: report.title, href: `/reports/${report.id}` })),
      ],
    }
  }

  return {
    engine: 'deterministic',
    content: `I can investigate entities, summarize incidents, interpret platform telemetry, compare scenarios and draft analytical language using the records available to this workspace.\n\nCurrent picture: ${active.length} active incidents, ${critical.length} critical. Eastern grid reserve is constrained; Tidal Bridge remains under structural review; Foundry air quality is above advisory threshold.\n\nAsk me about a specific entity or incident, or request a cross-domain risk summary. I will cite the records used. This is the deterministic local engine — no external model endpoint is configured.`,
    sources: [
      { label: 'Global Overview', href: '/overview' },
      { label: 'Incident Command', href: '/incidents' },
      { label: 'Network', href: '/network' },
    ],
  }
}

export async function requestIntelligence(query: string, context: AIContext, history: ChatMessage[]): Promise<AIResponse> {
  if (!AI_ENDPOINT) {
    return generateDeterministicResponse(query, context)
  }

  try {
    const response = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        history: history.map((message) => ({ role: message.role, content: message.content })),
        context: {
          entityIds: context.entities.map((entity) => entity.id),
          incidentIds: context.incidents.map((incident) => incident.id),
          simulationIds: context.simulations.map((simulation) => simulation.id),
          reportIds: context.reports.map((report) => report.id),
        },
      }),
    })
    if (!response.ok) throw new Error(`Endpoint returned ${response.status}`)
    const payload = (await response.json()) as { content?: string; sources?: MessageSource[] }
    if (!payload.content) throw new Error('Endpoint response did not contain content')
    return { content: payload.content, sources: payload.sources ?? [], engine: 'external' }
  } catch {
    const fallback = generateDeterministicResponse(query, context)
    return {
      ...fallback,
      content: `External endpoint unavailable; deterministic fallback engaged.\n\n${fallback.content}`,
    }
  }
}
