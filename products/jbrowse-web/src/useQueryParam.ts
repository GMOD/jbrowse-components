import { useCallback, useSyncExternalStore } from 'react'

function getSearchParams() {
  return new URLSearchParams(window.location.search)
}

function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback)
  return () => {
    window.removeEventListener('popstate', callback)
  }
}

function updateUrl(params: URLSearchParams) {
  const newSearch = params.toString()
  const newUrl = newSearch
    ? `${window.location.pathname}?${newSearch}`
    : window.location.pathname
  window.history.replaceState(null, '', newUrl)
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

export function deleteQueryParams(keys: string[]) {
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
