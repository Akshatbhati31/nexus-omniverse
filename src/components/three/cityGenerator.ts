import { DISTRICTS } from '../../data/constants'
import { createRng } from '../../lib/seeded'
import type { Entity, MapPoint } from '../../types'

export interface CityBuilding {
  id: string
  name: string
  districtId: string
  entityId: string
  position: [number, number, number]
  width: number
  depth: number
  height: number
  occupancy: number
  energy: number
  risk: number
}

export function mapToWorld(point: MapPoint): [number, number] {
  return [(point.x - 500) / 9.2, (point.y - 310) / 9.2]
}

export function mapToWorld3(point: MapPoint, y = 0): [number, number, number] {
  const [x, z] = mapToWorld(point)
  return [x, y, z]
}

const districtDensity: Record<string, number> = {
  'dist-meridian': 1.65,
  'dist-helix': 1.4,
  'dist-kestrel': 1.05,
  'dist-lumen': 0.82,
  'dist-foundry': 0.92,
  'dist-tidal': 1.05,
  'dist-vantage': 0.8,
  'dist-solace': 0.58,
}

export function generateBuildings(entities: Entity[]): CityBuilding[] {
  const buildings: CityBuilding[] = []
  const facilitiesByDistrict = new Map<string, Entity[]>()
  entities
    .filter((entity) => ['facility', 'landmark'].includes(entity.kind) && entity.districtId)
    .forEach((entity) => {
      const list = facilitiesByDistrict.get(entity.districtId!) ?? []
      list.push(entity)
      facilitiesByDistrict.set(entity.districtId!, list)
    })

  DISTRICTS.forEach((district) => {
    const random = createRng(`buildings-${district.id}`)
    const [centerX, centerZ] = mapToWorld(district.center)
    const density = districtDensity[district.id] ?? 1
    const facilities = facilitiesByDistrict.get(district.id) ?? []
    let buildingIndex = 0
    const grid = 5
    const spacing = 4.4 + (1 - density) * 1.3
    for (let row = 0; row < grid; row += 1) {
      for (let column = 0; column < grid; column += 1) {
        if (random() < 0.13) continue
        const offsetX = (column - (grid - 1) / 2) * spacing + (random() - 0.5) * 1.2
        const offsetZ = (row - (grid - 1) / 2) * spacing + (random() - 0.5) * 1.2
        const width = 1.6 + random() * 1.9
        const depth = 1.6 + random() * 1.9
        const centerBias = 1 - Math.min(1, Math.hypot(offsetX, offsetZ) / (spacing * 3.2))
        const height = (2.5 + random() * 5 + centerBias * 9 * density) * (0.8 + random() * 0.5)
        const facility = facilities[buildingIndex % Math.max(1, facilities.length)]
        const entityId = buildingIndex < facilities.length && facility ? facility.id : district.id
        const name = facility && buildingIndex < facilities.length ? facility.name : `${district.code} ${String(buildingIndex + 1).padStart(2, '0')}`
        buildings.push({
          id: `${district.id}-b${buildingIndex}`,
          name,
          districtId: district.id,
          entityId,
          position: [centerX + offsetX, height / 2, centerZ + offsetZ],
          width,
          depth,
          height,
          occupancy: Math.round(400 + random() * 8_600 * density),
          energy: Math.round(80 + random() * 820),
          risk: Math.round(12 + random() * 78),
        })
        buildingIndex += 1
      }
    }
  })

  return buildings
}

export function generateTrafficLanes() {
  const random = createRng('traffic-lanes')
  const lanes = Array.from({ length: 28 }, (_, index) => {
    const horizontal = index % 2 === 0
    const offset = -56 + ((index * 7.3) % 112)
    const speed = 2.2 + random() * 4.2
    const phase = random() * 100
    return { horizontal, offset, speed, phase, color: index % 5 === 0 ? '#f3b85a' : index % 3 === 0 ? '#8f7cff' : '#9ceeff' }
  })
  return lanes
}

export function toWorldPoint(point: MapPoint) {
  return mapToWorld(point)
}
