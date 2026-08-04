import { useCallback, useSyncExternalStore } from 'react'

function getSearchParams() {
  return new URLSearchParams(window.location.search)
}

// history.replaceState fires no event, so a write below has to notify readers
// itself. popstate alone covers only back/forward, which nothing here does: the
// Loader's ?config= is cleared by the very setter defined here, and with no
// notification it would keep reading the stale value and stay on the loading
// screen (the "fall back to the start screen" error path never arrived).
const listeners = new Set<() => void>()

function subscribe(callback: () => void) {
  listeners.add(callback)
  window.addEventListener('popstate', callback)
  return () => {
    listeners.delete(callback)
    window.removeEventListener('popstate', callback)
  }
}

function updateUrl(params: URLSearchParams) {
  const newSearch = params.toString()
  const newUrl = newSearch
    ? `${window.location.pathname}?${newSearch}`
    : window.location.pathname
  window.history.replaceState(null, '', newUrl)
  // copied: a listener may unsubscribe (React drops the subscription when the
  // re-render this triggers unmounts the reader) while we are iterating
  for (const listener of [...listeners]) {
    listener()
  }
}

export function readQueryParams<T extends string>(keys: T[]) {
  const params = getSearchParams()
  const result = {} as Record<T, string | undefined>
  for (const key of keys) {
    result[key] = params.get(key) ?? undefined
  }
  return result
}

export function useQueryParam(key: string) {
  const value = useSyncExternalStore(
    subscribe,
    () => getSearchParams().get(key),
    () => null,
  )

  const setValue = useCallback(
    (newValue: string | undefined) => {
      const params = getSearchParams()
      if (newValue === undefined) {
        params.delete(key)
      } else {
        params.set(key, newValue)
      }
      updateUrl(params)
    },
    [key],
  )

  return [value ?? undefined, setValue] as const
}

export function deleteQueryParams(keys: readonly string[]) {
  const params = getSearchParams()
  for (const key of keys) {
    params.delete(key)
  }
  updateUrl(params)
}

export function setQueryParams(values: Record<string, string | undefined>) {
  const params = getSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      params.delete(key)
    } else {
      params.set(key, value)
    }
  }
  updateUrl(params)
}
