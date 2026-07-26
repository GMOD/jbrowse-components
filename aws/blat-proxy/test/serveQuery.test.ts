import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MAX_CACHEABLE_BODY_BYTES } from '../src/budget.ts'
import { serveQuery } from '../src/index.ts'

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
}: {
  clientBody?: string
  store?: BlatStore
  nowMs?: number
}) {
  return serveQuery({
    clientBody,
    apiKey: 'SECRET',
    upstreamUrl: UPSTREAM,
    store,
    nowMs,
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
