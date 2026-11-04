import { Html, Line, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { CameraMode, CityLayer, Entity, Incident, MapPoint } from '../../types'
import { BRIDGES, CITY_LAYERS, COLORS, DISTRICTS } from '../../data/constants'
import { generateBuildings, generateTrafficLanes, mapToWorld3 } from './cityGenerator'

interface SceneProps {
  entities: Entity[]
  incidents: Incident[]
  layers: Set<CityLayer>
  cameraMode: CameraMode
  selectedEntityId?: string
  onSelectEntity?: (entityId: string) => void
  onSelectIncident?: (incidentId: string) => void
  reduceMotion?: boolean
}

const districtColors: Record<string, string> = Object.fromEntries(DISTRICTS.map((district) => [district.id, district.color]))

const energyLinks = [
  ['fac-lumen-grid', 'fac-solace-solar'],
  ['fac-lumen-grid', 'fac-nexus-dc'],
  ['fac-lumen-grid', 'fac-foundry-plant'],
  ['fac-solace-solar', 'fac-arc'],
]

const waterLinks = [
  ['fac-foundry-plant', 'fac-tidal-water'],
  ['fac-north-pump', 'fac-kestrel-hospital'],
  ['fac-north-pump', 'fac-tidal-water'],
]

const transitLinks = [
  ['fac-helix-tower', 'dist-meridian', 'dist-tidal'],
  ['fac-helix-tower', 'dist-lumen', 'dist-vantage'],
  ['dist-solace', 'dist-kestrel', 'dist-meridian'],
]

function pointsFromIds(ids: string[], byId: Record<string, Entity>) {
  return ids
    .map((id) => byId[id]?.map)
    .filter((point): point is MapPoint => Boolean(point))
    .map((point) => mapToWorld3(point, 0.18))
}

function Buildings({ buildings, reduceMotion }: { buildings: ReturnType<typeof generateBuildings>; reduceMotion: boolean }) {
  const solid = useRef<THREE.InstancedMesh>(null)
  const outline = useRef<THREE.InstancedMesh>(null)
  const crowns = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])

  useLayoutEffect(() => {
    const count = buildings.length
    if (!solid.current || !outline.current || !crowns.current) return
    buildings.forEach((building, index) => {
      dummy.position.set(...building.position)
      dummy.scale.set(building.width, building.height, building.depth)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      solid.current!.setMatrixAt(index, dummy.matrix)
      outline.current!.setMatrixAt(index, dummy.matrix)

      const base = new THREE.Color(districtColors[building.districtId] ?? COLORS.cyan)
      const luma = 0.34 + Math.min(0.32, building.height / 46)
      color.copy(base).multiplyScalar(luma)
      solid.current!.setColorAt(index, color)

      dummy.position.set(building.position[0], building.height + 0.08, building.position[2])
      dummy.scale.set(building.width * 0.9, 0.12, building.depth * 0.9)
      dummy.updateMatrix()
      crowns.current!.setMatrixAt(index, dummy.matrix)
      color.copy(base).multiplyScalar(1.5)
      crowns.current!.setColorAt(index, color)
    })
    solid.current.instanceMatrix.needsUpdate = true
    outline.current.instanceMatrix.needsUpdate = true
    crowns.current.instanceMatrix.needsUpdate = true
    if (solid.current.instanceColor) solid.current.instanceColor.needsUpdate = true
    if (crowns.current.instanceColor) crowns.current.instanceColor.needsUpdate = true
    solid.current.count = count
    outline.current.count = count
    crowns.current.count = count
  }, [buildings, color, dummy])

  useFrame((state) => {
    if (reduceMotion || !crowns.current) return
    const material = crowns.current.material as THREE.MeshStandardMaterial
    material.emissiveIntensity = 0.72 + Math.sin(state.clock.elapsedTime * 1.2) * 0.08
  })

  return (
    <group>
      <instancedMesh ref={solid} args={[undefined, undefined, buildings.length]} castShadow={false} receiveShadow={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.58} metalness={0.38} vertexColors />
      </instancedMesh>
      <instancedMesh ref={outline} args={[undefined, undefined, buildings.length]}>
        <boxGeometry args={[1.002, 1.002, 1.002]} />
        <meshBasicMaterial color="#7ce9ff" wireframe transparent opacity={0.055} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, buildings.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#081018" emissive="#56e1ff" emissiveIntensity={0.72} roughness={0.3} metalness={0.1} vertexColors />
      </instancedMesh>
    </group>
  )
}

