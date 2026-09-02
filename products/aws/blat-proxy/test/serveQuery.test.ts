import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MAX_CACHEABLE_BODY_BYTES } from '../src/budget.ts'
import { serveQuery } from '../src/index.ts'
import { ISPCR_ROUTE } from '../src/routes.ts'
import { memoryStore } from './memoryStore.ts'

import type { BlatStore } from '../src/store.ts'

const NOON = Date.parse('2026-07-26T12:00:00Z')
const UPSTREAM = 'https://genome.ucsc.edu/cgi-bin/hgBlat'
const QUERY = 'userSeq=ACGTACGT&type=DNA&db=hg38'
const OTHER_QUERY = 'userSeq=TTTTGGGG&type=DNA&db=hg38'

function serve({
  clientBody = QUERY,
  store,
  nowMs = NOON,
  bypassCache,
}: {
  clientBody?: string
  store?: BlatStore
  nowMs?: number
  bypassCache?: boolean
}) {
  return serveQuery({
    clientBody,
    apiKey: 'SECRET',
    upstreamUrl: UPSTREAM,
    store,
    nowMs,
    bypassCache,
  })
}

function structured(result: Awaited<ReturnType<typeof serveQuery>>) {
  if (typeof result === 'string') {
    throw new Error('expected a structured result, got a string')
  }
  return result
}

function stubUpstream(body = '{"blat":[["hit"]]}') {
  // a fresh Response per call: a body can only be read once
  const fetchSpy = vi
    .fn()
    .mockImplementation(() => Promise.resolve(new Response(body)))
  vi.stubGlobal('fetch', fetchSpy)
  return fetchSpy
}

