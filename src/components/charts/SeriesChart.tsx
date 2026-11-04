import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ChartDataset } from '../../types'
import { formatCompact } from '../../lib/format'
import { cn } from '../../lib/utils'

interface TooltipEntry {
  color?: string
  name?: string
  value?: number | string
  dataKey?: string | number
}

export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: readonly TooltipEntry[]
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="label">{label}</div>
      {payload.map((entry, index) => (
        <div className="row" key={`${entry.dataKey ?? entry.name ?? index}`}>
          <span>
            <i className="mr-1.5 inline-block h-1 w-1 align-middle" style={{ background: entry.color ?? 'var(--cyan)' }} />
            {entry.name}
          </span>
          <span>{typeof entry.value === 'number' ? formatCompact(entry.value) : entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function ChartLegend({ dataset, className }: { dataset: ChartDataset; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {dataset.series.map((series) => (
        <div key={series.key} className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5" style={{ background: series.color, boxShadow: `0 0 6px ${series.color}55` }} />
          <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--muted)]">{series.label}</span>
        </div>
      ))}
    </div>
  )
}

interface SeriesChartProps {
  dataset: ChartDataset
  type?: 'line' | 'area' | 'bar'
  height?: number
  showLegend?: boolean
  className?: string
  stacked?: boolean
}

export function SeriesChart({ dataset, type = 'line', height = 230, showLegend = true, className, stacked }: SeriesChartProps) {
  const first = dataset.data[0] ?? {}
  const xKey = 'time' in first ? 'time' : 'bucket' in first ? 'bucket' : 'label'
  const common = (
    <>
      <CartesianGrid vertical={false} strokeDasharray="2 6" />
      <XAxis dataKey={xKey} axisLine={false} tickLine={false} minTickGap={26} dy={6} />
      <YAxis axisLine={false} tickLine={false} width={38} tickFormatter={(value: number) => formatCompact(value)} />
      <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(86,225,255,0.18)' }} />
    </>
  )

  return (
    <div className={className}>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          {type === 'area' ? (
            <AreaChart data={dataset.data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                {dataset.series.map((series) => (
                  <linearGradient key={series.key} id={`gradient-${dataset.id}-${series.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={series.color} stopOpacity={0.22} />
                    <stop offset="95%" stopColor={series.color} stopOpacity={0.01} />
                  </linearGradient>
                ))}
              </defs>
              {common}
              {dataset.series.map((series) => (
                <Area
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  name={series.label}
                  stroke={series.color}
                  strokeWidth={1.4}
                  fill={`url(#gradient-${dataset.id}-${series.key})`}
                  stackId={stacked ? '1' : undefined}
                  animationDuration={850}
                  dot={false}
                  activeDot={{ r: 3, fill: series.color, stroke: '#081018', strokeWidth: 2 }}
                />
              ))}
            </AreaChart>
          ) : type === 'bar' ? (
            <BarChart data={dataset.data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={2}>
              {common}
              {dataset.series.map((series) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  name={series.label}
                  fill={series.color}
                  opacity={0.72}
                  stackId={stacked ? '1' : undefined}
                  animationDuration={700}
                  radius={[1, 1, 0, 0]}
                />
              ))}
            </BarChart>
          ) : (
            <LineChart data={dataset.data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              {common}
              {dataset.series.map((series) => (
                <Line
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  name={series.label}
                  stroke={series.color}
                  strokeWidth={1.4}
                  dot={false}
                  activeDot={{ r: 3, fill: series.color, stroke: '#081018', strokeWidth: 2 }}
                  animationDuration={850}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      {showLegend ? <ChartLegend dataset={dataset} className="mt-3 px-1" /> : null}
    </div>
  )
}
