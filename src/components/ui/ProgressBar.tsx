import { cn } from '../../lib/utils'

interface ProgressBarProps {
  value: number
  color?: string
  height?: number
  className?: string
  label?: string
}

export function ProgressBar({ value, color = 'var(--cyan)', height = 3, className, label }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('w-full', className)}>
      {label ? (
        <div className="mb-1.5 flex items-center justify-between">
          <span className="label-micro">{label}</span>
          <span className="font-mono text-[9px] text-[var(--muted)]">{clamped.toFixed(0)}%</span>
        </div>
      ) : null}
      <div className="w-full overflow-hidden bg-white/[0.045]" style={{ height }}>
        <div
          className="h-full transition-[width] duration-700 ease-out"
          style={{ width: `${clamped}%`, background: color, boxShadow: `0 0 10px ${color}55` }}
        />
      </div>
    </div>
  )
}
