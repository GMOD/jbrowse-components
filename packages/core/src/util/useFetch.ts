import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal data-fetching hook, replacing SWR. JBrowse only ever used the
// {data, error, isLoading, mutate} subset with background revalidation off
// (every data source is stable for the lifetime of the dialog/widget that
// opens it), so we fetch once per key — which also keeps SWR out of the
// eagerly-loaded bundle.

export type FetchKey = string | readonly unknown[] | null | undefined | false

interface FetchState<Data, Err> {
  data: Data | undefined
  error: Err | undefined
  isLoading: boolean
}

interface UseFetchOptions<Data, Err> {
  onError?: (error: Err) => void
  onSuccess?: (data: Data) => void
}

interface UseFetchResponse<Data, Err> extends FetchState<Data, Err> {
  mutate: () => Promise<void>
  isValidating: boolean
}

const isNil = (k: unknown) => k === null || k === undefined || k === false

// A null result means "don't fetch": no key, or an array key with a missing
// piece (e.g. an offset that isn't resolved yet).
function serializeKey(key: FetchKey): string | null {
  return isNil(key) || (Array.isArray(key) && key.some(isNil))
    ? null
    : JSON.stringify(key)
}

// Cross-component refetch coordination, keyed by serialized key. Holds only
// refetch callbacks (never data), so there is no global cache to go stale —
// this is the one SWR feature we relied on: mutate(key) revalidates every
// mounted useFetch sharing that key.
const listeners = new Map<string, Set<() => void>>()

export async function mutate(key: FetchKey) {
  const serialized = serializeKey(key)
  if (serialized) {
    for (const refetch of listeners.get(serialized) ?? []) {
      refetch()
    }
  }
}

export function useFetch<Data = unknown, Err = unknown>(
  key: FetchKey,
  fetcher: ((...args: any[]) => Promise<Data>) | null,
  options: UseFetchOptions<Data, Err> = {},
): UseFetchResponse<Data, Err> {
  const [state, setState] = useState<FetchState<Data, Err>>({
    data: undefined,
    error: undefined,
    isLoading: false,
  })
  // bumped to force a refetch (local mutate() or a cross-component mutate(key))
  const [nonce, setNonce] = useState(0)
  // refs let the fetch effect depend only on the serialized key + nonce without
  // re-running when the (often inline) fetcher/options/key identities change
  const optionsRef = useRef(options)
  optionsRef.current = options
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const keyRef = useRef(key)
  keyRef.current = key
  const serialized = serializeKey(key)

  useEffect(() => {
    const key = keyRef.current
    const fetcher = fetcherRef.current
    if (serialized === null || !fetcher) {
      // when the key becomes null, callers see undefined data again rather
      // than the prior fetch's result
      setState({ data: undefined, error: undefined, isLoading: false })
      return undefined
    } else {
      let alive = true
      setState({ data: undefined, error: undefined, isLoading: true })
      Promise.resolve()
        .then(() => fetcher(...(Array.isArray(key) ? key : [key])))
        .then(data => {
          if (alive) {
            setState({ data, error: undefined, isLoading: false })
            optionsRef.current.onSuccess?.(data)
          }
        })
        .catch((error: unknown) => {
          if (alive) {
            const err = error as Err
            setState({ data: undefined, error: err, isLoading: false })
            optionsRef.current.onError?.(err)
          }
        })
      return () => {
        alive = false
      }
    }
  }, [serialized, nonce])

  // register this instance so a cross-component mutate(key) can refetch it
  useEffect(() => {
    if (serialized === null) {
      return undefined
    } else {
      const refetch = () => {
        setNonce(n => n + 1)
      }
      const set = listeners.get(serialized) ?? new Set()
      set.add(refetch)
      listeners.set(serialized, set)
      return () => {
        set.delete(refetch)
        if (set.size === 0) {
          listeners.delete(serialized)
        }
      }
    }
  }, [serialized])

  const mutate = useCallback(async () => {
    setNonce(n => n + 1)
  }, [])

  return { ...state, mutate, isValidating: state.isLoading }
}
