import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '../store/useUIStore'

export function useGlobalShortcuts() {
  const navigate = useNavigate()
  const openCommand = useUIStore((state) => state.openCommand)
  const closeCommand = useUIStore((state) => state.closeCommand)
  const closeNotifications = useUIStore((state) => state.closeNotifications)
  const sequence = useRef<{ key: string; at: number } | null>(null)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT' || target?.isContentEditable
      const modifier = event.metaKey || event.ctrlKey

      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        openCommand()
        return
      }

      if (event.key === 'Escape') {
        closeCommand()
        closeNotifications()
        return
      }

      if (isInput || modifier || event.altKey) return

      if (event.key === '?') {
        event.preventDefault()
        openCommand()
        return
      }

      if (event.key.toLowerCase() === 'g') {
        sequence.current = { key: 'g', at: Date.now() }
        return
      }

      if (sequence.current && Date.now() - sequence.current.at < 900) {
        const key = event.key.toLowerCase()
        const routes: Record<string, string> = {
          o: '/overview',
          g: '/geoint',
          i: '/incidents',
          s: '/simulation',
          a: '/analytics',
          r: '/reports',
          n: '/network',
          t: '/archive',
        }
        if (routes[key]) {
          event.preventDefault()
          navigate(routes[key])
        }
        sequence.current = null
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, openCommand, closeCommand, closeNotifications])
}
