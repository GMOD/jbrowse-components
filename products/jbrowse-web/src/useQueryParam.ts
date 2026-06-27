// jbrowse-web is a static client-side app — nothing here is processed
// server-side — so URL params can live in the hash fragment instead of the
// query string. The fragment is never sent to the server, so a large param
// (e.g. a declarative `session=encoded-…`/`spec-…`) can't trip the server's
// request-line limit (HTTP 414); the query string can, and historically did.
//
// We read params from the hash when the current URL puts them there (it looks
// like `#key=value…`) and otherwise from the query string (legacy URLs), and we
// write updates back to whichever the current URL uses — so both forms keep
// working and a hash URL stays a hash URL across the post-load `session=local-…`
// rewrite and reloads.

function paramsInHash() {
  return window.location.hash.includes('=')
}

function getSearchParams() {
  return new URLSearchParams(
    paramsInHash()
      ? window.location.hash.slice(1)
      : window.location.search,
  )
}

function updateUrl(params: URLSearchParams) {
  const str = params.toString()
  const { pathname, search } = window.location
  const newUrl = paramsInHash()
    ? `${pathname}${search}${str ? `#${str}` : ''}`
    : str
      ? `${pathname}?${str}`
      : pathname
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
