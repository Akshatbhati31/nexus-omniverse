import { useMemo, useState } from 'react'
import {
  AirVent,
  ArrowUpRight,
  ChevronRight,
  CloudRain,
  Droplets,
  Leaf,
  MapPin,
  RadioTower,
  Siren,
  ThermometerSun,
  Waves,
  Wind,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ChartFrame } from '../components/charts/ChartFrame'
import { DonutChart } from '../components/charts/DonutChart'
import { RadarView } from '../components/charts/RadarView'
import { RadialGauge } from '../components/charts/RadialGauge'
import { SeriesChart } from '../components/charts/SeriesChart'
import { WorkspaceNav } from '../components/layout/WorkspaceNav'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel, PanelHeader } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Sparkline } from '../components/ui/Sparkline'
import { DATASETS, RADAR_METRICS } from '../data/datasets'
import { DISTRICTS } from '../data/constants'
import { formatRelative } from '../lib/format'
import { generateSeries } from '../lib/seeded'
import { usePlatformStore } from '../store/usePlatformStore'
import { useUIStore } from '../store/useUIStore'

const airComposition = [
  { name: 'PM2.5', value: 38, color: '#ff5d73' },
  { name: 'PM10', value: 24, color: '#f3b85a' },
  { name: 'NO₂', value: 19, color: '#8f7cff' },
  { name: 'O₃', value: 12, color: '#56e1ff' },
  { name: 'SO₂', value: 7, color: '#5ce1a4' },
]

const aqiScale = [
  { range: '0–50', label: 'Good', color: '#5ce1a4' },
  { range: '51–100', label: 'Moderate', color: '#f3b85a' },
  { range: '101–150', label: 'Sensitive', color: '#f39a5a' },
  { range: '151–200', label: 'Unhealthy', color: '#ff5d73' },
  { range: '201+', label: 'Severe', color: '#b43a51' },
]

const envDataset = DATASETS.air_quality
const waterDataset = DATASETS.water_quality

