import { Component, useEffect, useState, type ReactNode } from 'react'
import { Boxes, TriangleAlert } from 'lucide-react'
import type { CameraMode, CityLayer, Entity, Incident } from '../../types'
import { CityMap2D } from '../map/CityMap2D'
import { CityScene } from './CityScene'

interface CityCanvasProps {
  entities: Entity[]
  incidents: Incident[]
  layers: Set<CityLayer>
  cameraMode: CameraMode
  selectedEntityId?: string
  onSelectEntity?: (entityId: string) => void
  onSelectIncident?: (incidentId: string) => void
  reduceMotion?: boolean
  className?: string
}

interface SceneBoundaryProps {
  children: ReactNode
  fallback: ReactNode
}

class SceneBoundary extends Component<SceneBoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    console.error('Digital twin renderer failed', error)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export function CityCanvas({ className, entities, incidents, layers, cameraMode, selectedEntityId, onSelectEntity, onSelectIncident, reduceMotion }: CityCanvasProps) {
  const [supported, setSupported] = useState<boolean | null>(null)

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
      setSupported(Boolean(context))
    } catch {
      setSupported(false)
    }
  }, [])

  const fallback = (
    <div className={className}>
      <div className="relative h-full w-full">
        <CityMap2D
          layers={layers}
          entities={entities}
          incidents={incidents}
          selectedEntityId={selectedEntityId}
          onSelectEntity={onSelectEntity}
          onSelectIncident={onSelectIncident}
        />
        <div className="pointer-events-none absolute inset-x-4 bottom-4 border border-[var(--amber)]/25 bg-[rgba(8,13,19,0.94)] px-3 py-2.5 backdrop-blur-sm">
          <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--amber)]">
            <TriangleAlert size={11} />
            WebGL unavailable · 2D schematic fallback engaged
          </div>
        </div>
      </div>
    </div>
  )

  if (supported === null) {
    return (
      <div className={className}>
        <div className="flex h-full min-h-[360px] items-center justify-center bg-[#04080d]">
          <div className="flex flex-col items-center gap-3 text-center">
            <Boxes size={22} className="text-[var(--cyan)]" />
            <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-[var(--muted)]">Initializing procedural twin</div>
            <div className="h-px w-32 overflow-hidden bg-[var(--line)]">
              <div className="h-full w-1/2 animate-pulse bg-[var(--cyan)]" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!supported) return fallback

  return (
    <div className={className}>
      <SceneBoundary fallback={fallback}>
        <CityScene
          entities={entities}
          incidents={incidents}
          layers={layers}
          cameraMode={cameraMode}
          selectedEntityId={selectedEntityId}
          onSelectEntity={onSelectEntity}
          onSelectIncident={onSelectIncident}
          reduceMotion={reduceMotion}
        />
      </SceneBoundary>
    </div>
  )
}
