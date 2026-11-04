import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { ChartTooltip } from './SeriesChart'

export interface DonutDatum {
  name: string
  value: number
  color: string
}

export function DonutChart({ data, height = 190, centerLabel, centerValue }: { data: DonutDatum[]; height?: number; centerLabel?: string; centerValue?: string }) {
  return (
    <div className="relative w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="84%"
            paddingAngle={2}
            stroke="rgba(5,8,12,0.8)"
            strokeWidth={2}
            animationDuration={800}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {centerValue ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-xl tracking-[-0.04em] text-[var(--text-bright)]">{centerValue}</div>
          <div className="label-micro mt-1">{centerLabel}</div>
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1.5">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <span className="h-1 w-1" style={{ background: entry.color }} />
            <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--muted)]">
              {entry.name} {entry.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
