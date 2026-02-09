import { RemoteFile } from 'generic-filehandle2'

import pLimit from '../p-limit.ts'

const CHUNK_SIZE = 128 * 1024 // 128KiB
const CACHE_NAME = 'jbrowse-range-cache'

const hasCacheAPI = typeof caches !== 'undefined'
let mapCache = new Map<string, Uint8Array>()
let cachePromise: Promise<Cache> | undefined

const limit = pLimit(20)

function cacheKey(url: string, chunkNum: number) {
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}__jb_chunk=${chunkNum}`
}

function getCache() {
  if (!cachePromise && hasCacheAPI) {
    cachePromise = caches.open(CACHE_NAME)
  }
  return cachePromise
}

async function getCached(key: string) {
  const cache = await getCache()
  if (cache) {
    const res = await cache.match(key)
    if (res) {
      return new Uint8Array(await res.arrayBuffer())
    }
  } else {
    return mapCache.get(key)
  }
  return undefined
}

async function putCached(key: string, buffer: Uint8Array) {
  const cache = await getCache()
  if (cache) {
    // @ts-expect-error
    await cache.put(new Request(key), new Response(buffer))
  } else {
    mapCache.set(key, buffer)
  }
}

export function clearCache() {
  if (hasCacheAPI) {
    cachePromise = undefined
    caches.delete(CACHE_NAME).catch(() => {})
  }
  mapCache = new Map()
}

export class RemoteFileWithRangeCache extends RemoteFile {
  public async fetch(
    url: string | RequestInfo,
    init?: RequestInit,
  ): Promise<Response> {
    const range = new Headers(init?.headers).get('range')
    if (range) {
      const rangeParse = /bytes=(\d+)-(\d+)/.exec(range)
      if (rangeParse) {
        const [, start, end] = rangeParse
        const s = Number.parseInt(start!, 10)
        const e = Number.parseInt(end!, 10)
        const buffer = await this.getCachedRange(String(url), s, e)
        // @ts-expect-error
        return new Response(buffer, { status: 206 })
      }
    }
    return super.fetch(url, init)
  }

  private async getCachedRange(url: string, start: number, end: number) {
    const startChunk = Math.floor(start / CHUNK_SIZE)
    const endChunk = Math.floor(end / CHUNK_SIZE)

    // Check which chunks we already have
    const chunks = new Array<Uint8Array | undefined>(endChunk - startChunk + 1)
    for (let i = startChunk; i <= endChunk; i++) {
      chunks[i - startChunk] = await getCached(cacheKey(url, i))
    }

    // Fetch contiguous runs of missing chunks in single requests
    let i = 0
    while (i < chunks.length) {
      if (chunks[i]) {
        i++
        continue
      }
      // Find the end of this contiguous gap
      let gapEnd = i
      while (gapEnd < chunks.length && !chunks[gapEnd]) {
        gapEnd++
      }

      const fetchStart = (startChunk + i) * CHUNK_SIZE
      const fetchEnd = (startChunk + gapEnd) * CHUNK_SIZE - 1
      const fetched = await this.fetchRange(url, fetchStart, fetchEnd)

      // Split into chunks and cache each one
      for (let j = i; j < gapEnd; j++) {
        const off = (j - i) * CHUNK_SIZE
        const chunk = fetched.subarray(off, off + CHUNK_SIZE)
        chunks[j] = chunk
        await putCached(cacheKey(url, startChunk + j), chunk)
      }

      i = gapEnd
    }

    // Assemble the result from cached chunks
    if (chunks.length === 1) {
      const sliceStart = start - startChunk * CHUNK_SIZE
      return chunks[0]!.subarray(sliceStart, sliceStart + (end - start + 1))
    }

    const totalLen = chunks.reduce((acc, b) => acc + b!.length, 0)
    const combined = new Uint8Array(totalLen)
    let offset = 0
    for (const buf of chunks) {
      combined.set(buf!, offset)
      offset += buf!.length
    }

    const sliceStart = start - startChunk * CHUNK_SIZE
    return combined.subarray(sliceStart, sliceStart + (end - start + 1))
  }

  private fetchRange(url: string, start: number, end: number) {
    return limit(async () => {
      const res = await super.fetch(url, {
        headers: { range: `bytes=${start}-${end}` },
      })
      if (!res.ok) {
        const hint =
          res.status === 200 ? ' (should be 206 for range requests)' : ''
        throw Object.assign(
          new Error(
            `HTTP ${res.status} fetching ${url} bytes ${start}-${end}${hint}`,
          ),
          { status: res.status },
        )
      }
      return new Uint8Array(await res.arrayBuffer())
    })
  }
}
