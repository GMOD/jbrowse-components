import { CHUNK_SIZE, MAX_CACHE_ENTRIES } from '@gmod/range-cache-filehandle'
import { fullConfSnapshot } from '@jbrowse/core/configuration'
import {
  adapterRequests,
  cachedAdapterCount,
  keepAdapters,
} from '@jbrowse/core/data_adapters/dataAdapterCache'
import { decompressedBytesBudget } from '@jbrowse/core/util/cacheBudgets'
import { resolveUriLocation } from '@jbrowse/core/util/io'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'

import { forgetAssemblies, resolvedAssemblies } from './assembly.ts'
import { rangeReads, wholeFileBytes } from './bareHost.ts'

import type { AnyDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { UriLocation } from '@jbrowse/core/util/types'

/**
 * What the engine keeps between calls, two bounds of this many bytes each:
 * the decoded records (BAM and CRAM records, tabix lines), and what the
 * adapters it keeps parsed from the files they read whole. A browser worker
 * keeps 1 GiB of records, sized for panning; a host such as R holds its own
 * copy of each table and rarely reads a region twice.
 */
export const DEFAULT_CACHE_LIMIT = 256 * 2 ** 20

/**
 * The least an adapter weighs, about what one over a small index holds: a
 * BAM adapter's header and caches measured 750 KiB.
 */
export const MIN_ADAPTER_BYTES = 2 ** 20

const CHUNK_CACHE_BYTES = MAX_CACHE_ENTRIES * CHUNK_SIZE

/**
 * Estimates of what an adapter holds per uncompressed byte of a file it read
 * whole (TABLES.md): about 4 for an index, about 10 for a file it parses into
 * records, such as a plain VCF.
 */
const INDEX_HOLDS_PER_BYTE = 4
const PARSED_HOLDS_PER_BYTE = 10
const INDEX = /\.(bai|csi|crai|tbi)$/i

export interface CacheUse {
  /** the bound, in bytes, on decoded records and separately on `parsed` */
  limit: number
  /** bytes of decoded records held */
  decoded: number
  /** at most the file bytes the chunk cache holds, under its 256 MiB cap */
  chunks: number
  /** an estimate of what the adapters held parsed from files read whole */
  parsed: number
  /** adapters held, one per file or sequence read */
  adapters: number
  /** assemblies resolved: each one's contigs and alias names */
  assemblies: number
}

const urlsOf = new WeakMap<AnyDataAdapter, string[]>()

function locationUrls(value: unknown, urls: string[] = []) {
  if (Array.isArray(value)) {
    for (const v of value) {
      locationUrls(v, urls)
    }
  } else if (value && typeof value === 'object') {
    const location = value as Partial<UriLocation>
    if (typeof location.uri === 'string') {
      urls.push(resolveUriLocation(location as UriLocation).uri)
    }
    for (const v of Object.values(value)) {
      locationUrls(v, urls)
    }
  }
  return urls
}

function urlsIn(adapter: AnyDataAdapter) {
  let urls = urlsOf.get(adapter)
  if (!urls) {
    urls = locationUrls(fullConfSnapshot(adapter.config))
    urlsOf.set(adapter, urls)
  }
  return urls
}

function retained(url: string) {
  const perByte = INDEX.test(url.replace(/[?#].*$/, ''))
    ? INDEX_HOLDS_PER_BYTE
    : PARSED_HOLDS_PER_BYTE
  return (wholeFileBytes.get(url) ?? 0) * perByte
}

function weigh(adapter: AnyDataAdapter) {
  let bytes = 0
  for (const url of urlsIn(adapter)) {
    bytes += retained(url)
  }
  return Math.max(MIN_ADAPTER_BYTES, bytes)
}

let limit = DEFAULT_CACHE_LIMIT
let parsed = 0
let lastCall = 0

const held = (): CacheUse => ({
  limit,
  decoded: decompressedBytesBudget.total,
  chunks: Math.min(rangeReads.bytes, CHUNK_CACHE_BYTES),
  parsed,
  adapters: cachedAdapterCount(),
  assemblies: resolvedAssemblies(),
})

/**
 * Keeps the adapters the last call used, then each other adapter, most
 * recently requested first, whose weight still fits under `limit` beside
 * those kept.
 */
async function trim() {
  const named = new Set<string>()
  let kept = 0
  await keepAdapters((adapter, lastRequest) => {
    const weight = weigh(adapter)
    const keep = lastRequest > lastCall || kept + weight <= limit
    if (keep) {
      kept += weight
      for (const url of urlsIn(adapter)) {
        named.add(url)
      }
    }
    return keep
  })
  parsed = kept
  for (const url of wholeFileBytes.keys()) {
    if (!named.has(url)) {
      wholeFileBytes.delete(url)
    }
  }
}

function applyLimit(bytes: number) {
  if (typeof bytes !== 'number' || !(bytes >= 0)) {
    throw new Error(`a cache limit is a number of bytes, not ${bytes}`)
  }
  limit = bytes
  decompressedBytesBudget.limit = bytes
}

const cache = {
  held,
  /** Runs `call`, then trims, keeping the adapters it used. */
  async within<R>(call: () => Promise<R>) {
    const since = adapterRequests()
    try {
      return await call()
    } finally {
      lastCall = since
      await trim()
    }
  },
  async setLimit(bytes: number) {
    applyLimit(bytes)
    await trim()
    return held()
  },
  async clear() {
    await keepAdapters(() => false)
    clearCache()
    rangeReads.bytes = 0
    wholeFileBytes.clear()
    forgetAssemblies()
    parsed = 0
    return held()
  },
}

let started = false

/**
 * The caches every engine in the process shares, trimmed to `limit` after
 * each call. The first engine sets the default.
 */
export function engineCache() {
  if (!started) {
    applyLimit(limit)
    started = true
  }
  return cache
}
