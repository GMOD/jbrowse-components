import { lazyChunk } from './lazyChunk.ts'

// Webpack's ChunkLoadError, reproduced by its two load-bearing fields: the
// `name` the wrapper keys off and the `request` URL everything it reports is
// about.
function chunkLoadError(url = 'https://example.org/static/js/42.chunk.js') {
  const error = new Error(`Loading chunk 42 failed.\n(error: ${url})`)
  error.name = 'ChunkLoadError'
  Object.assign(error, { request: url, type: 'error' })
  return error
}

// jsdom implements neither half of the Resource Timing API, so both stand in
// here — the class so `instanceof` can narrow, the lookup so it has something
// to narrow. A browser has both, and the wrapper reads them unguarded.
class FakeResourceTiming {
  constructor(
    readonly responseStatus: number,
    readonly transferSize: number,
    readonly encodedBodySize: number,
    readonly duration: number,
  ) {}
}

let errors: unknown[][]
const realFetch = globalThis.fetch
const realGetEntriesByName = performance.getEntriesByName

beforeEach(() => {
  errors = []
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(args)
  })
  Object.assign(globalThis, {
    PerformanceResourceTiming: FakeResourceTiming,
  })
  performance.getEntriesByName = jest.fn().mockReturnValue([])
  // the probe refetch. A response is what the wrapper reports; whether it
  // succeeds is not a term in whether it retries.
  globalThis.fetch = jest.fn().mockResolvedValue({
    status: 404,
    statusText: 'Not Found',
    headers: { get: () => 'text/html' },
    text: () => Promise.resolve('<!doctype html>'),
  })
})

afterEach(() => {
  jest.restoreAllMocks()
  globalThis.fetch = realFetch
  performance.getEntriesByName = realGetEntriesByName
})

const logged = () => errors.map(e => String(e[0]))

// React.lazy calls the factory itself, and calls it late. A wrapper that ran
// the import at module scope would defeat code splitting outright — the chunks
// would all be fetched at boot.
test('hands back a factory that has not imported anything yet', async () => {
  const load = jest.fn().mockResolvedValue({ default: 'Mod' })

  const factory = lazyChunk('Widget', load)

  expect(load).not.toHaveBeenCalled()
  await expect(factory()).resolves.toEqual({ default: 'Mod' })
})

test('a chunk that loads is passed straight through, with no probe', async () => {
  const load = jest.fn().mockResolvedValue({ default: 'Mod' })

  await expect(lazyChunk('Widget', load)()).resolves.toEqual({ default: 'Mod' })

  expect(load).toHaveBeenCalledTimes(1)
  expect(globalThis.fetch).not.toHaveBeenCalled()
  expect(errors).toEqual([])
})

// The whole point of the wrapper: React.lazy stores the first rejection and
// rethrows it for the life of the page without calling the factory again, so
// the second attempt has to happen before the promise settles. Without it the
// app boots to "Loading chunk X failed" with no way back but a reload.
test('a ChunkLoadError is retried once, inside the same promise', async () => {
  const load = jest
    .fn()
    .mockRejectedValueOnce(chunkLoadError())
    .mockResolvedValueOnce({ default: 'Mod' })

  await expect(lazyChunk('DrawerWidget', load)()).resolves.toEqual({
    default: 'Mod',
  })

  expect(load).toHaveBeenCalledTimes(2)
  expect(logged()).toEqual([
    'chunk load failed: DrawerWidget',
    'chunk retry succeeded: DrawerWidget',
  ])
})

// `cache: 'reload'` is not decoration. It is what replaces whatever the HTTP
// cache is holding — a dev server sends no Cache-Control, so one bad response
// for a build asset otherwise replays from the client's cache forever — and it
// is what makes the retry a real request rather than a hopeful second roll.
test('the probe refetches the failed URL bypassing the cache', async () => {
  const url = 'https://example.org/static/js/7.chunk.js'
  const load = jest
    .fn()
    .mockRejectedValueOnce(chunkLoadError(url))
    .mockResolvedValueOnce({ default: 'Mod' })

  await lazyChunk('ViewLauncher', load)()

  expect(globalThis.fetch).toHaveBeenCalledWith(url, { cache: 'reload' })
})

