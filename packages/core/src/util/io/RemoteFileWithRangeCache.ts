import { RemoteFile } from 'generic-filehandle2'

const CHUNK_SIZE = 256 * 1024
const CACHE_NAME = 'jbrowse-range-cache'
const MAX_CONCURRENT = 20

function createLimiter(concurrency: number) {
  let active = 0
  const queue: (() => void)[] = []
  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        active++
        fn().then(
          val => {
            active--
            if (queue.length > 0) {
              queue.shift()!()
            }
            resolve(val)
          },
          err => {
            active--
            if (queue.length > 0) {
              queue.shift()!()
            }
            reject(err)
          },
        )
      }
      if (active < concurrency) {
        run()
      } else {
        queue.push(run)
      }
    })
}

const fetchLimit = createLimiter(MAX_CONCURRENT)

let cacheApiAvailable: boolean | undefined
let cacheApiInstance: Cache | undefined

async function getL2Cache() {
  if (cacheApiAvailable === undefined) {
    try {
      cacheApiInstance = await caches.open(CACHE_NAME)
      cacheApiAvailable = true
    } catch {
      cacheApiAvailable = false
    }
  }
  return cacheApiAvailable ? cacheApiInstance : undefined
}

const L1_LIMIT_WITH_L2 = 100
const L1_LIMIT_WITHOUT_L2 = 2000

const l1Cache = new Map<string, Uint8Array>()

function getL1Limit() {
  if (cacheApiAvailable === false) {
    return L1_LIMIT_WITHOUT_L2
  }
  return L1_LIMIT_WITH_L2
}

function l1Get(key: string) {
  return l1Cache.get(key)
}

function l1Set(key: string, value: Uint8Array) {
  l1Cache.set(key, value)
  const limit = getL1Limit()
  if (l1Cache.size > limit) {
    const firstKey = l1Cache.keys().next().value
    if (firstKey !== undefined) {
      l1Cache.delete(firstKey)
    }
  }
}

function chunkKey(url: string, chunkStart: number) {
  return `${url}:${chunkStart}`
}

function cacheRequestUrl(url: string, chunkStart: number) {
  return `https://jbrowse-range-cache/${encodeURIComponent(url)}?start=${chunkStart}`
}

async function getCachedChunk(url: string, chunkStart: number) {
  const key = chunkKey(url, chunkStart)
  const l1Hit = l1Get(key)
  if (l1Hit) {
    return l1Hit
  }
  const l2 = await getL2Cache()
  if (l2) {
    const l2Response = await l2.match(cacheRequestUrl(url, chunkStart))
    if (l2Response) {
      const buffer = new Uint8Array(await l2Response.arrayBuffer())
      l1Set(key, buffer)
      return buffer
    }
  }
  return undefined
}

function storeChunk(url: string, chunkStart: number, data: Uint8Array) {
  const key = chunkKey(url, chunkStart)
  l1Set(key, data)

  // fire-and-forget L2 write
  getL2Cache().then(l2 => {
    if (l2) {
      l2.put(
        cacheRequestUrl(url, chunkStart),
        new Response(data, {
          headers: { 'Content-Type': 'application/octet-stream' },
        }),
      ).catch(() => {})
    }
  }).catch(() => {})
}

export function clearCache() {
  l1Cache.clear()
  if (cacheApiAvailable && cacheApiInstance) {
    caches.delete(CACHE_NAME).catch(() => {})
    cacheApiAvailable = undefined
    cacheApiInstance = undefined
  }
}

export class RemoteFileWithRangeCache extends RemoteFile {
  private async fetchChunk(
    url: string,
    chunkStart: number,
    signal?: AbortSignal,
  ) {
    const chunkEnd = chunkStart + CHUNK_SIZE - 1
    const res = await fetchLimit(() =>
      super.fetch(url, {
        headers: { range: `bytes=${chunkStart}-${chunkEnd}` },
        signal,
      }),
    )
    if (!res.ok) {
      const errorMessage = `HTTP ${res.status} fetching ${url} bytes ${chunkStart}-${chunkEnd}`
      const hint = ' (should be 206 for range requests)'
      throw new Error(`${errorMessage}${res.status === 200 ? hint : ''}`)
    }
    return new Uint8Array(await res.arrayBuffer())
  }

  private async getChunk(
    url: string,
    chunkStart: number,
    signal?: AbortSignal,
  ) {
    const cached = await getCachedChunk(url, chunkStart)
    if (cached) {
      return cached
    }
    const fetched = await this.fetchChunk(url, chunkStart, signal)
    storeChunk(url, chunkStart, fetched)
    return fetched
  }

  private async getCachedRange(
    url: string,
    start: number,
    end: number,
    signal?: AbortSignal,
  ) {
    const firstChunk = Math.floor(start / CHUNK_SIZE) * CHUNK_SIZE
    const lastChunk = Math.floor(end / CHUNK_SIZE) * CHUNK_SIZE
    const chunkStarts: number[] = []
    for (let c = firstChunk; c <= lastChunk; c += CHUNK_SIZE) {
      chunkStarts.push(c)
    }

    const chunks = await Promise.all(
      chunkStarts.map(cs => this.getChunk(url, cs, signal)),
    )

    const totalLen = end - start + 1
    const result = new Uint8Array(totalLen)
    let written = 0
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!
      const cs = chunkStarts[i]!
      const offsetInChunk = i === 0 ? start - cs : 0
      const available = chunk.length - offsetInChunk
      const needed = totalLen - written
      const copyLen = Math.min(available, needed)
      result.set(chunk.subarray(offsetInChunk, offsetInChunk + copyLen), written)
      written += copyLen
    }

    return result.subarray(0, written)
  }

  public async fetch(
    url: string | RequestInfo,
    init?: RequestInit,
  ): Promise<Response> {
    const range = new Headers(init?.headers).get('range')
    if (range) {
      const rangeParse = /bytes=(\d+)-(\d+)/.exec(range)
      if (rangeParse) {
        const s = Number.parseInt(rangeParse[1]!, 10)
        const e = Number.parseInt(rangeParse[2]!, 10)
        const buffer = await this.getCachedRange(
          String(url),
          s,
          e,
          init?.signal ?? undefined,
        )
        return new Response(buffer, { status: 206 })
      }
    }
    return super.fetch(url, init)
  }
}
