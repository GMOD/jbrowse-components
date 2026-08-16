import { useCallback, useSyncExternalStore } from 'react'

// URL params for the two products that own their page — jbrowse-web and
// jbrowse-desktop. NOT for an embedded product: react-app and the single-view
// products are mounted into somebody else's page, and rewriting that page's URL
// is not theirs to do.
//
// Both products are static client-side apps — nothing here is processed
// server-side — so params can live in the hash fragment instead of the query
// string. The fragment is never sent to a server, so a large param (e.g. a
// declarative `session=encoded-…`/`spec-…`) can't trip the request-line limit
// (HTTP 414); the query string can, and historically did.
//
// We read params from the hash when the current URL puts them there (it looks
// like `#key=value…`) and otherwise from the query string (legacy URLs), and we
// write updates back to whichever the current URL uses — so both forms keep
// working and a hash URL stays a hash URL across the post-load `session=local-…`
// rewrite and reloads. Desktop never produces a hash, so it always takes the
// query-string branch; the decision costs it nothing and keeps one module.
//
// INVARIANT: params live in the hash XOR the query string, never split across
// both — once the hash holds params we read ONLY the hash. Producers of jbrowse
// URLs (buildShareUrl) must keep all params together in one component.

type ParamLocation = 'hash' | 'search'

// The single decision of where this URL keeps its params. Computed once per
// operation and threaded through read+write so the two can't disagree.
function paramLocation(): ParamLocation {
  return window.location.hash.includes('=') ? 'hash' : 'search'
}

function readParams(loc: ParamLocation) {
  return new URLSearchParams(
    loc === 'hash' ? window.location.hash.slice(1) : window.location.search,
  )
}

// history.replaceState fires no event, so a write has to notify readers itself.
// popstate alone covers only back/forward, which nothing here does: desktop's
// Loader clears its `?config=` with the very setter defined here, and with no
// notification it kept reading the stale value and stayed on the loading screen
// (the "fall back to the start screen" error path never arrived).
const listeners = new Set<() => void>()

function subscribe(callback: () => void) {
  listeners.add(callback)
  window.addEventListener('popstate', callback)
  return () => {
    listeners.delete(callback)
    window.removeEventListener('popstate', callback)
  }
}

// Writes params back into `loc`, leaving the other URL component untouched — the
// URL hash/search setters each replace only their own component.
function writeParams(loc: ParamLocation, params: URLSearchParams) {
  const url = new URL(window.location.href)
  const str = params.toString()
  if (loc === 'hash') {
    url.hash = str
  } else {
    url.search = str
  }
  window.history.replaceState(null, '', url.href)
  // Copied, which this note has claimed while the loop read the live set. A
  // listener is React's store-change callback, and React may flush the re-render
  // synchronously inside it, so the set can be mutated mid-notify: an unmounted
  // reader unsubscribes (safe either way) and a remounted one re-adds itself at
  // the end, where iterating the live set would visit it again for a change it
  // has already read. The snapshot makes who gets notified for one change fixed
  // before the first call.
  for (const listener of [...listeners]) {
    listener()
  }
}

export function readQueryParams<T extends string>(keys: T[]) {
  const params = readParams(paramLocation())
  const result = {} as Record<T, string | undefined>
  for (const key of keys) {
    result[key] = params.get(key) ?? undefined
  }
  return result
}

// Reads the full current param set from wherever this URL keeps them (hash XOR
// search). Producers that need every param at once (buildShareUrl) share this
// so the hash/search decision stays in this one module.
export function readAllQueryParams() {
  return readParams(paramLocation())
}

export function deleteQueryParams(keys: readonly string[]) {
  const loc = paramLocation()
  const params = readParams(loc)
  for (const key of keys) {
    params.delete(key)
  }
  writeParams(loc, params)
}

export function setQueryParams(values: Record<string, string | undefined>) {
  const loc = paramLocation()
  const params = readParams(loc)
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      params.delete(key)
    } else {
      params.set(key, value)
    }
  }
  writeParams(loc, params)
}

/**
 * Read one param and keep re-rendering as it changes, including across the
 * `replaceState` writes above, which fire no event of their own.
 */
export function useQueryParam(key: string) {
  const value = useSyncExternalStore(
    subscribe,
    () => readParams(paramLocation()).get(key),
    () => null,
  )

  const setValue = useCallback(
    (newValue: string | undefined) => {
      setQueryParams({ [key]: newValue })
    },
    [key],
  )

  return [value ?? undefined, setValue] as const
}
