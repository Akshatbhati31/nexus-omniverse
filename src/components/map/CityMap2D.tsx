import { useId } from 'react'
import type { CityLayer, Entity, Incident } from '../../types'
import { BRIDGES, CITY_LAYERS, DISTRICTS, RIVER_PATH, SEVERITY_COLORS } from '../../data/constants'
import { cn } from '../../lib/utils'

interface CityMap2DProps {
  layers: Set<CityLayer>
  entities: Entity[]
  incidents: Incident[]
  selectedEntityId?: string
  onSelectEntity?: (entityId: string) => void
  onSelectIncident?: (incidentId: string) => void
  compact?: boolean
  className?: string
}

const ENERGY_LINKS = [
  ['fac-lumen-grid', 'fac-solace-solar'],
  ['fac-lumen-grid', 'fac-nexus-dc'],
  ['fac-lumen-grid', 'fac-foundry-plant'],
  ['fac-solace-solar', 'fac-arc'],
]

const WATER_LINKS = [
  ['fac-foundry-plant', 'fac-tidal-water'],
  ['fac-north-pump', 'fac-kestrel-hospital'],
  ['fac-north-pump', 'fac-tidal-water'],
]

const ROUTE_LINKS = [
  ['route-arterial-north', 'route-bridge-tidal'],
  ['route-bridge-tidal', 'route-freight-09'],
  ['route-transit-01', 'fac-helix-tower'],
  ['route-transit-02', 'fac-helix-tower'],
]

const INFRA_FILTER = new Set(['fac-arc', 'fac-nexus-dc', 'fac-kestrel-hospital', 'fac-port', 'fac-helix-tower'])
const ENERGY_FILTER = new Set(['fac-lumen-grid', 'fac-solace-solar', 'org-helios'])
const WATER_FILTER = new Set(['fac-tidal-water', 'fac-north-pump', 'fac-foundry-plant', 'env-water-tidal'])
const ENV_FILTER = new Set(['env-air-central', 'env-water-tidal', 'env-climate-solace', 'fac-vantage-air'])
const ECONOMY_FILTER = new Set(['econ-composite', 'fac-port', 'org-meridian-bank', 'org-aurelia-port'])

