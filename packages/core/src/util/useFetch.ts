import { useCallback, useEffect, useRef, useState } from 'react'

import { createStatusWindow } from './progress.ts'
import { createStopToken, stopStopToken } from './stopToken.ts'

import type { RpcStatus, StatusCallback } from './progress.ts'
import type { StopToken } from './stopToken.ts'

// Minimal data-fetching hook, replacing SWR. JBrowse only ever used the
// {data, error, isLoading, mutate} subset with background revalidation off
// (every data source is stable for the lifetime of the dialog/widget that
// opens it), so we fetch once per key — which also keeps SWR out of the
// eagerly-loaded bundle. A mutate() refetch keeps the previous data visible
// while it runs, as SWR does; see the setState in the fetch effect.

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
 *
 * A stop token and a status callback follow the key arguments. The token is
 * created per fetch and stopped when the key changes or the component unmounts,
 * so a fetcher that forwards it to an RPC cancels the worker instead of leaving
 * it grinding on an answer nobody is waiting for. The callback is what the RPC's
 * own progress comes back through, and it surfaces on the hook's `status` — a
 * dialog that forwards both gets "Downloading features 42%" and a cancel that
 * works, instead of a bare spinner over an uninterruptible whole-chromosome
 * read. Fetchers that take neither are unaffected.
 */
type FetcherArgs<Key> =
  FetchingKey<Key> extends readonly unknown[]
    ? [...FetchingKey<Key>, StopToken, StatusCallback]
    : [FetchingKey<Key>, StopToken, StatusCallback]

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
  /**
   * Trigger a refetch. Returns nothing: the result arrives through
   * `data`/`error`/`isLoading` like the initial fetch, and a promise here could
   * only resolve before the refetch it schedules had run.
   */
  mutate: () => void
  isValidating: boolean
  /**
   * Latest progress the in-flight fetcher reported through its status callback,
   * or undefined when it reported none or the fetch has settled. Render it with
   * `statusProgressLabel` (and `statusFraction` for a bar); a fetcher that never
   * calls its callback leaves this undefined and the consumer shows whatever it
   * showed before.
   */
  status: RpcStatus | undefined
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

/**
 * Revalidate every mounted `useFetch` on this key. Synchronous for the same
 * reason the per-hook `mutate` is: it schedules the refetches, and each hook
 * reports its own result through the state it already exposes.
 */
export function mutate(key: FetchKey) {
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
  const serialized = serializeKey(key)
  // A null fetcher is the second way to say "don't fetch", so its nullness is a
  // fetch input exactly like the key is — the effect below has to re-run when it
  // flips. Only the boolean can go in the dependency list: the fetcher itself is
  // usually an inline closure, so depending on its identity would refetch every
  // render. Tracked separately from the key because the two are independent —
  // gating on the key alone leaves a `fetcher` that resolves from null to a real
  // function (an adapter/config arriving late) permanently stuck not fetching.
  const hasFetcher = fetcher !== null
  const [state, setState] = useState<FetchState<Data>>(() => ({
    data: undefined,
    error: undefined,
    // seeded from the key rather than starting false: the effect below runs
    // after the first paint, so a false seed showed the resolved-and-empty state
    // for a frame before the spinner (an empty attribute table, an empty list)
    isLoading: serialized !== null && hasFetcher,
  }))
  // bumped to force a refetch (local mutate() or a cross-component mutate(key))
  const [nonce, setNonce] = useState(0)
  // separate from `state` because it moves on its own cadence: the RPC status
  // stream ticks throughout one fetch, while data/error/isLoading move once
  const [status, setStatus] = useState<RpcStatus | undefined>(undefined)
  // refs let the fetch effect depend only on the serialized key + nonce without
  // re-running when the (often inline) fetcher/options/key identities change
  const optionsRef = useRef(options)
  optionsRef.current = options
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const keyRef = useRef(key)
  keyRef.current = key
  // the key the last fetch ran under, to tell a mutate()-driven refetch from a
  // key change — see the setState below
  const fetchedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    const key = keyRef.current
    const fetcher = fetcherRef.current
    if (serialized === null || !fetcher) {
      // when the key becomes null, callers see undefined data again rather
      // than the prior fetch's result
      fetchedKeyRef.current = null
      setState({ data: undefined, error: undefined, isLoading: false })
      // and the same for the progress, which otherwise sticks: a key going nil
      // *during* a fetch runs this branch's cleanup first, so the `alive` guard
      // on the settle below has already closed and nothing else clears it
      setStatus(undefined)
      return undefined
    } else {
      let alive = true
      // `alive` is about this effect run; `settled` is about this fetch. They
      // differ for exactly one thing, the status stream below: an RPC resolves
      // its status channel asynchronously, so a status can arrive after the
      // fetch it describes has resolved — and without a second term it lands on
      // top of the clear and sticks. (The trailing write queued *before* the
      // fetch resolved is a different case, and the stream's own `clear` drops
      // that one.)
      let settled = false
      const stopToken = createStopToken()
      // A refetch under the same key — mutate(), or the cross-component
      // mutate(key) — is the same question asked again, so what is on screen is
      // a stale answer to it rather than an answer to something else: leave it
      // up and let `isLoading` say it is being rechecked. A key *change* still
      // clears, because the old data describes a different question.
      //
      // Blanking on every refetch is what made the desktop start screen flash
      // "No sessions available" after each rename, delete, or cancelled dialog.
      // Consumers that want the old view gone during a revalidate already have
      // it: they gate on `isLoading`, which is unchanged.
      const sameKey = fetchedKeyRef.current === serialized
      fetchedKeyRef.current = serialized
      setState(prev => ({
        data: sameKey ? prev.data : undefined,
        error: undefined,
        isLoading: true,
      }))
      // the previous fetch's last progress describes work that is over
      setStatus(undefined)
      // The runtime counterpart of FetcherArgs: an array key becomes one
      // argument per element, anything else a single argument, then the stop
      // token and the status callback. A conditional type over an unresolved
      // `Key` can't be discharged
      // inside the function body, so the parameter list is erased for this one
      // call — callers still get the precise arity, and the looseness stops
      // here.
      const keyArgs: unknown[] = Array.isArray(key) ? key : [key]
      // guarded and throttled for the same reason every other owner of a
      // progress stream is: an RPC emits ~40 of these a second, and each one
      // re-renders the dialog holding this hook
      // one fetch is one stream, so the window is this effect run's
      const statusWindow = createStatusWindow()
      const { statusCallback, clear: clearStatus } = statusWindow.open({
        isCurrent: () => alive && !settled,
        // the one writer, so the settle below clears through the same guard its
        // statuses pass
        write: status => {
          if (alive) {
            setStatus(status)
          }
        },
      })
      const args = [...keyArgs, stopToken, statusCallback]
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
        .finally(() => {
          // however it settled, the progress it reported describes work that is
          // over
          settled = true
          clearStatus()
        })
      return () => {
        alive = false
        // the token's lifetime is this fetch's. An abort rejection lands in the
        // catch above with alive already false, so it never surfaces as an error
        stopStopToken(stopToken)
        // and the window's lifetime is too: `alive` already makes a queued
        // trailing write a no-op, but the timer behind it would otherwise stand
        // for up to a window past unmount
        statusWindow.reset()
      }
    }
  }, [serialized, hasFetcher, nonce])

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

  const mutate = useCallback(() => {
    setNonce(n => n + 1)
  }, [])

  return { ...state, mutate, isValidating: state.isLoading, status }
}
