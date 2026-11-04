import type { ChartDataset } from '../types'
import { generateMultiSeries, generateSeries } from '../lib/seeded'
import { DEMO_EPOCH, DISTRICTS } from './constants'

const end = DEMO_EPOCH

const metroLoad = generateMultiSeries({
  seed: 'metro-load',
  points: 33,
  endTime: end,
  intervalHours: 1,
  series: [
    { key: 'grid', base: 74, amplitude: 12, trend: 4 },
    { key: 'water', base: 58, amplitude: 8, trend: 1.4 },
    { key: 'transit', base: 62, amplitude: 18, trend: -2.2 },
  ],
})

const incidentVelocity = generateMultiSeries({
  seed: 'incident-velocity',
  points: 28,
  endTime: end,
  intervalHours: 6,
  series: [
    { key: 'detected', base: 4.2, amplitude: 2.1, trend: 0.8 },
    { key: 'resolved', base: 3.6, amplitude: 1.4, trend: 0.3 },
  ],
})

const airQuality = generateMultiSeries({
  seed: 'air-quality',
  points: 33,
  endTime: end,
  intervalHours: 1,
  series: [
    { key: 'central', base: 76, amplitude: 14, trend: 9 },
    { key: 'foundry', base: 118, amplitude: 24, trend: 18 },
    { key: 'vantage', base: 54, amplitude: 9, trend: 4 },
  ],
})

const economicIndex = generateMultiSeries({
  seed: 'economic-index',
  points: 30,
  endTime: end,
  intervalHours: 24,
  series: [
    { key: 'composite', base: 1268, amplitude: 18, trend: 18 },
    { key: 'trade', base: 61, amplitude: 4, trend: 3.4 },
    { key: 'volatility', base: 17, amplitude: 2.8, trend: -1.6 },
  ],
})

const energyDemand = generateMultiSeries({
  seed: 'energy-demand',
  points: 33,
  endTime: end,
  intervalHours: 1,
  series: [
    { key: 'demand', base: 2_240, amplitude: 210, trend: 110 },
    { key: 'renewable', base: 920, amplitude: 180, trend: 70 },
    { key: 'reserve', base: 380, amplitude: 46, trend: -42 },
  ],
})

const mobilityFlow = generateMultiSeries({
  seed: 'mobility-flow',
  points: 33,
  endTime: end,
  intervalHours: 1,
  series: [
    { key: 'arterial', base: 78_000, amplitude: 12_000, trend: 3_200 },
    { key: 'rail', base: 620_000, amplitude: 82_000, trend: 12_000 },
    { key: 'freight', base: 24_000, amplitude: 2_100, trend: 1_100 },
  ],
})

const waterQuality = generateMultiSeries({
  seed: 'water-quality',
  points: 30,
  endTime: end,
  intervalHours: 6,
  series: [
    { key: 'wqi', base: 91, amplitude: 2.4, trend: 0.4 },
    { key: 'turbidity', base: 4.1, amplitude: 1.2, trend: 0.3 },
    { key: 'oxygen', base: 7.7, amplitude: 0.5, trend: -0.1 },
  ],
})

const climateTrend = generateMultiSeries({
  seed: 'climate-trend',
  points: 30,
  endTime: end,
  intervalHours: 24,
  series: [
    { key: 'temperature', base: 17.2, amplitude: 1.6, trend: 0.9 },
    { key: 'rainfall', base: 7.4, amplitude: 3.4, trend: 1.1 },
    { key: 'humidity', base: 64, amplitude: 5, trend: 2.2 },
  ],
})

const distribution = generateSeries({
  seed: 'distribution',
  points: 24,
  base: 72,
  amplitude: 9,
  noise: 0.5,
  intervalHours: 1,
  endTime: end,
}).map((point, index) => ({ bucket: `${index * 5}–${index * 5 + 5}`, count: Math.round(18 + Math.abs(Math.sin(index * 0.7)) * 74 + point.value * 0.3) }))

