import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal data-fetching hook, replacing SWR. JBrowse only ever used the
// {data, error, isLoading, mutate} subset with background revalidation off
// (every data source is stable for the lifetime of the dialog/widget that
// opens it), so we fetch once per key — which also keeps SWR out of the
// eagerly-loaded bundle.

export type FetchKey = string | readonly unknown[] | null | undefined | false

// The part of a key that survives the "don't fetch" check — what gets
// serialized, and what the fetcher is called with.
type FetchingKey<Key> = Exclude<Key, null | undefined | false>

/**
 * The fetcher's parameter list, derived from the key. An array key is spread
 * into the parameters, so a tuple key gives the fetcher one typed parameter per
 * element (`MafSequenceWidget` destructures its key that way, to reuse the
 * narrowing the null-key ternary already did); a string key arrives as the
 * single argument (`useGenomesData`). Most fetchers close over what they need
 * and declare no parameters at all, which stays assignable either way.
 */
type FetcherArgs<Key> =
  FetchingKey<Key> extends readonly unknown[]
    ? FetchingKey<Key>
    : [FetchingKey<Key>]

interface FetchState<Data> {
  data: Data | undefined
  error: unknown
  isLoading: boolean
}

interface UseFetchOptions<Data> {
  onError?: (error: unknown) => void
  onSuccess?: (data: Data) => void
}

interface UseFetchResponse<Data> extends FetchState<Data> {
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

export function useFetch<Data = unknown, Key extends FetchKey = FetchKey>(
  key: Key,
  fetcher: ((...args: FetcherArgs<Key>) => Promise<Data>) | null,
  options: UseFetchOptions<Data> = {},
): UseFetchResponse<Data> {
  const [state, setState] = useState<FetchState<Data>>({
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
      // The runtime counterpart of FetcherArgs: an array key becomes one
      // argument per element, anything else a single argument. A conditional
      // type over an unresolved `Key` can't be discharged inside the function
      // body, so the parameter list is erased for this one call — callers still
      // get the precise arity, and the looseness stops here.
      const args: unknown[] = Array.isArray(key) ? key : [key]
      const call = fetcher as (...args: unknown[]) => Promise<Data>
      Promise.resolve()
        .then(() => call(...args))
        .then(data => {
          if (alive) {
            setState({ data, error: undefined, isLoading: false })
            optionsRef.current.onSuccess?.(data)
          }
        })
        .catch((error: unknown) => {
          if (alive) {
            setState({ data: undefined, error, isLoading: false })
            optionsRef.current.onError?.(error)
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
