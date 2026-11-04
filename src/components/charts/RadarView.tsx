import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { ChartTooltip } from './SeriesChart'

interface RadarViewProps {
  data: Record<string, string | number>[]
  series: Array<{ key: string; label: string; color: string }>
  angleKey?: string
  height?: number
}

export function RadarView({ data, series, angleKey = 'metric', height = 250 }: RadarViewProps) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="rgba(146,174,203,0.13)" />
          <PolarAngleAxis dataKey={angleKey} tick={{ fill: '#7e91a8', fontSize: 9, fontFamily: 'JetBrains Mono Variable' }} />
          <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
          <Tooltip content={<ChartTooltip />} />
          {series.map((entry) => (
            <Radar
              key={entry.key}
              dataKey={entry.key}
              name={entry.label}
              stroke={entry.color}
              fill={entry.color}
              fillOpacity={0.08}
              strokeWidth={1.3}
              animationDuration={800}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-wrap justify-center gap-4">
        {series.map((entry) => (
          <div key={entry.key} className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5" style={{ background: entry.color }} />
            <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--muted)]">{entry.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
