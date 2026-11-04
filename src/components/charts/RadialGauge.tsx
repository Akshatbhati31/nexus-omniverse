interface RadialGaugeProps {
  value: number
  max?: number
  size?: number
  label?: string
  color?: string
  sublabel?: string
}

export function RadialGauge({ value, max = 100, size = 132, label, color = '#56e1ff', sublabel }: RadialGaugeProps) {
  const radius = 50
  const circumference = Math.PI * radius * 1.5
  const progress = Math.max(0, Math.min(1, value / max))
  const dash = circumference * progress

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size} className="-rotate-[135deg]">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(146,174,203,0.09)" strokeWidth="4" strokeDasharray={`${circumference} ${Math.PI * 200}`} strokeLinecap="butt" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={`${dash} ${Math.PI * 200}`}
          strokeLinecap="butt"
          style={{ filter: `drop-shadow(0 0 5px ${color}66)`, transition: 'stroke-dasharray 800ms cubic-bezier(.2,.8,.2,1)' }}
        />
        <circle cx="60" cy="60" r="40" fill="none" stroke="rgba(146,174,203,0.06)" strokeWidth="1" strokeDasharray="1 4" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="data-value text-[26px] leading-none">{value.toFixed(1)}</span>
        {label ? <span className="label-micro mt-1.5">{label}</span> : null}
        {sublabel ? <span className="mt-1 font-mono text-[8px] text-[var(--muted-2)]">{sublabel}</span> : null}
      </div>
    </div>
  )
}
