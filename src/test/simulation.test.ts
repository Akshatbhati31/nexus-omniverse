import { describe, expect, it } from 'vitest'
import { SIMULATION_MODELS, defaultParameters, runSimulation } from '../lib/simulation'
import type { SimulationKind } from '../types'

const KINDS = Object.keys(SIMULATION_MODELS) as SimulationKind[]

describe('simulation engine', () => {
  it('registers all five models with complete metadata', () => {
    expect(KINDS).toHaveLength(5)
    for (const kind of KINDS) {
      const model = SIMULATION_MODELS[kind]
      expect(model.kind).toBe(kind)
      expect(model.label.length).toBeGreaterThan(0)
      expect(model.code).toMatch(/^[A-Z]{3}-\d{2}$/)
      expect(model.nodeOptions.length).toBeGreaterThan(1)
      expect(model.nodeOptions).toContain(model.defaults.affectedNode)
    }
  })

  it('is deterministic for identical parameters', () => {
    for (const kind of KINDS) {
      const parameters = defaultParameters(kind)
      const first = runSimulation(kind, parameters)
      const second = runSimulation(kind, parameters)
      expect(second).toEqual(first)
    }
  })

  it('changes output when parameters change', () => {
    const baseline = runSimulation('rainfall', defaultParameters('rainfall'))
    const altered = runSimulation('rainfall', {
      ...defaultParameters('rainfall'),
      intensity: 91,
      rainfall: 96,
      redundancy: true,
    })
    expect(altered.series).not.toEqual(baseline.series)
    expect(altered.summary).not.toBe(baseline.summary)
  })

  it('produces bounded, finite series and complete impact summaries', () => {
    for (const kind of KINDS) {
      const result = runSimulation(kind, defaultParameters(kind))
      expect(result.kind).toBe(kind)
      expect(result.series).toHaveLength(17)
      expect(result.impacts).toHaveLength(4)
      expect(result.summary.length).toBeGreaterThan(20)
      expect(result.modelNotes.length).toBeGreaterThan(2)
      expect(result.confidence).toBeGreaterThanOrEqual(63)
      expect(result.confidence).toBeLessThanOrEqual(94)

      for (const point of result.series) {
        for (const value of [point.primary, point.secondary, point.tertiary]) {
          expect(Number.isFinite(value)).toBe(true)
          expect(value).toBeGreaterThanOrEqual(0)
        }
      }

      expect(result.affectedNodes[0]).toBe(defaultParameters(kind).affectedNode)
      expect(new Set(result.affectedNodes).size).toBe(result.affectedNodes.length)
    }
  })

  it('returns defensive copies of default parameters', () => {
    const first = defaultParameters('route_closure')
    first.intensity = 1
    const second = defaultParameters('route_closure')
    expect(second.intensity).toBe(SIMULATION_MODELS.route_closure.defaults.intensity)
  })
})
