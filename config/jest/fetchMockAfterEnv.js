// The fetch mock, ours. Replaces jest-fetch-mock — and the cross-fetch it
// pulled in — with the subset this repo actually uses, over the primitives
// `jsdomWithFetch.cjs` installs from node.
//
// Why not the library: it exists to supply fetch/Response/Request/Headers that
// jsdom lacks, and node has shipped real ones since 18. Its `Headers` preserves
// the `range` request header, which is the one property the old setup went to
// cross-fetch for. What was left was six sugar methods over `jest.fn()`, each a
// couple of lines, against a dependency whose global was undeclared to tsc and
// whose v3→v4 change of when it installs globals cost a debug cycle.
//
// The API is deliberately identical, so no test changed. `global.fetchMock` is
// a `jest.fn()` with the six added; everything else tests call on it
// (`mockResolvedValue`, `mock.calls`, `mockImplementation`) is plain jest and
// always was.
//
// Node environment tests (jbrowse-cli, jbrowse-img) use real fetch.
const isNodeEnvironment = typeof window === 'undefined'

if (!isNodeEnvironment) {
  // captured before the mock takes its place, so dontMock() has something real
  const realFetch = global.fetch

  // The function form is handed a real Request, not the raw args, because that
  // is what consumers read: generateReadBuffer answers a byte range off
  // `request.headers.get('range')`, and the whole point of taking node's
  // primitives is that its Headers keeps that header where jsdom's strips it.
  // Node's Request rejects a relative url outright, where the browser Request
  // cross-fetch used to supply kept one verbatim — and consumers depend on
  // verbatim: generateReadBuffer passes `request.url` straight to
  // `require.resolve('../../test_data/volvox/' + url)`, so resolving
  // `volvox.2bit` to `http://localhost/volvox.2bit` turns every track into a
  // 404. So construct against a base to get a real Request — one whose
  // `.text()`, `.headers` and `range` all work — then put the original url back.
  // WITHOUT `signal`, and the mock is why that is fine: it resolves from a
  // canned body and never has a request in flight to cancel, so a signal here
  // could only ever be inspected, never obeyed.
  //
  // It has to go because the two realms brand-check each other's AbortSignal.
  // `jsdomWithFetch.cjs` installs node's fetch primitives and deliberately
  // leaves AbortController as jsdom's (jsdom's EventTarget refuses a node signal
  // in `addEventListener(t, fn, {signal})`, which every drag gesture uses). So
  // `new Request(url, {signal})` below gets a jsdom signal and node's Request
  // rejects it: `Expected signal ("AbortSignal {}") to be an instance of
  // AbortSignal`. Every range read composes one — @gmod/range-cache-filehandle
  // puts a response deadline on each — so this is every fetch, not an edge case.
  function withoutSignal(init) {
    if (!init?.signal) {
      return init
    }
    const { signal, ...rest } = init
    return rest
  }

  function toRequest(input, init) {
    if (input instanceof Request) {
      return input
    }
    const raw = typeof input === 'string' ? input : String(input)
    const reqInit = withoutSignal(init)
    try {
      return new Request(raw, reqInit)
    } catch {
      const request = new Request(
        new URL(raw, 'http://localhost/').href,
        reqInit,
      )
      Object.defineProperty(request, 'url', { value: raw, configurable: true })
      return request
    }
  }

  function toResponse(result, init) {
    if (result instanceof Response) {
      return result
    }
    if (typeof result === 'string') {
      return new Response(result, init)
    }
    if (result === null || result === undefined) {
      return new Response(undefined, init)
    }
    // a plain object: its own fields win over the call's init, so
    // `async () => ({ status: 404 })` means 404 whatever the default said
    const { body, ...rest } = result
    return new Response(body, { ...init, ...rest })
  }

  async function respondWith(bodyOrFunction, init, request) {
    return toResponse(
      typeof bodyOrFunction === 'function'
        ? await bodyOrFunction(request)
        : bodyOrFunction,
      init,
    )
  }

  // `mocking` is the dontMock()/doMock() gate. Read at call time rather than
  // captured, so a dontMock() after an implementation was queued still wins.
  let mocking = true

  // async so that a bad url surfaces as a rejected promise: fetch() never
  // throws synchronously, and toRequest is evaluated before respondWith is
  // entered
  const implement = (bodyOrFunction, init) => async (input, reqInit) =>
    mocking
      ? respondWith(bodyOrFunction, init, toRequest(input, reqInit))
      : realFetch(input, withoutSignal(reqInit))

  const defaultImplementation = implement('', undefined)

  const fetchMock = jest.fn(defaultImplementation)

  fetchMock.mockResponse = (bodyOrFunction, init) =>
    fetchMock.mockImplementation(implement(bodyOrFunction, init))

  fetchMock.mockResponseOnce = (bodyOrFunction, init) =>
    fetchMock.mockImplementationOnce(implement(bodyOrFunction, init))

  // each entry is a body, or a [body, init] pair; they are consumed in order
  fetchMock.mockResponses = (...responses) => {
    for (const response of responses) {
      const [body, init] = Array.isArray(response)
        ? response
        : [response, undefined]
      fetchMock.mockImplementationOnce(implement(body, init))
    }
    return fetchMock
  }

  fetchMock.mockRejectOnce = error =>
    fetchMock.mockImplementationOnce(() =>
      Promise.reject(typeof error === 'function' ? error() : error),
    )

  fetchMock.dontMock = () => {
    mocking = false
    return fetchMock
  }

  fetchMock.doMock = () => {
    mocking = true
    return fetchMock
  }

  fetchMock.resetMocks = () => {
    fetchMock.mockReset()
    mocking = true
    fetchMock.mockImplementation(defaultImplementation)
    return fetchMock
  }

  global.fetchMock = fetchMock

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
    return handleDataUri(urlStr) ?? fetchMock(url, options)
  }
}
