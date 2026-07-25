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

function cacheKey(url: string, chunkIndex: number) {
  return `${url}:${chunkIndex}`
}

function getCached(key: string) {
  const chunk = cache.get(key)
  if (chunk !== undefined) {
    // Re-insert to move this key to the end of the Map's iteration order, which
    // is the end putCached evicts from. Without it eviction is FIFO by first
    // fetch, so a constantly-read chunk (bgzf header, bam index block) is
    // dropped as readily as a one-shot one.
    cache.delete(key)
    cache.set(key, chunk)
  }
  return chunk
}

function putCached(key: string, chunk: Uint8Array) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value
    if (oldestKey !== undefined) {
      cache.delete(oldestKey)
    }
  }
  cache.set(key, chunk)
}

export function clearCache() {
  cache = new Map<string, Uint8Array>()
  sizeCache = new Map<string, number>()
  // Reset concurrency state too. A leaked async fetch from a prior test that
  // resolves after clearCache will still decrement activeCount in its finally
  // block — so this can momentarily push activeCount negative, which is
  // harmless (runNext still allows new work) and self-corrects once any leaked
  // work has resolved.
  activeCount = 0
  queue.length = 0
}

function runNext() {
  if (queue.length > 0 && activeCount < MAX_CONCURRENT) {
    // claim the slot on behalf of the work we're about to resume
    activeCount++
    queue.shift()!()
  }
}

async function limitConcurrency<T>(fn: () => Promise<T>) {
  if (activeCount < MAX_CONCURRENT) {
    activeCount++
  } else {
    // runNext claims the slot before resuming us, so nothing to increment here
    await new Promise<void>(resolve => {
      queue.push(resolve)
    })
  }
  try {
    return await fn()
  } finally {
    activeCount--
    runNext()
  }
}

/**
 * Parse a `bytes=start-end` header into inclusive absolute offsets. Anything
 * else — an open-ended `bytes=100-`, a multi-range `bytes=0-9,20-29`, a
 * backwards range — yields undefined, and the caller passes the request
 * straight through uncached rather than honoring part of it.
 */
function parseByteRange(range: string | null) {
  const match = range ? /^bytes=(\d+)-(\d+)$/.exec(range) : null
  if (match) {
    const start = Number.parseInt(match[1]!, 10)
    const end = Number.parseInt(match[2]!, 10)
    return end < start ? undefined : { start, end }
  } else {
    return undefined
  }
}

/**
 * Copy the part of `chunk` — the CHUNK_SIZE-aligned block at `chunkIndex` —
 * that overlaps the absolute byte range [start, end) into `result`, whose byte
 * 0 is absolute position `start`. Every offset is computed from absolute
 * positions, so a short chunk (one the file ended inside) cannot shift where
 * later chunks land, which an accumulate-as-you-go copy does silently.
 */
function copyChunkInto({
  result,
  start,
  end,
  chunkIndex,
  chunk,
}: {
  result: Uint8Array
  start: number
  end: number
  chunkIndex: number
  chunk: Uint8Array
}) {
  const chunkStart = chunkIndex * CHUNK_SIZE
  const from = Math.max(start, chunkStart)
  const to = Math.min(end, chunkStart + chunk.length)
  if (to > from) {
    result.set(chunk.subarray(from - chunkStart, to - chunkStart), from - start)
  }
}

export class RemoteFileWithRangeCache extends RemoteFile {
  async stat() {
    if (!sizeCache.has(this.url)) {
      // Bypass the chunk cache: a populated chunk would otherwise short-circuit
      // fetchRange, leaving sizeCache empty. fetchRange always observes
      // Content-Range and updates sizeCache directly.
      await this.fetchRange(this.url, 0, 0)
    }
    const size = sizeCache.get(this.url)
    if (size === undefined) {
      // Content-Range header wasn't observable (commonly CORS hiding it).
      // Throw rather than silently returning size: 0 — that lie tends to cause
      // downstream callers to issue zero-byte reads or treat the file as empty.
      // Callers that can degrade gracefully should wrap stat() in try/catch.
      throw new Error(
        `Could not determine size of ${this.url} (Content-Range header not observable; likely a CORS configuration issue)`,
      )
    } else {
      return { size }
    }
  }

