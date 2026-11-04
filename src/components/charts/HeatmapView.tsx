import { useState } from 'react'
import { cn } from '../../lib/utils'

interface HeatmapRow {
  district: string
  detected: number
  resolved: number
  severity: number
}

export function HeatmapView({ data, className }: { data: HeatmapRow[]; className?: string }) {
  const [active, setActive] = useState<HeatmapRow | null>(null)
  const max = Math.max(...data.map((row) => row.detected))

  return (
    <div className={cn('w-full', className)}>
      <div className="grid grid-cols-[44px_1fr_1fr_1fr] gap-1">
        <div />
        <div className="label-micro pb-1 text-center">Detected</div>
        <div className="label-micro pb-1 text-center">Resolved</div>
        <div className="label-micro pb-1 text-center">Severity</div>
        {data.map((row) => (
          <div key={row.district} className="contents">
            <div className="flex items-center font-mono text-[9px] text-[var(--muted)]">{row.district}</div>
            <button
              type="button"
              onMouseEnter={() => setActive(row)}
              onMouseLeave={() => setActive(null)}
              className="flex h-9 items-center justify-center border border-white/[0.03] font-mono text-[10px] text-[var(--text-bright)] transition-all hover:border-[var(--cyan)]/30"
              style={{ background: `rgba(255, 93, 115, ${0.08 + (row.detected / max) * 0.38})` }}
              title={`${row.district} · ${row.detected} detected`}
            >
              {row.detected}
            </button>
            <button
              type="button"
              onMouseEnter={() => setActive(row)}
              onMouseLeave={() => setActive(null)}
              className="flex h-9 items-center justify-center border border-white/[0.03] font-mono text-[10px] text-[var(--text-bright)] transition-all hover:border-[var(--cyan)]/30"
              style={{ background: `rgba(92, 225, 164, ${0.05 + (row.resolved / max) * 0.26})` }}
              title={`${row.district} · ${row.resolved} resolved`}
            >
              {row.resolved}
            </button>
            <button
              type="button"
              onMouseEnter={() => setActive(row)}
              onMouseLeave={() => setActive(null)}
              className="flex h-9 items-center justify-center border border-white/[0.03] font-mono text-[10px] text-[var(--text-bright)] transition-all hover:border-[var(--cyan)]/30"
              style={{ background: `rgba(243, 184, 90, ${0.04 + (row.severity / 3) * 0.28})` }}
              title={`${row.district} · severity ${row.severity}`}
            >
              {row.severity.toFixed(1)}
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex h-4 items-center justify-between border-t border-[var(--line)] pt-2">
        <span className="label-micro">{active ? `${active.district} · ${active.detected} detected / ${active.resolved} resolved` : 'Incident density by district'}</span>
        <span className="font-mono text-[8px] text-[var(--muted-2)]">low → high</span>
      </div>
    </div>
  )
}
