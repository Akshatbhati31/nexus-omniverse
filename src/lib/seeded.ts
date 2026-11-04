export function hashString(input: string) {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function createRng(seed: string | number) {
  let state = typeof seed === 'number' ? seed >>> 0 : hashString(seed)
  return function random() {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export interface SeriesOptions {
  seed: string
  points: number
  base: number
  amplitude: number
  trend?: number
  noise?: number
  intervalHours?: number
  endTime?: number
  min?: number
  max?: number
}

export interface SeriesPoint {
  t: number
  label: string
  value: number
}

export function generateSeries({
  seed,
  points,
  base,
  amplitude,
  trend = 0,
  noise = 0.2,
  intervalHours = 1,
  endTime = Date.UTC(2026, 10, 4, 14, 32),
  min = -Infinity,
  max = Infinity,
}: SeriesOptions): SeriesPoint[] {
  const random = createRng(seed)
  return Array.from({ length: points }, (_, index) => {
    const progress = points === 1 ? 0 : index / (points - 1)
    const wave = Math.sin(progress * Math.PI * 4 + random() * 0.35) * amplitude
    const secondaryWave = Math.cos(progress * Math.PI * 2.4) * amplitude * 0.32
    const jitter = (random() - 0.5) * amplitude * noise * 2
    const t = endTime - (points - 1 - index) * intervalHours * 3_600_000
    const value = Math.min(max, Math.max(min, base + wave + secondaryWave + jitter + trend * progress))
    return {
      t,
      label: new Date(t).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      }),
      value: Number(value.toFixed(2)),
    }
  })
}

export function generateMultiSeries(options: {
  seed: string
  points: number
  series: Array<{ key: string; base: number; amplitude: number; trend?: number }>
  intervalHours?: number
  endTime?: number
}) {
  const { seed, points, series, intervalHours = 1, endTime = Date.UTC(2026, 10, 4, 14, 32) } = options
  const generated = series.map((entry, index) =>
    generateSeries({
      seed: `${seed}-${entry.key}-${index}`,
      points,
      base: entry.base,
      amplitude: entry.amplitude,
      trend: entry.trend,
      intervalHours,
      endTime,
    }),
  )
  return generated[0].map((point, pointIndex) => {
    const row: Record<string, string | number> = {
      time: new Date(point.t).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      }),
      timestamp: point.t,
    }
    series.forEach((entry, seriesIndex) => {
      row[entry.key] = generated[seriesIndex][pointIndex].value
    })
    return row
  })
}

export function pick<T>(random: () => number, items: T[]): T {
  return items[Math.floor(random() * items.length)]
}

export function jitteredValue(random: () => number, base: number, spread: number) {
  return Number((base + (random() - 0.5) * spread).toFixed(2))
}