  private async fetchRange(
    url: string,
    start: number,
    end: number,
    init?: RequestInit,
  ) {
    // Preserve everything the caller put on the request — auth headers from an
    // internet account, credentials, the abort signal, RemoteFile.read's
    // buildRequest overrides — and replace only the range.
    const headers = new Headers(init?.headers)
    headers.set('range', `bytes=${start}-${end}`)
    const res = await super.fetch(url, { ...init, headers })
    if (res.status === 416) {
      // Range Not Satisfiable: requested range starts past end of file
      return new Uint8Array(0)
    }
    // A 200 means the server ignored the Range header and sent the whole file
    // (some servers do this rather than clamping a range whose end is past EOF).
    // The body then starts at byte 0, but callers slice it at the offsets they
    // asked for, so every chunk past the first would be filled with data from the
    // wrong position — silently, and typically surfacing much later as a parse
    // error like "invalid bgzf header". Only tolerate it when the request started
    // at 0, where the body genuinely covers the requested bytes. This mirrors
    // generic-filehandle2's RemoteFile.read, whose equivalent check this class
    // bypasses by synthesizing its own 206 Response in fetch() below.
    if (!res.ok || (res.status !== 206 && start !== 0)) {
      const hint =
        res.status === 200
          ? ' (the server ignored the Range header and returned the whole file; byte-range support is required for BAM/CRAM/tabix/bigwig files)'
          : ''
      const msg = `HTTP ${res.status} fetching ${url} bytes ${start}-${end}${hint}`
      throw Object.assign(new Error(msg), { status: res.status })
    }
    const buffer = new Uint8Array(await res.arrayBuffer())
    // Parse total file size from Content-Range (e.g. "bytes 0-255/12345"). Always
    // refresh the module-level sizeCache here, so any successful range fetch —
    // including those triggered by a leaked promise from a prior test — leaves
    // the cache in a consistent state for future stat() callers.
    if (!sizeCache.has(url)) {
      if (res.status === 200) {
        // no Content-Range on a 200, but the body is the entire file
        sizeCache.set(url, buffer.byteLength)
      } else {
        const contentRange = res.headers.get('content-range')
        const match = contentRange ? /\/(\d+)$/.exec(contentRange) : null
        if (match) {
          sizeCache.set(url, parseInt(match[1]!, 10))
        }
      }
    }
    return buffer
  }

