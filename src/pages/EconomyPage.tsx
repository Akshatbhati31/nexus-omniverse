import { useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  ChartNoAxesCombined,
  ChevronRight,
  Coins,
  Container,
  Download,
  Landmark,
  Ship,
  TrendingUp,
  Waypoints,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ChartFrame } from '../components/charts/ChartFrame'
import { SankeyView } from '../components/charts/SankeyView'
import { SeriesChart } from '../components/charts/SeriesChart'
import { TreemapView } from '../components/charts/TreemapView'
import { WorkspaceNav } from '../components/layout/WorkspaceNav'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel, PanelHeader } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { DATASETS, MARKET_SECTORS, SUPPLY_CHAIN_LINKS } from '../data/datasets'
import { formatRelative } from '../lib/format'
import { cn, csvFromRows, downloadFile } from '../lib/utils'
import { usePlatformStore } from '../store/usePlatformStore'

const economy = DATASETS.economic_index

export default function EconomyPage() {
  const navigate = useNavigate()
  const entities = usePlatformStore((state) => state.entities)
  const [range, setRange] = useState<'30d' | '7d'>('30d')
  const [sector, setSector] = useState<string | null>('Energy')
  const organizations = entities.filter((entity) => ['organization', 'economic'].includes(entity.kind))
  const chartDataset = useMemo(() => {
    if (range === '30d') return economy
    return { ...economy, data: economy.data.slice(-7) }
  }, [range])
  const selectedSector = MARKET_SECTORS.find((item) => item.name === sector) ?? MARKET_SECTORS[0]
  const composite = 1_284.6
  const volatility = 17.4

  const exportSnapshot = () => {
    downloadFile(
      'aurelia-market-snapshot.csv',
      csvFromRows(MARKET_SECTORS.map((item) => ({ sector: item.name, weight: item.value, change: item.change }))),
    )
  }

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        kicker="Intelligence network // Economy"
        title="The exchange beneath the city."
        subtitle="Market momentum, trade flows and supply-chain exposure across the Aurelia metropolitan economy. All market records are simulated fixtures."
        meta={
          <>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <ChartNoAxesCombined size={10} className="text-[var(--violet)]" /> Composite 1,284.6
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <Container size={10} className="text-[var(--cyan)]" /> Port throughput 96.4%
            </span>
            <span className="badge badge-amber">Simulated exchange</span>
          </>
        }
        actions={
          <>
            <button type="button" className="btn" onClick={exportSnapshot}>
              <Download size={12} /> Export snapshot
            </button>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/simulation')}>
              <Waypoints size={12} /> Supply-chain scenario
            </button>
          </>
        }
      />

      <WorkspaceNav domain="economy" />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Aurelia composite', value: composite.toLocaleString(undefined, { minimumFractionDigits: 1 }), detail: '+1.8% · 30d', color: 'var(--violet)', icon: ChartNoAxesCombined, positive: true },
          { label: 'Trade momentum', value: '61.2', detail: '+3.4 index', color: 'var(--cyan)', icon: Ship, positive: true },
          { label: 'Volatility', value: `${volatility.toFixed(1)}%`, detail: '-1.6% · easing', color: 'var(--amber)', icon: TrendingUp, positive: false },
          { label: 'Port throughput', value: '96.4%', detail: 'freight operations nominal', color: 'var(--green)', icon: Container, positive: true },
        ].map((metric) => {
          const Icon = metric.icon
          return (
            <Panel key={metric.label} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="label-micro">{metric.label}</div>
                  <div className="data-value mt-2 text-[25px]" style={{ color: metric.color }}>{metric.value}</div>
                  <div className="mt-1 flex items-center gap-1 text-[9px] text-[var(--muted-2)]">
                    {metric.positive ? <ArrowUpRight size={9} className="text-[var(--green)]" /> : <ArrowDownRight size={9} className="text-[var(--amber)]" />}
                    {metric.detail}
                  </div>
                </div>
                <Icon size={15} style={{ color: metric.color }} />
              </div>
            </Panel>
          )
        })}
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <ChartFrame
          title="Aurelia composite index"
          source="Aurelia Exchange · simulated"
          dataset={chartDataset}
          className="xl:col-span-8"
          actions={
            <div className="flex border border-[var(--line)] p-0.5">
              {(['7d', '30d'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={cn('btn btn-sm h-5 border-transparent bg-transparent px-2 text-[8px]', range === item && 'bg-[var(--cyan-dim)] text-[var(--cyan)]')}
                  onClick={() => setRange(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          }
          footer={
            <div className="flex items-center justify-between">
              <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">Composite · trade momentum · volatility</span>
              <span className="font-mono text-[8px] text-[var(--green)]">above 30-day mean</span>
            </div>
          }
        >
          <SeriesChart dataset={chartDataset} type="line" height={280} />
        </ChartFrame>

        <Panel className="xl:col-span-4">
          <PanelHeader title="Sector weight" eyebrow="Simulated exchange" icon={<Coins size={13} />} />
          <div className="p-3">
            <TreemapView items={MARKET_SECTORS} />
          </div>
        </Panel>

        <Panel className="xl:col-span-7">
          <PanelHeader title="Supply-chain flow" eyebrow="Port to consumer" icon={<Waypoints size={13} />} action={<span className="badge badge-violet">11 edges</span>} />
          <div className="p-3">
            <SankeyView links={SUPPLY_CHAIN_LINKS} height={330} accent="#c2a8ff" />
          </div>
          <div className="border-t border-[var(--line)] px-4 py-2.5">
            <p className="text-[9px] leading-relaxed text-[var(--muted-2)]">
              Flow volume is a simulated index. Port, freight and Foundry nodes form the most concentrated downstream exposure path.
            </p>
          </div>
        </Panel>

        <div className="space-y-3 xl:col-span-5">
          <Panel>
            <PanelHeader title="Sector monitor" eyebrow="Weight and change" icon={<Landmark size={13} />} />
            <div className="max-h-[236px] overflow-y-auto">
              {MARKET_SECTORS.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  className="flex w-full items-center gap-3 border-b border-[var(--line)] px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-white/[0.025]"
                  onClick={() => setSector(item.name)}
                >
                  <span className="h-1.5 w-1.5" style={{ background: item.color }} />
                  <span className="min-w-0 flex-1 text-[10px] text-[var(--text)]">{item.name}</span>
                  <span className="w-10 text-right font-mono text-[9px] text-[var(--muted)]">{item.value}</span>
                  <span className={`w-12 text-right font-mono text-[9px] ${item.change >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                    {item.change >= 0 ? '+' : ''}{item.change}%
                  </span>
                  <ChevronRight size={10} className="text-[var(--muted-2)]" />
                </button>
              ))}
            </div>
            <div className="border-t border-[var(--line)] p-3">
              <div className="flex items-center justify-between">
                <span className="label-micro">{selectedSector.name} sector</span>
                <span className="badge" style={{ color: selectedSector.color, borderColor: `${selectedSector.color}44` }}>index {selectedSector.value}</span>
              </div>
              <ProgressBar value={selectedSector.value * 2.6} color={selectedSector.color} className="mt-2" />
              <div className="mt-2 flex items-center justify-between text-[9px] text-[var(--muted-2)]">
                <span>Relative weight</span>
                <span>{selectedSector.value}% of composite</span>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Market organizations" eyebrow="Tracked entities" icon={<Building2 size={13} />} />
            <div className="p-3">
              {organizations.map((organization) => (
                <button
                  key={organization.id}
                  type="button"
                  className="flex w-full items-start gap-2.5 border-b border-[var(--line)] py-2.5 text-left last:border-0"
                  onClick={() => navigate(`/entity/${organization.id}`)}
                >
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center border border-[var(--line)] text-[var(--violet)]"><Building2 size={11} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] text-[var(--text)]">{organization.name}</span>
                    <span className="mt-0.5 block font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{organization.code} · {organization.status}</span>
                  </span>
                  <span className="font-mono text-[8px] text-[var(--muted-2)]">{formatRelative(organization.updatedAt)}</span>
                </button>
              ))}
            </div>
          </Panel>
        </div>

        <Panel className="xl:col-span-12">
          <div className="grid gap-0 md:grid-cols-3">
            {[
              { title: 'Energy sector drag', value: '34.0', detail: 'Weight remains highest in the composite. Eastern grid constraints create local industrial drag.', color: 'var(--amber)', icon: Coins, path: '/energy' },
              { title: 'Port dependency', value: '38', detail: 'Port of Aurelia feeds the largest share of downstream logistics flow.', color: 'var(--cyan)', icon: Ship, path: '/entity/fac-port' },
              { title: 'Foundry exposure', value: '16', detail: 'Manufacturing throughput is sensitive to environmental throttling and corridor delay.', color: 'var(--red)', icon: Container, path: '/environment' },
            ].map((item, index) => {
              const Icon = item.icon
              return (
                <button
                  key={item.title}
                  type="button"
                  className={`group flex items-start gap-3 p-4 text-left transition-colors hover:bg-white/[0.025] ${index !== 2 ? 'border-b border-[var(--line)] md:border-b-0 md:border-r' : ''}`}
                  onClick={() => navigate(item.path)}
                >
                  <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center border border-[var(--line)]"><Icon size={14} style={{ color: item.color }} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="label-micro">{item.title}</span>
                    <span className="mt-1 block data-value text-[22px]">{item.value}</span>
                    <span className="mt-1 block text-[9.5px] leading-relaxed text-[var(--muted)]">{item.detail}</span>
                  </span>
                  <ArrowUpRight size={12} className="text-[var(--muted-2)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </button>
              )
            })}
          </div>
        </Panel>
      </div>
    </div>
  )
}
