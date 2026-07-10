import jestFetchMock from 'jest-fetch-mock'

// Only mock fetch in jsdom environment (browser-like tests)
// Node environment tests (like jbrowse-cli) should use real fetch
const isNodeEnvironment = typeof window === 'undefined'

if (!isNodeEnvironment) {
  // jest-fetch-mock v4 no longer pollutes the global scope at import time; the
  // fetch/Response/Request/Headers primitives are installed by enableMocks().
  // jsdom 26 ships only a partial, request-guarded `Headers` (no fetch/Response/
  // Request) that strips the `range` request header — unlike real browsers,
  // whose default-guard Headers keep it. enableMocks() refuses to clobber that
  // existing Headers, which would leave jsdom's range-stripping copy mismatched
  // against cross-fetch's Response/Request and break RemoteFileWithRangeCache.
  // Clearing it first makes enableMocks install one consistent cross-fetch set
  // whose Headers preserves `range`, matching browsers and jest-fetch-mock v3.
  delete global.Headers
  delete global.Request
  delete global.Response
  jestFetchMock.enableMocks()

  function handleDataUri(urlStr) {
    if (urlStr.startsWith('data:')) {
      const match = urlStr.match(/^data:([^;,]*)(;base64)?,(.*)$/)
      if (match) {
        const [, mimeType, isBase64, data] = match
        const bytes = isBase64
          ? Uint8Array.from(atob(data), c => c.charCodeAt(0))
          : new TextEncoder().encode(decodeURIComponent(data))
        return new Response(bytes, {
          headers: { 'Content-Type': mimeType || 'text/plain' },
        })
      }
    }
    return null
  }

  global.fetch = async (url, options) => {
    const urlStr = typeof url === 'string' ? url : url.toString()
    const dataUriResponse = handleDataUri(urlStr)
    if (dataUriResponse) {
      return dataUriResponse
    }
    return jestFetchMock(url, options)
  }

  // Copy the mock helpers/state onto the wrapper so `fetch` itself reads as a
  // mock (tests that assert `expect(fetch).toHaveBeenCalledWith(...)`).
  Object.assign(global.fetch, jestFetchMock)

  // But expose `fetchMock` as the raw jest-fetch-mock instance, not the wrapper.
  // The wrapper delegates every non-data-URI request to it, so its `.mock` state
  // is authoritative — and its identity survives `resetMocks()` (which replaces
  // the underlying `.mock` object). The wrapper's Object.assign'd `.mock` copy,
  // by contrast, goes stale after a reset, which is why count assertions on it
  // previously needed a per-test enableMocks() to re-sync. See global.d.ts for
  // the typing.
  global.fetchMock = jestFetchMock
}