export const DATASETS: Record<string, ChartDataset> = {
  metro_load: {
    id: 'metro_load',
    title: 'Metropolitan load profile',
    source: 'NEXUS telemetry synthesis',
    unit: 'index',
    data: metroLoad,
    series: [
      { key: 'grid', label: 'Grid load', color: '#f3b85a' },
      { key: 'water', label: 'Water demand', color: '#5ce1a4' },
      { key: 'transit', label: 'Transit flow', color: '#56e1ff' },
    ],
  },
  incident_velocity: {
    id: 'incident_velocity',
    title: 'Incident velocity · 7 days',
    source: 'Incident command ledger',
    unit: 'events',
    data: incidentVelocity,
    series: [
      { key: 'detected', label: 'Detected', color: '#ff5d73' },
      { key: 'resolved', label: 'Resolved', color: '#5ce1a4' },
    ],
  },
  air_quality: {
    id: 'air_quality',
    title: 'Air quality index by mesh',
    source: 'Environmental observation network',
    unit: 'AQI',
    data: airQuality,
    series: [
      { key: 'central', label: 'Central mesh', color: '#f3b85a' },
      { key: 'foundry', label: 'Foundry mesh', color: '#ff5d73' },
      { key: 'vantage', label: 'Vantage mesh', color: '#56e1ff' },
    ],
  },
  economic_index: {
    id: 'economic_index',
    title: 'Aurelia composite · 30 days',
    source: 'Aurelia Exchange / simulated',
    unit: 'points',
    data: economicIndex,
    series: [
      { key: 'composite', label: 'Composite', color: '#8f7cff' },
      { key: 'trade', label: 'Trade momentum', color: '#56e1ff' },
      { key: 'volatility', label: 'Volatility', color: '#f3b85a' },
    ],
  },
  energy_demand: {
    id: 'energy_demand',
    title: 'Grid demand and renewable supply',
    source: 'Helios grid telemetry',
    unit: 'MW',
    data: energyDemand,
    series: [
      { key: 'demand', label: 'Demand', color: '#f3b85a' },
      { key: 'renewable', label: 'Renewable', color: '#5ce1a4' },
      { key: 'reserve', label: 'Reserve', color: '#8f7cff' },
    ],
  },
  mobility_flow: {
    id: 'mobility_flow',
    title: 'Mobility throughput',
    source: 'Aurelia Transit control',
    unit: 'trips',
    data: mobilityFlow,
    series: [
      { key: 'arterial', label: 'Arterial', color: '#56e1ff' },
      { key: 'rail', label: 'Rail', color: '#8f7cff' },
      { key: 'freight', label: 'Freight', color: '#f3b85a' },
    ],
  },
  water_quality: {
    id: 'water_quality',
    title: 'Tidal water quality',
    source: 'Tidal Water Sentinel',
    unit: 'mixed',
    data: waterQuality,
    series: [
      { key: 'wqi', label: 'Water quality index', color: '#5ce1a4' },
      { key: 'turbidity', label: 'Turbidity (NTU)', color: '#56e1ff' },
      { key: 'oxygen', label: 'Dissolved oxygen', color: '#8f7cff' },
    ],
  },
  climate_trend: {
    id: 'climate_trend',
    title: 'Climate reference · 30 days',
    source: 'Solace Climate Observatory',
    unit: 'mixed',
    data: climateTrend,
    series: [
      { key: 'temperature', label: 'Temperature °C', color: '#f3b85a' },
      { key: 'rainfall', label: 'Rainfall mm', color: '#56e1ff' },
      { key: 'humidity', label: 'Humidity %', color: '#5ce1a4' },
    ],
  },
  distribution: {
    id: 'distribution',
    title: 'Response-time distribution',
    source: 'Incident command ledger',
    unit: 'incidents',
    data: distribution,
    series: [{ key: 'count', label: 'Incidents', color: '#56e1ff' }],
  },
}

export const GENERATION_MIX = [
  { name: 'Nuclear', value: 38, color: '#8f7cff' },
  { name: 'Solar', value: 21, color: '#f3b85a' },
  { name: 'Hydro', value: 16, color: '#56e1ff' },
  { name: 'Storage', value: 12, color: '#5ce1a4' },
  { name: 'Gas', value: 9, color: '#7b8da4' },
  { name: 'Import', value: 4, color: '#ff5d73' },
]

