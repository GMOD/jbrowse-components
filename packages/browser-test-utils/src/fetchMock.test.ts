// The fetch mock is ours now (config/jest/fetchMockAfterEnv.js), so it needs its
// own test rather than riding on whatever the suites happen to exercise. Two of
// these cover things nothing else does: `dontMock` is only used by the live blat
// tests, which are `describe.skip`, and the verbatim-relative-url rule is what
// every volvox integration test depends on without ever asserting it.

afterEach(() => {
  fetchMock.resetMocks()
})

test('mockResponse serves a body and init to every call', async () => {
  fetchMock.mockResponse('hello', { status: 201 })

  const a = await fetch('http://example.com/one')
  const b = await fetch('http://example.com/two')

  expect(a.status).toBe(201)
  expect(await a.text()).toBe('hello')
  expect(await b.text()).toBe('hello')
})

test('the function form receives a real Request', async () => {
  fetchMock.mockResponse(async request => {
    expect(request.headers.get('range')).toBe('bytes=0-10')
    return `body for ${request.url}`
  })

  const res = await fetch('http://example.com/x', {
    headers: { range: 'bytes=0-10' },
  })
  expect(await res.text()).toBe('body for http://example.com/x')
})

// node's Request throws on a relative url and the browser one cross-fetch
// supplied kept it verbatim. generateReadBuffer passes request.url straight into
// require.resolve, so resolving it against a base 404s every volvox track.
test('a relative url reaches the responder verbatim, still with a usable body', async () => {
  const seen: string[] = []
  fetchMock.mockResponse(async request => {
    seen.push(request.url)
    return JSON.stringify({ sent: await request.text() })
  })

  const res = await fetch('/api/verdict', { method: 'POST', body: 'payload' })

  expect(seen).toEqual(['/api/verdict'])
  expect(await res.json()).toEqual({ sent: 'payload' })
})

test('a returned object supplies its own status', async () => {
  fetchMock.mockResponse(async () => ({ status: 404 }))
  expect((await fetch('http://example.com/missing')).status).toBe(404)
})

test('a returned Response passes through untouched', async () => {
  fetchMock.mockResponse(async () => new Response('raw', { status: 206 }))
  const res = await fetch('http://example.com/x')
  expect(res.status).toBe(206)
  expect(await res.text()).toBe('raw')
})

test('mockResponseOnce applies to one call, then the default', async () => {
  fetchMock.mockResponseOnce('first')
  expect(await (await fetch('http://example.com/x')).text()).toBe('first')
  expect(await (await fetch('http://example.com/x')).text()).toBe('')
})

test('mockResponses serves its entries in order', async () => {
  fetchMock.mockResponses(
    [JSON.stringify({ error: 'budget spent' }), { status: 429 }],
    ['{"ok":1}', { status: 200 }],
  )

  const first = await fetch('http://example.com/proxy')
  const second = await fetch('http://example.com/direct')

  expect(first.status).toBe(429)
  expect(second.status).toBe(200)
  expect(await second.text()).toBe('{"ok":1}')
})

test('mockRejectOnce rejects one call', async () => {
  fetchMock.mockRejectOnce(new Error('boom'))
  await expect(fetch('http://example.com/x')).rejects.toThrow('boom')
  await expect(fetch('http://example.com/x')).resolves.toBeInstanceOf(Response)
})

test('calls are recorded with the arguments as given', async () => {
  fetchMock.mockResponse('')
  await fetch('http://example.com/x', { method: 'POST' })

  const [call] = fetchMock.mock.calls
  expect(call?.[0]).toBe('http://example.com/x')
  expect(call?.[1]).toEqual({ method: 'POST' })
})

test('resetMocks clears calls, queue and implementation', async () => {
  fetchMock.mockResponse('sticky')
  await fetch('http://example.com/x')
  expect(fetchMock.mock.calls).toHaveLength(1)

  fetchMock.resetMocks()

  expect(fetchMock.mock.calls).toHaveLength(0)
  expect(await (await fetch('http://example.com/x')).text()).toBe('')
})

test('dontMock stops answering, doMock resumes', async () => {
  fetchMock.mockResponse('mocked')
  fetchMock.dontMock()

  // delegates to the real fetch, which has nothing to reach here — the point is
  // that it is no longer the mock answering
  await expect(fetch('http://localhost:1/nothing')).rejects.toThrow()

  fetchMock.doMock()
  expect(await (await fetch('http://example.com/x')).text()).toBe('mocked')
})

test('data: URIs are decoded rather than mocked', async () => {
  fetchMock.mockResponse('should not be used')
  const res = await fetch('data:text/plain,hi%20there')
  expect(await res.text()).toBe('hi there')
})
