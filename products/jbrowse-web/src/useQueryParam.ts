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
}

export function readQueryParams<T extends string>(keys: T[]) {
  const params = readParams(paramLocation())
  const result = {} as Record<T, string | undefined>
  for (const key of keys) {
    result[key] = params.get(key) ?? undefined
  }
  return result
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
