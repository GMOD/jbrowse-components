import {
  cachedAdapterCount,
  keepRecentAdapters,
} from '@jbrowse/core/data_adapters/dataAdapterCache'
import { decompressedBytesBudget } from '@jbrowse/core/util/cacheBudgets'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'

import { hostBytesRead } from './bareHost.ts'

/**
 * The bytes the engine keeps between calls: three quarters for decoded
 * records (BAM and CRAM records, tabix lines), one quarter for the file bytes
 * the host read. A browser worker keeps up to 1.25 GiB, sized for panning; a
 * host such as R holds its own copy of each table and rarely reads a region
 * twice.
 */
export const DEFAULT_CACHE_LIMIT = 256 * 2 ** 20

/** How many adapters, each with its parsed index, the engine keeps. */
export const CACHED_ADAPTERS = 32

export interface CacheUse {
  /** the budget, in bytes */
  limit: number
  /** bytes of decoded records held */
  decoded: number
  /**
   * file bytes the host has read since the engine last emptied its chunk
   * cache, the most that cache can hold
   */
  read: number
  /** adapters held, one per file or sequence read */
  adapters: number
}

/**
 * The engine's caches, held to `limit` bytes after each call, and to the
 * {@link CACHED_ADAPTERS} adapters read most recently. The chunk cache has no
 * byte count of its own, so the engine empties it once the bytes read since it
 * last did pass its share.
 */
export function engineCache(initialLimit = DEFAULT_CACHE_LIMIT) {
  let limit = initialLimit
  let readFrom = hostBytesRead()
  const read = () => hostBytesRead() - readFrom
  const emptyChunks = () => {
    clearCache()
    readFrom = hostBytesRead()
  }
  const held = (): CacheUse => ({
    limit,
    decoded: decompressedBytesBudget.total,
    read: read(),
    adapters: cachedAdapterCount(),
  })
  const trim = async () => {
    if (read() > limit / 4) {
      emptyChunks()
    }
    await keepRecentAdapters(CACHED_ADAPTERS)
  }
  const setLimit = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes < 0) {
      throw new Error(`a cache limit is a number of bytes, not ${bytes}`)
    }
    limit = bytes
    decompressedBytesBudget.limit = bytes * 0.75
  }
  setLimit(limit)
  return {
    held,
    trim,
    async setLimit(bytes: number) {
      setLimit(bytes)
      await trim()
      return held()
    },
    async clear() {
      await keepRecentAdapters(0)
      emptyChunks()
      return held()
    },
  }
}
