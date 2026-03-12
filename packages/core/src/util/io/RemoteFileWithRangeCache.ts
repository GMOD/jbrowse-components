import { RemoteFile } from 'generic-filehandle2'

const MAX_CACHE_ENTRIES = 2000
const CHUNK_SIZE = 256 * 1024
const MAX_CONCURRENT = 20

let cache = new Map<string, Uint8Array>()
let activeCount = 0
const queue: (() => void)[] = []

function getCached(key: string) {
  return cache.get(key)
}

function putCached(key: string, buffer: Uint8Array) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value
    if (firstKey !== undefined) {
      cache.delete(firstKey)
    }
  }
  cache.set(key, buffer)
}

export function clearCache() {
  cache = new Map<string, Uint8Array>()
}

function runNext() {
  if (queue.length > 0 && activeCount < MAX_CONCURRENT) {
    activeCount++
    const next = queue.shift()!
    next()
  }
}

function limitConcurrency<T>(fn: () => Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    function run() {
      fn().then(
        val => {
          activeCount--
          resolve(val)
          runNext()
        },
        (err: unknown) => {
          activeCount--
          reject(err as Error)
          runNext()
        },
      )
    }
    if (activeCount < MAX_CONCURRENT) {
      activeCount++
      run()
    } else {
      queue.push(run)
    }
  })
}

function cacheKey(url: string, chunkIndex: number) {
  return `${url}:${chunkIndex}`
}

export class RemoteFileWithRangeCache extends RemoteFile {
  private async fetchRange(
    url: string,
    start: number,
    end: number,
    signal?: AbortSignal | null,
  ) {
    const res = await super.fetch(url, {
      signal: signal ?? undefined,
      headers: { range: `bytes=${start}-${end}` },
    })
    if (!res.ok) {
      const errorMessage = `HTTP ${res.status} fetching ${url} bytes ${start}-${end}`
      const hint = ' (should be 206 for range requests)'
      throw new Error(`${errorMessage}${res.status === 200 ? hint : ''}`)
    }
    return new Uint8Array(await res.arrayBuffer())
  }

  private async getCachedRange(
    url: string,
    start: number,
    length: number,
    signal?: AbortSignal | null,
  ) {
    const startChunk = Math.floor(start / CHUNK_SIZE)
    const endChunk = Math.floor((start + length - 1) / CHUNK_SIZE)
    const chunkCount = endChunk - startChunk + 1

    const chunks = await Promise.all(
      Array.from({ length: chunkCount }, (_, i) => {
        const idx = startChunk + i
        const key = cacheKey(url, idx)
        const existing = getCached(key)
        if (existing) {
          return Promise.resolve(existing)
        }
        return limitConcurrency(async () => {
          const alreadyCached = getCached(key)
          if (alreadyCached) {
            return alreadyCached
          }
          const chunkStart = idx * CHUNK_SIZE
          const chunkEnd = chunkStart + CHUNK_SIZE - 1
          const data = await this.fetchRange(url, chunkStart, chunkEnd, signal)
          putCached(key, data)
          return data
        })
      }),
    )

    const offsetInFirstChunk = start - startChunk * CHUNK_SIZE
    const result = new Uint8Array(length)
    let written = 0
    for (const [i, chunk_] of chunks.entries()) {
      const chunk = chunk_
      const sourceStart = i === 0 ? offsetInFirstChunk : 0
      const available = chunk.length - sourceStart
      const needed = length - written
      const copyLen = Math.min(available, needed)
      result.set(chunk.subarray(sourceStart, sourceStart + copyLen), written)
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
        const [, startStr, endStr] = rangeParse
        const s = Number.parseInt(startStr!, 10)
        const e = Number.parseInt(endStr!, 10)
        const buffer = await this.getCachedRange(
          String(url),
          s,
          e - s + 1,
          init?.signal,
        )
        return new Response(buffer, { status: 206 })
      }
    }
    return super.fetch(url, init)
  }
}
