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