export const MARKET_SECTORS = [
  { name: 'Energy', value: 34, change: 2.4, color: '#f3b85a' },
  { name: 'Logistics', value: 26, change: 1.1, color: '#56e1ff' },
  { name: 'Finance', value: 22, change: 0.6, color: '#8f7cff' },
  { name: 'Health', value: 18, change: -0.4, color: '#5ce1a4' },
  { name: 'Industrial', value: 16, change: -1.2, color: '#ff5d73' },
  { name: 'Consumer', value: 12, change: 0.3, color: '#9ceeff' },
  { name: 'Research', value: 9, change: 3.1, color: '#c2a8ff' },
]

export const SUPPLY_CHAIN_LINKS = [
  { source: 'Port of Aurelia', target: 'Tidal Logistics', value: 38 },
  { source: 'Port of Aurelia', target: 'Foundry Fabrication', value: 26 },
  { source: 'Port of Aurelia', target: 'Meridian Retail', value: 21 },
  { source: 'Tidal Logistics', target: 'Helix Medical', value: 14 },
  { source: 'Tidal Logistics', target: 'Meridian Retail', value: 18 },
  { source: 'Foundry Fabrication', target: 'Energy Systems', value: 12 },
  { source: 'Foundry Fabrication', target: 'Construction', value: 16 },
  { source: 'Meridian Retail', target: 'Consumer Market', value: 31 },
  { source: 'Helix Medical', target: 'Regional Health', value: 14 },
  { source: 'Energy Systems', target: 'Consumer Market', value: 10 },
  { source: 'Construction', target: 'Consumer Market', value: 13 },
]

export const DISTRICT_METRICS = DISTRICTS.map((district, index) => ({
  name: district.code,
  fullName: district.name,
  population: district.population,
  risk: district.risk,
  resilience: Math.max(48, 92 - district.risk + (index % 3) * 2),
  incidents: [1, 2, 1, 3, 2, 2, 1, 1][index],
  load: [78, 64, 58, 89, 83, 71, 62, 49][index],
  color: district.color,
}))

export const RADAR_METRICS = [
  { metric: 'Grid', Meridian: 88, Foundry: 52, Tidal: 74 },
  { metric: 'Water', Meridian: 84, Foundry: 61, Tidal: 78 },
  { metric: 'Mobility', Meridian: 79, Foundry: 46, Tidal: 68 },
  { metric: 'Air', Meridian: 74, Foundry: 32, Tidal: 62 },
  { metric: 'Comms', Meridian: 92, Foundry: 66, Tidal: 71 },
  { metric: 'Response', Meridian: 86, Foundry: 58, Tidal: 75 },
]

export const INCIDENT_HEATMAP = [
  { district: 'MER', detected: 12, resolved: 10, severity: 1.8 },
  { district: 'HLX', detected: 8, resolved: 7, severity: 1.2 },
  { district: 'KST', detected: 5, resolved: 5, severity: 0.8 },
  { district: 'LMN', detected: 10, resolved: 6, severity: 2.6 },
  { district: 'FND', detected: 14, resolved: 9, severity: 2.9 },
  { district: 'TDL', detected: 9, resolved: 8, severity: 1.7 },
  { district: 'VNT', detected: 6, resolved: 6, severity: 1.1 },
  { district: 'SLC', detected: 3, resolved: 3, severity: 0.6 },
]

export const FORECAST_SERIES = generateMultiSeries({
  seed: 'forecast',
  points: 30,
  endTime: DEMO_EPOCH + 30 * 86_400_000,
  intervalHours: 24,
  series: [
    { key: 'central', base: 1280, amplitude: 16, trend: 48 },
    { key: 'optimistic', base: 1280, amplitude: 14, trend: 76 },
    { key: 'stress', base: 1280, amplitude: 22, trend: 18 },
  ],
})

export function getDataset(id: string) {
  return DATASETS[id] ?? DATASETS.metro_load
}
