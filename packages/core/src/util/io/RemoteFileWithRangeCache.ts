import { RemoteFile } from 'generic-filehandle2'

const CHUNK_SIZE = 128 * 1024 // 128KiB
const CACHE_NAME = 'jbrowse-range-cache'

const hasCacheAPI = typeof caches !== 'undefined'
let mapCache = new Map<string, Uint8Array>()

async function getCached(key: string) {
  if (hasCacheAPI) {
    const cache = await caches.open(CACHE_NAME)
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
  if (hasCacheAPI) {
    const cache = await caches.open(CACHE_NAME)
    await cache.put(new Request(key), new Response(buffer))
  } else {
    mapCache.set(key, buffer)
  }
}

export function clearCache() {
  if (hasCacheAPI) {
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
        return new Response(buffer, { status: 206 })
      }
    }
    return super.fetch(url, init)
  }

  private async getCachedRange(url: string, start: number, end: number) {
    const startChunk = Math.floor(start / CHUNK_SIZE)
    const endChunk = Math.floor(end / CHUNK_SIZE)

    const buffers: Uint8Array[] = []
    for (let i = startChunk; i <= endChunk; i++) {
      buffers.push(await this.getChunk(url, i))
    }

    if (buffers.length === 1) {
      const sliceStart = start - startChunk * CHUNK_SIZE
      return buffers[0]!.subarray(sliceStart, sliceStart + (end - start + 1))
    }

    const totalLen = buffers.reduce((acc, b) => acc + b.length, 0)
    const combined = new Uint8Array(totalLen)
    let offset = 0
    for (const buf of buffers) {
      combined.set(buf, offset)
      offset += buf.length
    }

    const sliceStart = start - startChunk * CHUNK_SIZE
    return combined.subarray(sliceStart, sliceStart + (end - start + 1))
  }

  private async getChunk(url: string, chunkNum: number) {
    const sep = url.includes('?') ? '&' : '?'
    const cacheKey = `${url}${sep}__jb_chunk=${chunkNum}`

    const cached = await getCached(cacheKey)
    if (cached) {
      return cached
    }

    const chunkStart = chunkNum * CHUNK_SIZE
    const chunkEnd = chunkStart + CHUNK_SIZE - 1
    const res = await super.fetch(url, {
      headers: { range: `bytes=${chunkStart}-${chunkEnd}` },
    })
    if (!res.ok) {
      const hint =
        res.status === 200 ? ' (should be 206 for range requests)' : ''
      throw Object.assign(
        new Error(
          `HTTP ${res.status} fetching ${url} bytes ${chunkStart}-${chunkEnd}${hint}`,
        ),
        { status: res.status },
      )
    }
    const buffer = new Uint8Array(await res.arrayBuffer())
    await putCached(cacheKey, buffer)
    return buffer
  }
}