export default function EnvironmentPage() {
  const navigate = useNavigate()
  const incidents = usePlatformStore((state) => state.incidents)
  const openInspector = useUIStore((state) => state.openInspector)
  const [mesh, setMesh] = useState<'central' | 'foundry' | 'vantage'>('foundry')
  const activeEnvIncident = incidents.find((incident) => incident.id === 'inc-2839')
  const entities = usePlatformStore((state) => state.entities)
  const envEntities = useMemo(
    () =>
      entities.filter(
        (entity) =>
          ['environmental', 'facility'].includes(entity.kind) &&
          (entity.tags.includes('air') || entity.tags.includes('water') || entity.tags.includes('climate') || entity.id === 'fac-foundry-plant'),
      ),
    [entities],
  )
  const aqiValues = { central: 168, foundry: 184, vantage: 92 }
  const selectedAqi = aqiValues[mesh]
  const districtRows = useMemo(
    () =>
      DISTRICTS.map((district, index) => ({
        ...district,
        aqi: [118, 101, 84, 96, 184, 132, 92, 64][index],
        water: [92, 89, 94, 88, 76, 84, 91, 96][index],
        trend: [4.2, 1.8, -0.8, 2.4, 12.6, 3.1, -1.4, -2.1][index],
      })).sort((a, b) => b.aqi - a.aqi),
    [],
  )

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        kicker="Intelligence network // Environment"
        title="The atmosphere, measured."
        subtitle="Air quality, water systems and climate telemetry across Aurelia Prime. Environmental conditions are modeled deterministically for this demonstration."
        meta={
          <>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <RadioTower size={10} className="text-[var(--violet)]" /> 24 observation nodes
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <Wind size={10} className="text-[var(--cyan)]" /> Inversion depth 240 m
            </span>
            <span className="badge badge-red">Advisory active · Foundry</span>
          </>
        }
        actions={
          <>
            <button type="button" className="btn" onClick={() => navigate('/geoint')}>
              <MapPin size={12} /> Open AQI layer
            </button>
            <button type="button" className="btn btn-primary" onClick={() => activeEnvIncident && navigate(`/incidents/${activeEnvIncident.id}`)}>
              <Siren size={12} /> Advisory command
            </button>
          </>
        }
      />

      <WorkspaceNav domain="environment" />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Central mesh AQI', value: String(aqiValues.central), detail: '+62 vs baseline', color: 'var(--red)', icon: AirVent },
          { label: 'Water quality index', value: '91', detail: 'within standard', color: 'var(--green)', icon: Droplets },
          { label: 'Reference temperature', value: '17.9°', detail: '+0.9° 30-day trend', color: 'var(--amber)', icon: ThermometerSun },
          { label: 'Rainfall · 24h', value: '8.2 mm', detail: 'drainage at 61%', color: 'var(--cyan)', icon: CloudRain },
        ].map((metric) => {
          const Icon = metric.icon
          return (
            <Panel key={metric.label} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="label-micro">{metric.label}</div>
                  <div className="data-value mt-2 text-[26px]" style={{ color: metric.color }}>{metric.value}</div>
                  <div className="mt-1 text-[9px] text-[var(--muted-2)]">{metric.detail}</div>
                </div>
                <Icon size={15} style={{ color: metric.color }} />
              </div>
            </Panel>
          )
        })}
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <Panel className="xl:col-span-4">
          <PanelHeader
            title="Air quality posture"
            eyebrow="Selected observation mesh"
            icon={<Leaf size={13} />}
            action={<span className="badge badge-red">unhealthy</span>}
          />
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-4 py-2">
            {(['central', 'foundry', 'vantage'] as const).map((item) => (
              <button key={item} type="button" className="tab" data-active={mesh === item} onClick={() => setMesh(item)}>
                {item}
              </button>
            ))}
          </div>
          <div className="flex flex-col items-center px-4 pb-2 pt-4">
            <RadialGauge value={selectedAqi} max={250} size={156} label={`${mesh} mesh AQI`} color={selectedAqi > 150 ? '#ff5d73' : selectedAqi > 100 ? '#f3b85a' : '#5ce1a4'} sublabel={selectedAqi > 150 ? 'Sensitive-group advisory' : 'Within operating range'} />
            <div className="mt-2 grid w-full grid-cols-5 gap-px bg-[var(--line)]">
              {aqiScale.map((item) => (
                <div key={item.label} className="bg-[rgba(8,13,19,0.9)] px-1.5 py-1.5 text-center" style={{ borderTop: `1px solid ${item.color}` }}>
                  <div className="font-mono text-[7px] text-[var(--muted-2)]">{item.range}</div>
                  <div className="mt-0.5 text-[7px] uppercase tracking-[0.05em]" style={{ color: item.color }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-[var(--line)] p-4">
            <div className="label-micro mb-2">Particulate composition</div>
            <DonutChart data={airComposition} height={160} centerValue="71" centerLabel="PM2.5 µg/m³" />
          </div>
        </Panel>

        <ChartFrame
          title="Air quality by mesh"
          source="Environmental observation network · simulated"
          dataset={envDataset}
          className="xl:col-span-8"
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">Foundry remains above advisory threshold for 3h 12m</span>
              <button type="button" className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--cyan)]" onClick={() => openInspector('incident', 'inc-2839')}>
                Inspect signal <ChevronRight size={10} />
              </button>
            </div>
          }
        >
          <SeriesChart dataset={envDataset} type="line" height={280} />
        </ChartFrame>

        <Panel className="xl:col-span-5">
          <PanelHeader title="Foundry advisory" eyebrow="Environmental response" icon={<Siren size={13} />} action={<span className="badge badge-red">active</span>} />
          <div className="p-4">
            <div className="border border-[var(--red)]/20 bg-[var(--red-dim)] p-3">
              <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--red)]">Sensitive-group advisory</div>
              <h3 className="mt-2 font-display text-lg tracking-[-0.025em] text-[var(--text-bright)]">Foundry Belt + eastern Tidal Basin</h3>
              <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted)]">
                Boundary-layer inversion is trapping industrial emissions below 240 m. Reduce prolonged outdoor exertion. Air quality is not expected to
                recover until wind speed exceeds 18 km/h or production throttling is applied.
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="border border-[var(--line)] p-2.5">
                <div className="label-micro">Detected</div>
                <div className="mt-1 text-[10px] text-[var(--text)]">{activeEnvIncident ? formatRelative(activeEnvIncident.detectedAt) : '2h ago'}</div>
              </div>
              <div className="border border-[var(--line)] p-2.5">
                <div className="label-micro">Response team</div>
                <div className="mt-1 text-[10px] text-[var(--text)]">Environmental Response</div>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {[
                ['AQI threshold', '150', '184', 'var(--red)'],
                ['Wind speed', '18 km/h', '7 km/h', 'var(--amber)'],
                ['Inversion depth', '240 m', '240 m', 'var(--violet)'],
              ].map(([label, target, actual, color]) => (
                <div key={label} className="flex items-center justify-between gap-2 border-b border-[var(--line)] pb-2 text-[9.5px]">
                  <span className="text-[var(--muted)]">{label}</span>
                  <span className="font-mono" style={{ color }}>{actual} <span className="text-[var(--muted-2)]">/ {target}</span></span>
                </div>
              ))}
            </div>
            <button type="button" className="btn mt-3 w-full" onClick={() => activeEnvIncident && navigate(`/incidents/${activeEnvIncident.id}`)}>
              Open command dossier <ArrowUpRight size={11} />
            </button>
          </div>
        </Panel>

        <ChartFrame
          title="Water quality and tidal sentinel"
          source="Tidal Water Sentinel · simulated"
          dataset={waterDataset}
          className="xl:col-span-4"
          footer={<span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">Outfall node 4 · within standard</span>}
        >
          <SeriesChart dataset={waterDataset} type="line" height={224} />
        </ChartFrame>

        <Panel className="xl:col-span-3">
          <PanelHeader title="Climate reference" eyebrow="Solace observatory" icon={<ThermometerSun size={13} />} />
          <div className="p-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="data-value text-[34px]">17.9°</div>
                <div className="label-micro mt-1">30-day mean</div>
              </div>
              <Sparkline data={generateSeries({ seed: 'climate-env', points: 24, base: 17.1, amplitude: 1.2, trend: 0.8 }).map((point) => point.value)} width={100} height={34} color="#f3b85a" />
            </div>
            <div className="mt-4 space-y-3">
              {[
                ['Temperature', '+0.9°', 'var(--amber)'],
                ['Rainfall', '+1.1 mm', 'var(--cyan)'],
                ['Humidity', '+2.2%', 'var(--green)'],
              ].map(([label, value, color]) => (
                <div key={label} className="flex items-center justify-between text-[10px]">
                  <span className="text-[var(--muted)]">{label}</span>
                  <span className="font-mono" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-[var(--line)] pt-3">
              <div className="label-micro">Drainage load</div>
              <div className="mt-2 flex items-center justify-between">
                <span className="data-value text-[20px]">61%</span>
                <span className="badge badge-green">nominal</span>
              </div>
              <ProgressBar value={61} color="var(--green)" className="mt-2" />
            </div>
          </div>
        </Panel>

        <Panel className="xl:col-span-5">
          <PanelHeader title="District environmental posture" eyebrow="AQI and water index" icon={<Waves size={13} />} />
          <div className="max-h-[290px] overflow-y-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>District</th>
                  <th>AQI</th>
                  <th>Water</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {districtRows.map((district) => (
                  <tr key={district.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="h-1 w-1" style={{ background: district.color }} />
                        <span className="text-[10px]">{district.name}</span>
                      </div>
                    </td>
                    <td className="font-mono text-[10px]" style={{ color: district.aqi > 150 ? 'var(--red)' : district.aqi > 100 ? 'var(--amber)' : 'var(--green)' }}>{district.aqi}</td>
                    <td className="font-mono text-[10px] text-[var(--muted)]">{district.water}</td>
                    <td className={`font-mono text-[9px] ${district.trend >= 0 ? 'text-[var(--red)]' : 'text-[var(--green)]'}`}>{district.trend >= 0 ? '+' : ''}{district.trend}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="xl:col-span-7">
          <PanelHeader title="Cross-domain resilience" eyebrow="Environment / infrastructure / response" icon={<Leaf size={13} />} />
          <div className="grid gap-4 p-4 md:grid-cols-[1fr_190px]">
            <RadarView data={RADAR_METRICS} series={[
              { key: 'Meridian', label: 'Meridian Core', color: '#56e1ff' },
              { key: 'Foundry', label: 'Foundry Belt', color: '#ff5d73' },
              { key: 'Tidal', label: 'Tidal Basin', color: '#5ce1a4' },
            ]} height={230} />
            <div className="space-y-2">
              <div className="label-micro">Observation nodes</div>
              {envEntities.slice(0, 6).map((entity) => (
                <button key={entity.id} type="button" className="flex w-full items-center justify-between gap-2 border-b border-[var(--line)] pb-2 text-left" onClick={() => openInspector('entity', entity.id)}>
                  <span className="truncate text-[9.5px] text-[var(--muted)]">{entity.name}</span>
                  <ChevronRight size={10} className="flex-none text-[var(--muted-2)]" />
                </button>
              ))}
              <p className="pt-1 text-[8.5px] leading-relaxed text-[var(--muted-2)]">Select an observation node to load its dossier in the context inspector.</p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
