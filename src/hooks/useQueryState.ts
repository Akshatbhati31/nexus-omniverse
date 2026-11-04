import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * A small URL-backed string state primitive. It keeps workspace filters
 * shareable and restores them on refresh without duplicating URL logic in
 * every page. Unknown values fall back to the declared default.
 */
export function useQueryState<T extends string>(key: string, fallback: T, allowed?: readonly T[]) {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get(key)
  const value = raw && (!allowed || allowed.includes(raw as T)) ? (raw as T) : fallback

  const setValue = useCallback(
    (next: T) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current)
          if (next === fallback) params.delete(key)
          else params.set(key, next)
          return params
        },
        { replace: true },
      )
    },
    [fallback, key, setSearchParams],
  )

  return [value, setValue] as const
}