// The diagnostic half. Webpack flattens a 404, a refused connection and a
// dropped socket into one string, so what the report adds — the URL, the
// script element's own verdict, and what a second request actually got — is
// the only thing that tells them apart in a bug report.
test('the report names the chunk, the URL and what the refetch got', async () => {
  const url = 'https://example.org/static/js/7.chunk.js'
  const load = jest
    .fn()
    .mockRejectedValueOnce(chunkLoadError(url))
    .mockResolvedValueOnce({ default: 'Mod' })

  await lazyChunk('WorkspaceContainer', load)()

  const [label, detail] = errors[0] as [string, string]
  expect(label).toBe('chunk load failed: WorkspaceContainer')
  const parsed = JSON.parse(detail) as Record<string, unknown>
  expect(parsed).toMatchObject({ url, type: 'error' })
  expect(parsed.probe).toBe('refetch: HTTP 404 Not Found, text/html, 15 bytes')
  // nothing in jsdom's timeline, and the report says so rather than omitting
  // the field
  expect(parsed.timing).toBe('no resource timing entry')
})

// The one thing curl cannot show: a `transferSize` of 0 next to a body size
// says the response came out of the client's HTTP cache, not off the server —
// which is the failure mode the `cache: 'reload'` probe exists to break.
test('the report carries what the browser recorded for the failed request', async () => {
  const url = 'https://example.org/static/js/7.chunk.js'
  performance.getEntriesByName = jest
    .fn()
    .mockReturnValue([new FakeResourceTiming(404, 0, 15, 3.6)])
  const load = jest
    .fn()
    .mockRejectedValueOnce(chunkLoadError(url))
    .mockResolvedValueOnce({ default: 'Mod' })

  await lazyChunk('DrawerWidget', load)()

  expect(performance.getEntriesByName).toHaveBeenCalledWith(url)
  const parsed = JSON.parse(String(errors[0]![1])) as {
    timing: unknown
  }
  expect(parsed.timing).toEqual({
    responseStatus: 404,
    transferSize: 0,
    encodedBodySize: 15,
    duration: 4,
  })
})

// A probe that throws is still a diagnosis — "the network is gone" — and must
// not swallow the retry behind it.
test('a probe that throws still reports, and still retries', async () => {
  globalThis.fetch = jest.fn().mockRejectedValue(new Error('Failed to fetch'))
  const load = jest
    .fn()
    .mockRejectedValueOnce(chunkLoadError())
    .mockResolvedValueOnce({ default: 'Mod' })

  await expect(lazyChunk('Widget', load)()).resolves.toEqual({
    default: 'Mod',
  })

  const parsed = JSON.parse(String(errors[0]![1])) as {
    probe: string
  }
  expect(parsed.probe).toContain('refetch also failed')
  expect(load).toHaveBeenCalledTimes(2)
})

// The ORIGINAL error, not the retry's. The first one carries the URL and the
// script element's verdict; a second failure of the same request says nothing
// the first did not, and `markCrashedSession` records whatever surfaces here.
test('a retry that fails too rethrows the first error', async () => {
  const first = chunkLoadError()
  const second = new Error('second attempt')
  const load = jest
    .fn()
    .mockRejectedValueOnce(first)
    .mockRejectedValueOnce(second)

  await expect(lazyChunk('Widget', load)()).rejects.toBe(first)

  expect(load).toHaveBeenCalledTimes(2)
  expect(logged()).toContain('chunk retry failed: Widget')
})

// Only a chunk failure is a chunk failure. A module that throws while
// evaluating rejects the same import, and re-running it would run its
// side effects twice and report a network diagnosis for something that was
// never a network problem.
test('an ordinary module error is not retried and not probed', async () => {
  const boom = new Error('cannot read properties of undefined')
  const load = jest.fn().mockRejectedValue(boom)

  await expect(lazyChunk('Widget', load)()).rejects.toBe(boom)

  expect(load).toHaveBeenCalledTimes(1)
  expect(globalThis.fetch).not.toHaveBeenCalled()
  expect(errors).toEqual([])
})

// `name: 'ChunkLoadError'` alone is not enough — the retry needs a URL to
// probe, and webpack is the only thing that puts one there.
test('a ChunkLoadError carrying no request URL is left alone', async () => {
  const error = new Error('Loading chunk 42 failed.')
  error.name = 'ChunkLoadError'
  const load = jest.fn().mockRejectedValue(error)

  await expect(lazyChunk('Widget', load)()).rejects.toBe(error)

  expect(load).toHaveBeenCalledTimes(1)
  expect(globalThis.fetch).not.toHaveBeenCalled()
})
