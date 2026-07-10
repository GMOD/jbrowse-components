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
  // enableMocks() installs global.fetch === global.fetchMock === the mock. We
  // keep fetchMock as that mock (the single control/assertion surface: tests use
  // fetchMock.mockResponse / expect(fetchMock)) and wrap only global.fetch below.
  jestFetchMock.enableMocks()
  const mockFetch = jestFetchMock

  // Decode data: URIs ourselves — the underlying real fetch rejects non-HTTP(S)
  // protocols, and an ambient mockResponse would otherwise swallow them. This is
  // the one thing global.fetch does that the mock can't; everything else is
  // delegated straight through, so global.fetch stays a thin transport rather
  // than a second mock object.
  function handleDataUri(urlStr) {
    const match = urlStr.startsWith('data:')
      ? urlStr.match(/^data:([^;,]*)(;base64)?,(.*)$/)
      : null
    if (match) {
      const [, mimeType, isBase64, data] = match
      const bytes = isBase64
        ? Uint8Array.from(atob(data), c => c.charCodeAt(0))
        : new TextEncoder().encode(decodeURIComponent(data))
      return new Response(bytes, {
        headers: { 'Content-Type': mimeType || 'text/plain' },
      })
    }
    return null
  }

  // async so a decoded data: URI is still returned as a Promise (callers may
  // use .then, not await)
  global.fetch = async (url, options) => {
    const urlStr = typeof url === 'string' ? url : url.toString()
    return handleDataUri(urlStr) ?? mockFetch(url, options)
  }
}
