import { RemoteFile } from 'generic-filehandle2'

const MAX_CACHE_ENTRIES = 2000
const CHUNK_SIZE = 256 * 1024
const MAX_CONCURRENT = 20

let cache = new Map<string, Uint8Array>()
// File size is cached at the module level (keyed by URL), parallel to the chunk
// cache. Per-instance state can't be used: a cache-hit serving bytes from a
// previous instance's fetch would otherwise leave a new instance's stat() with
// no Content-Range observation, returning a bogus size of 0.
let sizeCache = new Map<string, number>()
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
  sizeCache = new Map<string, number>()
  // Reset concurrency state too. A leaked async fetch from a prior test that
  // resolves after clearCache will still decrement activeCount via its
  // .then/.catch handlers — so this can momentarily push activeCount negative,
  // which is harmless (runNext still allows new work) and self-corrects once
  // any leaked work has resolved.
  activeCount = 0
  queue.length = 0
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
          reject(err instanceof Error ? err : new Error(String(err)))
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
  async stat() {
    let size = sizeCache.get(this.url)
    if (size === undefined) {
      // Bypass the chunk cache: a populated chunk would otherwise short-circuit
      // fetchRange, leaving sizeCache empty. fetchRange always observes
      // Content-Range and updates sizeCache directly.
      await this.fetchRange(this.url, 0, 0)
      size = sizeCache.get(this.url)
    }
    if (size === undefined) {
      // Content-Range header wasn't observable (commonly CORS hiding it).
      // Throw rather than silently returning size: 0 — that lie tends to cause
      // downstream callers to issue zero-byte reads or treat the file as empty.
      // Callers that can degrade gracefully should wrap stat() in try/catch.
      throw new Error(
        `Could not determine size of ${this.url} (Content-Range header not observable; likely a CORS configuration issue)`,
      )
    }
    return { size }
  }

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
    if (res.status === 416) {
      // Range Not Satisfiable: requested range starts past end of file
      return new Uint8Array(0)
    }
    if (!res.ok) {
      const hint = ' (should be 206 for range requests)'
      const msg = `HTTP ${res.status} fetching ${url} bytes ${start}-${end}${res.status === 200 ? hint : ''}`
      throw Object.assign(new Error(msg), { status: res.status })
    }
    // Parse total file size from Content-Range (e.g. "bytes 0-255/12345"). Always
    // refresh the module-level sizeCache here, so any successful range fetch —
    // including those triggered by a leaked promise from a prior test — leaves
    // the cache in a consistent state for future stat() callers.
    if (!sizeCache.has(url)) {
      const contentRange = res.headers.get('content-range')
      const match = contentRange ? /\/(\d+)$/.exec(contentRange) : null
      if (match) {
        sizeCache.set(url, parseInt(match[1]!, 10))
      }
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

    // Pre-pass: if any already-cached chunk in [startChunk, endChunk) is
    // shorter than CHUNK_SIZE, the file ended within it. Chunks beyond that
    // point start past EOF — skip fetching them. This prevents @gmod/bam and
    // @gmod/tabix's fetchedSize() over-read of (1<<16) bytes past the last
    // bgzf block from triggering a 416 when the over-read crosses a chunk boundary.
    let effectiveEndChunk = endChunk
    for (let i = startChunk; i < endChunk; i++) {
      const c = getCached(cacheKey(url, i))
      if (c !== undefined && c.length < CHUNK_SIZE) {
        effectiveEndChunk = i
        break
      }
    }
    const chunkCount = effectiveEndChunk - startChunk + 1

    // Find contiguous runs of missing (uncached) chunks
    const runs: { start: number; end: number }[] = []
    for (let i = 0; i < chunkCount; i++) {
      if (!getCached(cacheKey(url, startChunk + i))) {
        const lastRun = runs[runs.length - 1]
        if (lastRun?.end === i - 1) {
          lastRun.end = i
        } else {
          runs.push({ start: i, end: i })
        }
      }
    }

    // Fetch each contiguous run as a single HTTP range request
    await Promise.all(
      runs.map(run =>
        limitConcurrency(async () => {
          const runStartChunk = startChunk + run.start
          const runEndChunk = startChunk + run.end
          const rangeStart = runStartChunk * CHUNK_SIZE
          const rangeEnd = (runEndChunk + 1) * CHUNK_SIZE - 1
          const data = await this.fetchRange(url, rangeStart, rangeEnd, signal)
          for (let i = run.start; i <= run.end; i++) {
            const offset = (i - run.start) * CHUNK_SIZE
            putCached(
              cacheKey(url, startChunk + i),
              data.subarray(offset, offset + CHUNK_SIZE),
            )
          }
        }),
      ),
    )

    // Assemble result from cached chunks
    const offsetInFirstChunk = start - startChunk * CHUNK_SIZE
    const result = new Uint8Array(length)
    let written = 0
    for (let i = 0; i < chunkCount; i++) {
      // Every chunk in [startChunk, effectiveEndChunk] is guaranteed cached
      // here: either it was already present (skipped by the runs loop) or it
      // was just fetched and putCached'd above.
      const chunk = getCached(cacheKey(url, startChunk + i))!
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
