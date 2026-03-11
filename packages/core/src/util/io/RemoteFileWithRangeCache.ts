import { RemoteFile } from 'generic-filehandle2'

const CHUNK_SIZE = 128 * 1024 // 128KiB
const CACHE_NAME = 'jbrowse-range-cache'

let cachePromise: Promise<Cache> | undefined
function getCache() {
  if (!cachePromise) {
    if (typeof caches !== 'undefined') {
      cachePromise = caches.open(CACHE_NAME)
    }
  }
  return cachePromise
}

const fallbackMap = new Map<string, Response>()

async function getCachedRange(key: string) {
  const cache = await getCache()
  if (cache) {
    return cache.match(new Request(key))
  }
  const cached = fallbackMap.get(key)
  return cached ? cached.clone() : undefined
}

async function storeCachedRange(key: string, response: Response) {
  const cache = await getCache()
  if (cache) {
    await cache.put(new Request(key), response.clone())
  } else {
    fallbackMap.set(key, response.clone())
  }
}

export function clearCache() {
  fallbackMap.clear()
  if (typeof caches !== 'undefined') {
    cachePromise = undefined
    // fire-and-forget
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    caches.delete(CACHE_NAME)
  }
}

export class RemoteFileWithRangeCache extends RemoteFile {
  public async fetch(
    url: string | RequestInfo,
    init?: RequestInit,
  ) {
    const str = String(url)
    const range = new Headers(init?.headers).get('range')
    if (range) {
      const rangeParse = /bytes=(\d+)-(\d+)/.exec(range)
      if (rangeParse) {
        const [, startStr, endStr] = rangeParse
        const start = Number.parseInt(startStr!, 10)
        const end = Number.parseInt(endStr!, 10)
        const response = await this.getCachedRange(str, start, end, init?.signal)
        return response
      }
    }
    return super.fetch(url, init)
  }

  private async getCachedRange(
    url: string,
    start: number,
    end: number,
    signal?: AbortSignal,
  ) {
    const chunkStart = Math.floor(start / CHUNK_SIZE) * CHUNK_SIZE
    const chunkEnd = Math.ceil((end + 1) / CHUNK_SIZE) * CHUNK_SIZE

    const chunkKeys: string[] = []
    for (let offset = chunkStart; offset < chunkEnd; offset += CHUNK_SIZE) {
      chunkKeys.push(`${url}:bytes=${offset}-${offset + CHUNK_SIZE - 1}`)
    }

    const cachedChunks = await Promise.all(
      chunkKeys.map(key => getCachedRange(key)),
    )

    const hasMisses = cachedChunks.some(c => c === undefined)
    if (hasMisses) {
      const freshChunks = await this.fetchRange(url, chunkStart, chunkEnd, signal)

      await Promise.all(
        chunkKeys.map((key, i) => {
          const chunkOffset = chunkStart + i * CHUNK_SIZE
          const slice = freshChunks.slice(
            chunkOffset - chunkStart,
            chunkOffset - chunkStart + CHUNK_SIZE,
          )
          return storeCachedRange(
            key,
            new Response(slice, { status: 200 }),
          )
        }),
      )

      const resultSlice = freshChunks.slice(start - chunkStart, end + 1 - chunkStart)
      return new Response(resultSlice, { status: 206 })
    }

    const definiteChunks = cachedChunks.filter(
      (c): c is Response => c !== undefined,
    )
    const buffers = await Promise.all(
      definiteChunks.map(c => c.arrayBuffer()),
    )
    const totalLength = buffers.reduce((sum, b) => sum + b.byteLength, 0)
    const merged = new Uint8Array(totalLength)
    let offset = 0
    for (const buf of buffers) {
      merged.set(new Uint8Array(buf), offset)
      offset += buf.byteLength
    }

    const resultSlice = merged.slice(start - chunkStart, end + 1 - chunkStart)
    return new Response(resultSlice, { status: 206 })
  }

  private async fetchRange(
    url: string,
    start: number,
    end: number,
    signal?: AbortSignal,
  ) {
    const res = await super.fetch(url, {
      signal,
      headers: {
        range: `bytes=${start}-${end - 1}`,
      },
    })
    if (!res.ok) {
      const errorMessage = `HTTP ${res.status} fetching ${url} bytes ${start}-${end - 1}`
      const hint = ' (should be 206 for range requests)'
      throw new Error(`${errorMessage}${res.status === 200 ? hint : ''}`)
    }
    const arrayBuffer = await res.arrayBuffer()
    return new Uint8Array(arrayBuffer)
  }
}
