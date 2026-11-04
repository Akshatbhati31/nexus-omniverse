import { useEffect, useState } from 'react'
import { DEMO_EPOCH } from '../data/constants'
import { formatDate, formatTime } from '../lib/format'

export function useSimulatedClock() {
  const [mountedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => new Date(DEMO_EPOCH))

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date(DEMO_EPOCH + (Date.now() - mountedAt)))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [mountedAt])

  return {
    now,
    time: formatTime(now),
    date: formatDate(now),
  }
}

export function useElapsedSince(iso: string) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  return Math.max(0, now - new Date(iso).getTime())
}