beforeEach(() => {
  delete process.env.BLAT_SPACING_MS
  delete process.env.BLAT_DAILY_MAX
  delete process.env.BLAT_CACHE_TTL_SECONDS
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('serveQuery budget', () => {
  it('spends one slot per distinct query and serves the repeat from cache', async () => {
    const fetchSpy = stubUpstream()
    const { store } = memoryStore()

    const first = structured(await serve({ store }))
    // a repeat inside the spacing window would be refused if it went upstream
    const second = structured(await serve({ store, nowMs: NOON + 1000 }))

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(first.headers?.['X-Blat-Cache']).toBe('miss')
    expect(second.headers?.['X-Blat-Cache']).toBe('hit')
    expect(second.statusCode).toBe(200)
    expect(second.body).toBe(first.body)
  })

  // the canary's daily probe has to reach UCSC, or a cached answer would report
  // a broken upstream as fine; the probe is still metered and still cached
  it('goes upstream for a repeat when the cache is bypassed, and still meters it', async () => {
    const fetchSpy = stubUpstream()
    const { store, cache } = memoryStore()
    await serve({ store })

    const refused = structured(
      await serve({ store, nowMs: NOON + 1000, bypassCache: true }),
    )
    const result = structured(
      await serve({ store, nowMs: NOON + 15_000, bypassCache: true }),
    )

    expect(refused.statusCode).toBe(429)
    expect(result.headers?.['X-Blat-Cache']).toBe('miss')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(cache.size).toBe(1)
  })

  it('refuses a different query inside the spacing window with a Retry-After', async () => {
    stubUpstream()
    const { store } = memoryStore()
    await serve({ store })

    const result = structured(
      await serve({ clientBody: OTHER_QUERY, store, nowMs: NOON + 5000 }),
    )

    expect(result.statusCode).toBe(429)
    expect(result.headers?.['Retry-After']).toBe('10')
    expect(JSON.parse(result.body ?? '').error).toMatch(/one query every 15/)
  })

  it('lets a different query through once the window has passed', async () => {
    const fetchSpy = stubUpstream()
    const { store } = memoryStore()
    await serve({ store })

    const result = structured(
      await serve({ clientBody: OTHER_QUERY, store, nowMs: NOON + 15_000 }),
    )

    expect(result.statusCode).toBe(200)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('refuses once the day is spent', async () => {
    stubUpstream()
    process.env.BLAT_DAILY_MAX = '1'
    process.env.BLAT_SPACING_MS = '0'
    const { store } = memoryStore()
    await serve({ store })

    const result = structured(await serve({ clientBody: OTHER_QUERY, store }))

    expect(result.statusCode).toBe(429)
    expect(JSON.parse(result.body ?? '').error).toMatch(/budget for 2026-07-26/)
  })

  it('is unmetered with no store, which is why a deployment configures one', async () => {
    const fetchSpy = stubUpstream()
    await serve({})
    await serve({})
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})

describe('serveQuery store failures', () => {
  it('fails closed when the budget cannot be checked', async () => {
    const fetchSpy = stubUpstream()
    const { store } = memoryStore()
    store.tryReserveSlot = () => Promise.reject(new Error('dynamo down'))

    const result = structured(await serve({ store }))

    expect(result.statusCode).toBe(429)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('still serves when only the cache is broken', async () => {
    stubUpstream()
    const { store } = memoryStore()
    store.readCached = () => Promise.reject(new Error('dynamo down'))
    store.writeCached = () => Promise.reject(new Error('dynamo down'))

    const result = structured(await serve({ store }))

    expect(result.statusCode).toBe(200)
  })
})

describe('serveQuery isPCR route', () => {
  const AMPLICON =
    '<HTML><PRE>&gt;chr17:7676521+7676667 147bp ACCTGCAGG CTGGGCAAC</PRE></HTML>'
  const PRIMERS = 'db=hg38&wp_f=ACCTGCAGGTTCAGAGTTCT&wp_r=CTGGGCAACAGAGCGAGAC'

  function servePcr({
    nowMs = NOON,
    store,
  }: {
    nowMs?: number
    store?: BlatStore
  }) {
    return serveQuery({
      clientBody: PRIMERS,
      apiKey: 'SECRET',
      upstreamUrl: 'https://genome.ucsc.edu/cgi-bin/hgPcr',
      route: ISPCR_ROUTE,
      store,
      nowMs,
    })
  }

  it('relays the amplicon page as HTML rather than rejecting it', async () => {
    stubUpstream(AMPLICON)
    const result = structured(await servePcr({ store: memoryStore().store }))
    expect(result.statusCode).toBe(200)
    expect(result.headers?.['Content-Type']).toBe('text/html')
    expect(result.body).toBe(AMPLICON)
  })

  // the whole reason both routes live on one function: UCSC's cap is on the
  // key across the Genome Browser CGIs, not per CGI
  it('claims from the same budget a blat query does', async () => {
    stubUpstream(AMPLICON)
    const { store } = memoryStore()
    await serve({ store })

    const result = structured(await servePcr({ store, nowMs: NOON + 5000 }))

    expect(result.statusCode).toBe(429)
    expect(result.headers?.['Retry-After']).toBe('10')
  })

  it('does not collide with a blat cache entry', async () => {
    // each CGI answers in its own shape, so the stub does too
    const fetchSpy = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          new Response(url.endsWith('hgPcr') ? AMPLICON : '{"blat":[]}'),
        ),
      )
    vi.stubGlobal('fetch', fetchSpy)
    process.env.BLAT_SPACING_MS = '0'
    const { store, cache } = memoryStore()

    // the same body text through both routes: each must reach its own upstream
    // and store its own entry
    await serveQuery({
      clientBody: PRIMERS,
      apiKey: 'SECRET',
      upstreamUrl: 'https://genome.ucsc.edu/cgi-bin/hgBlat',
      store,
      nowMs: NOON,
    })
    await servePcr({ store, nowMs: NOON })

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(cache.size).toBe(2)
  })
})

describe('serveQuery caching', () => {
  it('expires an entry so a later query re-fetches', async () => {
    const fetchSpy = stubUpstream()
    process.env.BLAT_CACHE_TTL_SECONDS = '60'
    process.env.BLAT_SPACING_MS = '0'
    const { store } = memoryStore()

    await serve({ store })
    await serve({ store, nowMs: NOON + 61_000 })

    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('skips an oversized body rather than failing the write', async () => {
    stubUpstream(`{"pad":"${'x'.repeat(MAX_CACHEABLE_BODY_BYTES)}"}`)
    const { store, cache } = memoryStore()

    const result = structured(await serve({ store }))

    expect(result.statusCode).toBe(200)
    expect(cache.size).toBe(0)
  })

  it('does not cache an upstream error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>nope</html>')),
    )
    const { store, cache } = memoryStore()

    const result = structured(await serve({ store }))

    expect(result.statusCode).toBe(502)
    expect(cache.size).toBe(0)
  })
})