export function CityMap2D({
  layers,
  entities,
  incidents,
  selectedEntityId,
  onSelectEntity,
  onSelectIncident,
  compact = false,
  className,
}: CityMap2DProps) {
  const id = useId().replaceAll(':', '')
  const byId = Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  const activeIncidents = incidents.filter((incident) => !['resolved', 'archived'].includes(incident.status))
  const activeLayers = CITY_LAYERS.filter((layer) => layers.has(layer.id))

  const visibleFacilities = entities.filter((entity) => {
    if (!entity.map || !['facility', 'landmark', 'economic', 'environmental', 'organization'].includes(entity.kind)) return false
    if (layers.has('infrastructure') && INFRA_FILTER.has(entity.id)) return true
    if (layers.has('energy') && ENERGY_FILTER.has(entity.id)) return true
    if (layers.has('water') && WATER_FILTER.has(entity.id)) return true
    if (layers.has('environment') && ENV_FILTER.has(entity.id)) return true
    if (layers.has('economy') && ECONOMY_FILTER.has(entity.id)) return true
    return false
  })

  const drawLinks = (pairs: string[][], color: string, dashed = false) =>
    pairs.map(([from, to]) => {
      const source = byId[from]?.map
      const target = byId[to]?.map
      if (!source || !target) return null
      const midX = (source.x + target.x) / 2
      const midY = (source.y + target.y) / 2 - 16
      return (
        <path
          key={`${from}-${to}`}
          d={`M ${source.x} ${source.y} Q ${midX} ${midY} ${target.x} ${target.y}`}
          fill="none"
          stroke={color}
          strokeWidth="1"
          strokeOpacity="0.36"
          strokeDasharray={dashed ? '3 5' : undefined}
          className={dashed ? 'dash-flow' : undefined}
        />
      )
    })

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-[#050a10]', className)}>
      <svg viewBox="0 0 1000 620" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label="Aurelia Prime operational map">
        <defs>
          <pattern id={`grid-${id}`} width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(112,148,180,0.09)" strokeWidth="0.5" />
          </pattern>
          <radialGradient id={`glow-${id}`}>
            <stop offset="0%" stopColor="#56e1ff" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#56e1ff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`river-${id}`} x1="0" x2="1">
            <stop offset="0%" stopColor="#0c3b4a" />
            <stop offset="50%" stopColor="#126476" />
            <stop offset="100%" stopColor="#0b3442" />
          </linearGradient>
          <filter id={`soft-${id}`}>
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        <rect width="1000" height="620" fill="#050a10" />
        <rect width="1000" height="620" fill={`url(#grid-${id})`} />
        <ellipse cx="500" cy="300" rx="460" ry="260" fill={`url(#glow-${id})`} opacity="0.55" />

        <path d={RIVER_PATH} fill="none" stroke={`url(#river-${id})`} strokeWidth="54" opacity="0.7" />
        <path d={RIVER_PATH} fill="none" stroke="#56e1ff" strokeWidth="1" strokeOpacity="0.28" />
        <path d={RIVER_PATH} fill="none" stroke="#9ceeff" strokeWidth="0.6" strokeOpacity="0.2" strokeDasharray="8 20" className="dash-flow" />

        {DISTRICTS.map((district) => {
          const populationWeight = layers.has('population') ? 0.16 + (district.population / 2_000_000) * 0.12 : 0.06
          return (
            <g key={district.id}>
              <path
                d={district.path}
                fill={district.color}
                fillOpacity={populationWeight}
                stroke={district.color}
                strokeOpacity="0.28"
                strokeWidth="0.8"
              />
              <path d={district.path} fill="none" stroke="#050a10" strokeWidth="1" opacity="0.5" />
              {!compact ? (
                <text
                  x={district.center.x}
                  y={district.center.y + 4}
                  textAnchor="middle"
                  fill={district.color}
                  fillOpacity="0.8"
                  fontSize="8"
                  fontFamily="JetBrains Mono Variable, monospace"
                  letterSpacing="2.5"
                >
                  {district.code}
                </text>
              ) : null}
            </g>
          )
        })}

        {layers.has('transport') ? (
          <g>
            {drawLinks(ROUTE_LINKS, '#56e1ff', true)}
            {[
              [140, 220, 820, 280],
              [280, 430, 760, 430],
              [430, 120, 480, 520],
              [180, 360, 860, 380],
            ].map(([x1, y1, x2, y2], index) => (
              <g key={index}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#56e1ff" strokeOpacity="0.12" strokeWidth="5" />
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#56e1ff" strokeOpacity="0.38" strokeWidth="0.7" strokeDasharray="5 12" className="dash-flow" />
              </g>
            ))}
          </g>
        ) : null}

        {layers.has('energy') ? <g>{drawLinks(ENERGY_LINKS, '#f3b85a')}</g> : null}
        {layers.has('water') ? <g>{drawLinks(WATER_LINKS, '#5ce1a4', true)}</g> : null}

        {BRIDGES.map((bridge) => (
          <g key={bridge.id}>
            <line x1={bridge.x - 24} y1={bridge.y} x2={bridge.x + 24} y2={bridge.y} stroke="#8f7cff" strokeWidth="3" strokeOpacity="0.5" />
            <circle cx={bridge.x} cy={bridge.y} r="3" fill="#8f7cff" />
            {!compact ? (
              <text x={bridge.x + 8} y={bridge.y - 8} fill="#7e91a8" fontSize="6" fontFamily="JetBrains Mono Variable" letterSpacing="1">
                {bridge.label.toUpperCase()}
              </text>
            ) : null}
          </g>
        ))}

        {visibleFacilities.map((entity) => {
          const point = entity.map!
          const selected = entity.id === selectedEntityId
          const color =
            entity.kind === 'environmental' || entity.id === 'fac-vantage-air'
              ? '#8f7cff'
              : entity.id === 'fac-lumen-grid' || entity.id === 'fac-solace-solar'
                ? '#f3b85a'
                : entity.id === 'fac-tidal-water' || entity.id === 'fac-north-pump'
                  ? '#5ce1a4'
                  : '#56e1ff'
          return (
            <g
              key={entity.id}
              className="cursor-pointer"
              onClick={() => onSelectEntity?.(entity.id)}
              role="button"
              tabIndex={0}
              aria-label={`Select ${entity.name}`}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelectEntity?.(entity.id)
                }
              }}
            >
              <circle cx={point.x} cy={point.y} r={selected ? 13 : 9} fill={color} opacity="0.08" />
              <circle cx={point.x} cy={point.y} r={selected ? 7 : 4.5} fill={color} fillOpacity={selected ? 0.9 : 0.55} stroke={color} strokeWidth="0.7" />
              <circle cx={point.x} cy={point.y} r={selected ? 13 : 9} fill="none" stroke={color} strokeWidth="0.5" opacity={selected ? 0.9 : 0.35} />
              {selected ? <circle cx={point.x} cy={point.y} r="17" fill="none" stroke={color} strokeWidth="0.5" opacity="0.5" className="glow-ring" /> : null}
              {!compact ? (
                <text x={point.x + 8} y={point.y + 2.5} fill={color} fillOpacity="0.7" fontSize="5.8" fontFamily="JetBrains Mono Variable" letterSpacing="0.6">
                  {entity.name.length > 22 ? `${entity.name.slice(0, 21)}…` : entity.name}
                </text>
              ) : null}
            </g>
          )
        })}

        {layers.has('incidents')
          ? activeIncidents.map((incident) => (
              <g
                key={incident.id}
                className="cursor-pointer"
                onClick={() => onSelectIncident?.(incident.id)}
                role="button"
                tabIndex={0}
                aria-label={`Open incident ${incident.reference}: ${incident.title}`}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelectIncident?.(incident.id)
                  }
                }}
              >
                <circle cx={incident.map.x} cy={incident.map.y} r="16" fill="none" stroke={SEVERITY_COLORS[incident.severity]} strokeWidth="0.7" opacity="0.6" className="glow-ring" />
                <circle cx={incident.map.x} cy={incident.map.y} r="5" fill={SEVERITY_COLORS[incident.severity]} opacity="0.9" />
                <circle cx={incident.map.x} cy={incident.map.y} r="10" fill="none" stroke={SEVERITY_COLORS[incident.severity]} strokeWidth="0.7" opacity="0.45" />
                {!compact && incident.severity === 'critical' ? (
                  <text x={incident.map.x + 9} y={incident.map.y - 6} fill={SEVERITY_COLORS[incident.severity]} fontSize="5.5" fontFamily="JetBrains Mono Variable">
                    {incident.reference}
                  </text>
                ) : null}
              </g>
            ))
          : null}

        {layers.has('environment') ? (
          <g opacity="0.55">
            {[1, 2, 3, 4, 5].map((ring) => (
              <ellipse key={ring} cx="748" cy="464" rx={ring * 34} ry={ring * 23} fill="none" stroke="#8f7cff" strokeWidth="0.5" strokeOpacity={0.22 - ring * 0.03} />
            ))}
            <text x="748" y="428" textAnchor="middle" fill="#8f7cff" fontSize="6" fontFamily="JetBrains Mono Variable" letterSpacing="1">
              AQI PLUME 168
            </text>
          </g>
        ) : null}

        <rect x="0" y="0" width="1000" height="620" fill="none" stroke="rgba(86,225,255,0.06)" />
        <line x1="0" y1="590" x2="1000" y2="590" stroke="rgba(86,225,255,0.15)" strokeWidth="0.5" />
        <text x="16" y="606" fill="#536277" fontSize="6.5" fontFamily="JetBrains Mono Variable" letterSpacing="1.2">
          AURELIA PRIME · DIGITAL TWIN / 2D SCHEMATIC · SIMULATED
        </text>
      </svg>

      {!compact ? (
        <div className="pointer-events-none absolute right-3 top-3 flex flex-col gap-1 border border-[var(--line)] bg-[rgba(5,10,16,0.82)] px-2.5 py-2 backdrop-blur-sm">
          {activeLayers.map((layer) => (
            <div key={layer.id} className="flex items-center gap-1.5">
              <span className="h-1 w-2.5" style={{ background: layer.color }} />
              <span className="font-mono text-[7px] uppercase tracking-[0.1em] text-[var(--muted)]">{layer.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
