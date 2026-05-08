// Jest mock for SWR. Replaces useSWR with a plain useEffect-based fetch so
// tests don't have to deal with SWR's process-global cache, deduplication
// window, or revalidation semantics. Each render with a non-null key calls
// the fetcher; a fresh useState pair stores data/error.
//
// The real package is wired in via jest.config.js moduleNameMapper.

import { useEffect, useRef, useState } from 'react'

interface FetchState<T> {
  data: T | undefined
  error: unknown
  isLoading: boolean
}

function serializeKey(key: unknown): string | null {
  if (key === null || key === undefined || key === false) {
    return null
  }
  if (Array.isArray(key)) {
    if (key.some(k => k === null || k === undefined || k === false)) {
      return null
    }
    return JSON.stringify(key)
  }
  return JSON.stringify(key)
}

interface UseSWROptions<T> {
  onError?: (error: unknown) => void
  onSuccess?: (data: T) => void
}

export default function useSWR<T = unknown>(
  key: unknown,
  fetcher: ((...args: any[]) => Promise<T>) | null,
  options: UseSWROptions<T> = {},
) {
  const [state, setState] = useState<FetchState<T>>({
    data: undefined,
    error: undefined,
    isLoading: false,
  })
  const optionsRef = useRef(options)
  optionsRef.current = options
  const serialized = serializeKey(key)

  useEffect(() => {
    if (serialized === null || !fetcher) {
      // Match real SWR's behavior: when key becomes null, callers see
      // undefined data again rather than the prior fetch's result.
      setState({ data: undefined, error: undefined, isLoading: false })
      return
    }
    let alive = true
    setState({ data: undefined, isLoading: true, error: undefined })
    Promise.resolve()
      .then(() => fetcher(...(Array.isArray(key) ? key : [key])))
      .then(data => {
        if (!alive) {
          return
        }
        setState({ data, error: undefined, isLoading: false })
        optionsRef.current.onSuccess?.(data)
      })
      .catch(error => {
        if (!alive) {
          return
        }
        setState({ data: undefined, error, isLoading: false })
        optionsRef.current.onError?.(error)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized])

  const mutate = async () => state.data
  return { ...state, mutate, isValidating: state.isLoading }
}

export const SWRConfig = ({ children }: { children: React.ReactNode }) =>
  children

export const mutate = async () => undefined