  private async getCachedRange(
    url: string,
    start: number,
    length: number,
    init?: RequestInit,
  ) {
    // Clamp to a known file size. @gmod/bam and @gmod/tabix compute
    // fetchedSize() = maxv.blockPosition + (1<<16) - minv.blockPosition to
    // guarantee they read the complete final bgzf block, so their last read of
    // a file routinely extends past EOF; unclamped, that tail asks for chunks
    // starting past EOF and the server answers 416.
    const size = sizeCache.get(url)
    const end =
      size === undefined ? start + length : Math.min(start + length, size)
    const startChunk = Math.floor(start / CHUNK_SIZE)
    const lastChunk = Math.floor((end - 1) / CHUNK_SIZE)

    // Hold a strong reference to every chunk we'll assemble from. Already-cached
    // chunks are captured here (before any await); fetched ones as their run
    // resolves below. Assembly reads only from this local map, never from the
    // module-global cache: that cache is capped and shared across every file, so
    // a concurrent read's putCached can evict a chunk we depend on during our
    // fetch await, and a later getCached would return undefined. Holding the
    // reference locally makes eviction from the Map harmless.
    const chunks = new Map<number, Uint8Array>()

    // Plan the fetches: contiguous runs of missing chunks become one HTTP range
    // request each. Stops at a cached chunk shorter than CHUNK_SIZE — the file
    // ended inside it, so every later chunk starts past EOF. That covers the
    // over-read above even when the size is unknown (CORS hiding Content-Range).
    const runs: { start: number; end: number }[] = []
    let endChunk = lastChunk
    for (let i = startChunk; i <= lastChunk; i++) {
      const cached = getCached(cacheKey(url, i))
      if (cached === undefined) {
        const lastRun = runs.at(-1)
        if (lastRun?.end === i - 1) {
          lastRun.end = i
        } else {
          runs.push({ start: i, end: i })
        }
      } else {
        chunks.set(i, cached)
        if (cached.length < CHUNK_SIZE) {
          endChunk = i
          break
        }
      }
    }

    await Promise.all(
      runs.map(run =>
        limitConcurrency(async () => {
          const data = await this.fetchRange(
            url,
            run.start * CHUNK_SIZE,
            (run.end + 1) * CHUNK_SIZE - 1,
            init,
          )
          // A run crossing EOF comes back short: its last chunk with data is
          // short and any chunk past it is empty. Both are cached as-is, so a
          // later read sees the EOF marker instead of re-requesting past EOF.
          for (let i = run.start; i <= run.end; i++) {
            const offset = (i - run.start) * CHUNK_SIZE
            const chunk = data.subarray(offset, offset + CHUNK_SIZE)
            chunks.set(i, chunk)
            putCached(cacheKey(url, i), chunk)
          }
        }),
      ),
    )

    const result = new Uint8Array(Math.max(0, end - start))
    let dataEnd = end
    for (let i = startChunk; i <= endChunk; i++) {
      const chunk = chunks.get(i)
      // Unreachable: every index in [startChunk, endChunk] was either captured
      // as an already-cached chunk or filled by the run covering it. Throw
      // rather than assert so a future refactor that breaks the invariant fails
      // loudly instead of silently assembling a buffer of zeros.
      if (chunk === undefined) {
        throw new Error(
          `internal: chunk ${i} missing during range assembly of ${url}`,
        )
      } else {
        copyChunkInto({ result, start, end, chunkIndex: i, chunk })
        if (chunk.length < CHUNK_SIZE) {
          // the file ends inside this chunk, so nothing past that is real data
          dataEnd = Math.min(dataEnd, i * CHUNK_SIZE + chunk.length)
          break
        }
      }
    }
    // max(0) because a read wholly past EOF has dataEnd < start
    return result.subarray(0, Math.max(0, dataEnd - start))
  }

  // NOTE: range reads return a fully-assembled in-memory Response, so
  // generic-filehandle2's streaming `onProgress` (toBytesWithProgress) sees the
  // whole buffer at once and reports 0→100 instantly — per-byte download
  // progress does not flow through this layer. That's intentional: the indexed
  // parsers (@gmod/bam, cram, tabix, bbi) self-report at block granularity from
  // their index metadata, which is the meaningful unit and also reflects cache
  // hits. Only whole-file readFile (no range header → super.fetch below) streams
  // for real. Don't try to "restore" streaming progress here expecting it to
  // surface in the loading UI.
  public async fetch(
    url: string | RequestInfo,
    init?: RequestInit,
  ): Promise<Response> {
    // Only a string URL is cacheable: a Request object has no stable cache key
    // (String(request) is "[object Request]", which every Request shares) and
    // carries headers the range path would drop.
    if (typeof url === 'string') {
      const range = parseByteRange(new Headers(init?.headers).get('range'))
      if (range) {
        const buffer = await this.getCachedRange(
          url,
          range.start,
          range.end - range.start + 1,
          init,
        )
        return new Response(buffer, { status: 206 })
      }
    }
    return super.fetch(url, init)
  }
}