function Traffic({ reduceMotion }: { reduceMotion: boolean }) {
  const lanes = useMemo(() => generateTrafficLanes(), [])
  const mesh = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const cars = useMemo(
    () =>
      lanes.flatMap((lane, laneIndex) =>
        Array.from({ length: 3 }, (_, carIndex) => ({
          ...lane,
          carIndex,
          offset: lane.phase + carIndex * 27 + laneIndex * 1.7,
          color: laneIndex % 5 === 0 ? COLORS.amber : laneIndex % 3 === 0 ? COLORS.violet : COLORS.cyanSoft,
        })),
      ),
    [lanes],
  )
  const color = useMemo(() => new THREE.Color(), [])

  useLayoutEffect(() => {
    if (!mesh.current) return
    cars.forEach((car, index) => {
      color.set(car.color)
      mesh.current!.setColorAt(index, color)
    })
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  }, [cars, color])

  useFrame((state) => {
    if (!mesh.current || reduceMotion) return
    const time = state.clock.elapsedTime
    cars.forEach((car, index) => {
      const travel = ((time * car.speed + car.offset) % 122) - 61
      if (car.horizontal) {
        dummy.position.set(travel, 0.16, car.offset * 0.92)
        dummy.rotation.set(0, 0, 0)
      } else {
        dummy.position.set(car.offset * 0.92, 0.16, travel)
        dummy.rotation.set(0, Math.PI / 2, 0)
      }
      dummy.scale.set(0.32, 0.08, 0.15)
      dummy.updateMatrix()
      mesh.current!.setMatrixAt(index, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, cars.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#ffffff" vertexColors toneMapped={false} />
    </instancedMesh>
  )
}

function IncidentMarker({
  incident,
  onSelect,
}: {
  incident: Incident
  onSelect?: (id: string) => void
}) {
  const position = useMemo(() => mapToWorld3(incident.map, 0.4), [incident.map])
  const ring = useRef<THREE.Mesh>(null)
  const color = incident.severity === 'critical' ? COLORS.red : incident.severity === 'high' ? COLORS.amber : COLORS.cyan

  useFrame((state) => {
    if (!ring.current) return
    const scale = 1 + ((state.clock.elapsedTime * 0.45) % 1) * 1.6
    ring.current.scale.setScalar(scale)
    const material = ring.current.material as THREE.MeshBasicMaterial
    material.opacity = 0.55 * (1 - ((state.clock.elapsedTime * 0.45) % 1))
  })

  return (
    <group position={position}>
      <mesh
        ref={ring}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(event) => {
          event.stopPropagation()
          onSelect?.(incident.id)
        }}
      >
        <ringGeometry args={[0.55, 0.7, 36]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh
        position={[0, 0.45, 0]}
        onClick={(event) => {
          event.stopPropagation()
          onSelect?.(incident.id)
        }}
      >
        <octahedronGeometry args={[0.36, 0]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <Html position={[0, 1.35, 0]} center distanceFactor={22} style={{ pointerEvents: 'none' }}>
        <div className="whitespace-nowrap border border-white/10 bg-[rgba(5,10,16,0.9)] px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.08em]" style={{ color }}>
          {incident.reference}
        </div>
      </Html>
    </group>
  )
}

function FacilityMarkers({
  entities,
  layers,
  selectedEntityId,
  onSelectEntity,
}: {
  entities: Entity[]
  layers: Set<CityLayer>
  selectedEntityId?: string
  onSelectEntity?: (id: string) => void
}) {
  const visible = entities.filter(
    (entity) =>
      entity.map &&
      (['facility', 'landmark'].includes(entity.kind) || (layers.has('economy') && entity.kind === 'economic')) &&
      (entity.id === selectedEntityId ||
        layers.has('infrastructure') ||
        (layers.has('energy') && ['fac-lumen-grid', 'fac-solace-solar'].includes(entity.id)) ||
        (layers.has('water') && ['fac-tidal-water', 'fac-north-pump', 'fac-foundry-plant'].includes(entity.id)) ||
        (layers.has('environment') && entity.kind === 'environmental')),
  )

  return (
    <group>
      {visible.map((entity) => {
        const selected = entity.id === selectedEntityId
        const color =
          entity.id === 'fac-lumen-grid' || entity.id === 'fac-solace-solar'
            ? COLORS.amber
            : entity.id === 'fac-tidal-water' || entity.id === 'fac-north-pump'
              ? COLORS.green
              : entity.kind === 'environmental'
                ? COLORS.violet
                : COLORS.cyan
        return (
          <group key={entity.id} position={mapToWorld3(entity.map!, 0.45)}>
            <mesh
              onClick={(event) => {
                event.stopPropagation()
                onSelectEntity?.(entity.id)
              }}
            >
              <octahedronGeometry args={[selected ? 0.62 : 0.38, 0]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[selected ? 1.1 : 0.6, selected ? 1.25 : 0.72, 32]} />
              <meshBasicMaterial color={color} transparent opacity={selected ? 0.8 : 0.3} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
            {selected ? (
              <>
                <mesh position={[0, 8, 0]}>
                  <cylinderGeometry args={[0.035, 0.12, 16, 8, 1, true]} />
                  <meshBasicMaterial color={color} transparent opacity={0.28} toneMapped={false} depthWrite={false} />
                </mesh>
                <Html position={[0, 3.6, 0]} center distanceFactor={16} style={{ pointerEvents: 'none' }}>
                  <div className="whitespace-nowrap border bg-[rgba(5,10,16,0.92)] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.08em]" style={{ borderColor: `${color}55`, color }}>
                    {entity.name}
                  </div>
                </Html>
              </>
            ) : null}
          </group>
        )
      })}
    </group>
  )
}

function NetworkLinks({ entities, layers }: { entities: Entity[]; layers: Set<CityLayer> }) {
  const byId = useMemo(() => Object.fromEntries(entities.map((entity) => [entity.id, entity])), [entities])
  const transportLines = useMemo(
    () =>
      transitLinks
        .map((ids) => pointsFromIds(ids, byId))
        .filter((points) => points.length > 1),
    [byId],
  )

  return (
    <group>
      {layers.has('transport')
        ? transportLines.map((points, index) => (
            <Line
              key={`transit-${index}`}
              points={points}
              color={COLORS.cyan}
              lineWidth={1}
              transparent
              opacity={0.45}
              dashed
              dashScale={0.4}
            />
          ))
        : null}
      {layers.has('energy')
        ? energyLinks.map(([from, to]) => {
            const points = pointsFromIds([from, to], byId)
            if (points.length < 2) return null
            return <Line key={`${from}-${to}`} points={points} color={COLORS.amber} lineWidth={0.8} transparent opacity={0.32} />
          })
        : null}
      {layers.has('water')
        ? waterLinks.map(([from, to]) => {
            const points = pointsFromIds([from, to], byId)
            if (points.length < 2) return null
            return <Line key={`${from}-${to}`} points={points} color={COLORS.green} lineWidth={0.8} transparent opacity={0.3} dashed dashScale={0.5} />
          })
        : null}
    </group>
  )
}

function EnvironmentField() {
  const position = useMemo(() => mapToWorld3({ x: 748, y: 464 }, 0.15), [])
  return (
    <group position={position}>
      {[2.4, 4.4, 6.6, 9].map((radius, index) => (
        <mesh key={radius} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius, radius + 0.08, 64]} />
          <meshBasicMaterial color={COLORS.violet} transparent opacity={0.28 - index * 0.05} side={THREE.DoubleSide} toneMapped={false} depthWrite={false} />
        </mesh>
      ))}
      <mesh position={[0, 1.8, 0]}>
        <sphereGeometry args={[2.8, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color={COLORS.violet} transparent opacity={0.035} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function CameraRig({ mode, controlsRef }: { mode: CameraMode; controlsRef: RefObject<OrbitControlsImpl | null> }) {
  const { camera } = useThree()
  const progress = useRef(0)
  const targetPosition = useMemo(() => {
    if (mode === 'top') return new THREE.Vector3(0.01, 92, 0.01)
    if (mode === 'street') return new THREE.Vector3(34, 9, 38)
    return new THREE.Vector3(52, 46, 58)
  }, [mode])
  const targetCenter = useMemo(() => {
    if (mode === 'street') return new THREE.Vector3(4, 4.5, 4)
    return new THREE.Vector3(0, 0, 2)
  }, [mode])

  useEffect(() => {
    progress.current = 1.2
    if (controlsRef.current) {
      controlsRef.current.autoRotate = mode === 'cinematic'
      controlsRef.current.autoRotateSpeed = 0.32
    }
  }, [mode, controlsRef])

  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (!controls || progress.current <= 0) return
    progress.current -= delta
    camera.position.lerp(targetPosition, 1 - Math.exp(-delta * 3.2))
    controls.target.lerp(targetCenter, 1 - Math.exp(-delta * 3.2))
    controls.update()
  })

  return null
}

function SceneContent({
  entities,
  incidents,
  layers,
  cameraMode,
  selectedEntityId,
  onSelectEntity,
  onSelectIncident,
  reduceMotion,
}: SceneProps) {
  const controls = useRef<OrbitControlsImpl>(null)
  const buildings = useMemo(() => generateBuildings(entities), [entities])
  const activeIncidents = useMemo(() => incidents.filter((incident) => !['resolved', 'archived'].includes(incident.status)), [incidents])
  const selectedEntity = entities.find((entity) => entity.id === selectedEntityId)
  const district = selectedEntity?.districtId ? DISTRICTS.find((item) => item.id === selectedEntity.districtId) : undefined

  return (
    <>
      <color attach="background" args={['#04080d']} />
      <fog attach="fog" args={['#04080d', 62, 150]} />
      <ambientLight intensity={0.48} color="#8bbbd1" />
      <hemisphereLight args={['#6ed9ff', '#071018', 0.72]} />
      <directionalLight position={[28, 48, 18]} intensity={1.4} color="#bfeaff" />
      <directionalLight position={[-32, 24, -24]} intensity={0.5} color="#8f7cff" />
      <pointLight position={[0, 22, 0]} intensity={20} distance={72} color="#56e1ff" />

      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow>
          <planeGeometry args={[150, 150]} />
          <meshStandardMaterial color="#050c12" roughness={0.92} metalness={0.08} />
        </mesh>

        <gridHelper args={[140, 56, '#123242', '#0a1b26']} position={[0, -0.03, 0]} />

        {DISTRICTS.map((item) => {
          const [x, , z] = mapToWorld3(item.center)
          const dim = selectedEntityId && selectedEntity?.districtId !== item.id
          return (
            <mesh key={item.id} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.005, z]}>
              <planeGeometry args={[13, 13]} />
              <meshBasicMaterial color={item.color} transparent opacity={dim ? 0.018 : layers.has('population') ? 0.055 : 0.03} depthWrite={false} />
            </mesh>
          )
        })}

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 23]}>
          <planeGeometry args={[132, 12]} />
          <meshStandardMaterial color="#06232c" emissive="#0b3b4a" emissiveIntensity={0.7} roughness={0.28} metalness={0.55} transparent opacity={0.82} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 23]}>
          <planeGeometry args={[132, 0.12]} />
          <meshBasicMaterial color={COLORS.cyan} transparent opacity={0.3} toneMapped={false} />
        </mesh>
        {BRIDGES.map((bridge) => {
          const [x, , z] = mapToWorld3(bridge)
          return (
            <mesh key={bridge.id} position={[x, 0.2, z]} rotation={[0, 0, 0]}>
              <boxGeometry args={[3.6, 0.22, 7.4]} />
              <meshStandardMaterial color="#3c4c62" emissive="#8f7cff" emissiveIntensity={0.16} metalness={0.6} roughness={0.4} />
            </mesh>
          )
        })}
      </group>

      <Buildings buildings={buildings} reduceMotion={Boolean(reduceMotion)} />
      <Traffic reduceMotion={Boolean(reduceMotion)} />
      <NetworkLinks entities={entities} layers={layers} />
      {layers.has('environment') ? <EnvironmentField /> : null}
      <FacilityMarkers entities={entities} layers={layers} selectedEntityId={selectedEntityId} onSelectEntity={onSelectEntity} />
      {layers.has('incidents')
        ? activeIncidents.map((incident) => <IncidentMarker key={incident.id} incident={incident} onSelect={onSelectIncident} />)
        : null}

      {district ? (
        <Html position={mapToWorld3(district.center, 0.8)} center distanceFactor={30} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap border border-[var(--line)] bg-[rgba(5,10,16,0.82)] px-2 py-1 font-mono text-[7px] uppercase tracking-[0.16em]" style={{ color: district.color }}>
            {district.name}
          </div>
        </Html>
      ) : null}

      <OrbitControls
        ref={controls}
        enableDamping
        dampingFactor={0.06}
        minDistance={12}
        maxDistance={145}
        maxPolarAngle={Math.PI / 2.02}
        target={[0, 0, 2]}
        makeDefault
      />
      <CameraRig mode={cameraMode} controlsRef={controls} />
    </>
  )
}

export function CityScene(props: SceneProps) {
  return (
    <Canvas
      className="three-container h-full w-full"
      camera={{ position: [52, 46, 58], fov: 42, near: 0.1, far: 320 }}
      dpr={[1, 1.7]}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor('#04080d')
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
      }}
    >
      <SceneContent {...props} />
    </Canvas>
  )
}

export const CITY_LAYER_LEGEND = CITY_LAYERS
