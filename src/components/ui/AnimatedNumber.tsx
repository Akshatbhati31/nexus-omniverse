import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { formatCompact, formatDecimal, formatInteger } from '../../lib/format'

interface AnimatedNumberProps {
  value: number
  format?: 'compact' | 'integer' | 'decimal'
  prefix?: string
  suffix?: string
  duration?: number
  className?: string
}

export function AnimatedNumber({
  value,
  format = 'compact',
  prefix = '',
  suffix = '',
  duration = 700,
  className,
}: AnimatedNumberProps) {
  const reduceMotion = useReducedMotion()
  const [display, setDisplay] = useState(reduceMotion ? value : 0)
  const previous = useRef(0)

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value)
      previous.current = value
      return
    }
    const from = previous.current
    const startedAt = performance.now()
    const frameRef = { current: 0 }
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(from + (value - from) * eased)
      if (progress < 1) frameRef.current = requestAnimationFrame(tick)
      else previous.current = value
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value, duration, reduceMotion])

  const formatted =
    format === 'integer' ? formatInteger(display) : format === 'decimal' ? formatDecimal(display) : formatCompact(display)

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}
