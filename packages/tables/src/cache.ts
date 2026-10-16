import { fullConfSnapshot } from '@jbrowse/core/configuration'
import {
  adapterRequests,
  cachedAdapterCount,
  keepAdapters,
} from '@jbrowse/core/data_adapters/dataAdapterCache'
import { decompressedBytesBudget } from '@jbrowse/core/util/cacheBudgets'
import { resolveUriLocation } from '@jbrowse/core/util/io'
import {
  clearCache,
  clearCacheFor,
} from '@jbrowse/core/util/io/RemoteFileWithRangeCache'

import { forgetAssemblies, resolvedAssemblies } from './assembly.ts'
import { rangeBytes, wholeFileBytes } from './bareHost.ts'

import type { AnyDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { UriLocation } from '@jbrowse/core/util/types'

/**
 * The bytes the engine keeps between calls: three quarters for decoded
 * records (BAM and CRAM records, tabix lines), one quarter for file bytes:
 * the indexes of the adapters it keeps, then the chunks the host read. A
 * browser worker keeps up to 1.25 GiB, sized for panning; a host such as R
 * holds its own copy of each table and rarely reads a region twice.
 */
export const DEFAULT_CACHE_LIMIT = 256 * 2 ** 20

/**
 * The least an adapter weighs, about what one over a small index holds: a
 * BAM adapter's header and caches measured 750 KiB.
 */
export const MIN_ADAPTER_BYTES = 2 ** 20

export interface CacheUse {
  /** the budget, in bytes */
  limit: number
  /** bytes of decoded records held */
  decoded: number
  /** file bytes the host read in ranges and the chunk cache may hold */
  chunks: number
  /** bytes the adapters held weigh: each file they read whole */
  indexes: number
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

function weigh(adapter: AnyDataAdapter) {
  let bytes = 0
  for (const url of urlsIn(adapter)) {
    bytes += wholeFileBytes.get(url) ?? 0
  }
  return Math.max(MIN_ADAPTER_BYTES, bytes)
}

function sum(map: Map<string, number>) {
  let total = 0
  for (const bytes of map.values()) {
    total += bytes
  }
  return total
}

let limit = DEFAULT_CACHE_LIMIT
let indexes = 0

const held = (): CacheUse => ({
  limit,
  decoded: decompressedBytesBudget.total,
  chunks: sum(rangeBytes),
  indexes,
  adapters: cachedAdapterCount(),
  assemblies: resolvedAssemblies(),
})

/**
 * Keeps the adapters a call since request `since` used, then the most
 * recently requested others whose weight fits the file quarter, then each
 * file's chunks, least recently read dropped first, in what is left.
 */
async function trim(since = adapterRequests()) {
  const share = limit / 4
  const named = new Set<string>()
  let kept = 0
  await keepAdapters((adapter, lastRequest) => {
    const weight = weigh(adapter)
    const keep = lastRequest > since || kept + weight <= share
    if (keep) {
      kept += weight
      for (const url of urlsIn(adapter)) {
        named.add(url)
      }
    }
    return keep
  })
  indexes = kept
  for (const url of wholeFileBytes.keys()) {
    if (!named.has(url)) {
      wholeFileBytes.delete(url)
    }
  }
  let chunks = sum(rangeBytes)
  for (const [url, bytes] of rangeBytes) {
    if (chunks <= share - indexes) {
      break
    }
    clearCacheFor(url)
    rangeBytes.delete(url)
    chunks -= bytes
  }
}

function applyLimit(bytes: number) {
  if (typeof bytes !== 'number' || !(bytes >= 0)) {
    throw new Error(`a cache limit is a number of bytes, not ${bytes}`)
  }
  limit = bytes
  decompressedBytesBudget.limit = bytes * 0.75
}

const cache = {
  held,
  /** Runs `call`, then trims, keeping the adapters it used. */
  async within<R>(call: () => Promise<R>) {
    const since = adapterRequests()
    try {
      return await call()
    } finally {
      await trim(since)
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
    rangeBytes.clear()
    wholeFileBytes.clear()
    forgetAssemblies()
    indexes = 0
    return held()
  },
}

let started = false

/**
 * The caches every engine in the process shares, held to `limit` bytes after
 * each call. The first engine sets the default budget.
 */
export function engineCache() {
  if (!started) {
    applyLimit(limit)
    started = true
  }
  return cache
}
