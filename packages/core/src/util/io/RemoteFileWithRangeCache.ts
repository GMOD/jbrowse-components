import { RemoteFile } from 'generic-filehandle2'

const CHUNK_SIZE = 256 * 1024
// Cached chunks own their bytes (see fetchRun), so this entry count is a true
// bound on retained memory: MAX_CACHE_ENTRIES * CHUNK_SIZE = 256 MB per module
// instance, and the main thread and each RPC worker have their own.
const MAX_CACHE_ENTRIES = 1000
const MAX_CONCURRENT = 20

interface ChunkRun {
  start: number
  end: number
}

interface PendingChunk {
  index: number
  chunk: Promise<Uint8Array>
}

interface InFlightChunk {
  chunk: Promise<Uint8Array>
  // the signal of the read that opened this fetch, so a joiner can tell that
  // read's cancellation apart from a real failure. Typed off RequestInit, which
  // is where it comes from and which admits an explicit null.
  signal: RequestInit['signal']
}

let cache = new Map<string, Uint8Array>()
// File size is cached at the module level (keyed by URL), parallel to the chunk
// cache. Per-instance state can't be used: a cache-hit serving bytes from a
// previous instance's fetch would otherwise leave a new instance's stat() with
// no Content-Range observation, returning a bogus size of 0.
let sizeCache = new Map<string, number>()
// Chunk fetches in progress, keyed like `cache`. A read that needs a chunk
// another read is already fetching awaits that promise rather than requesting
// the same bytes again: concurrent reads over adjacent genomic blocks routinely
// land in one 256 KiB chunk, and each duplicate also burns one of the
// MAX_CONCURRENT slots. A failed fetch rejects every waiter, which is what each
// would have gotten on its own — except for a *cancellation*, which belongs to
// the reader that issued it and says nothing about anyone joined to its fetch.
// That is why the owning signal is recorded here; see joinChunk.
let inFlight = new Map<string, InFlightChunk>()
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
  // A leaked fetch that settles after this still removes its own entry from the
  // new map only if it is still the owner, so dropping the old map is safe.
  inFlight = new Map<string, InFlightChunk>()
  // Reset concurrency state too. A leaked async fetch from a prior test that
  // resolves after clearCache will still decrement activeCount in its finally
  // block — so this can momentarily push activeCount negative, which is
  // harmless (runNext still allows new work) and self-corrects once any leaked
  // work has resolved.
  //
  // Queued waiters are RESUMED, not dropped: a dropped resolver strands its
  // limitConcurrency caller with no resolve and no reject, so the read neither
  // runs nor settles — a hang rather than a cancellation. Each resumed waiter
  // claims a slot the way runNext would and releases it in its own finally.
  const waiters = queue.splice(0, queue.length)
  activeCount = waiters.length
  for (const resolve of waiters) {
    resolve()
  }
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
      // Content-Range and updates sizeCache directly. Still goes through
      // limitConcurrency — a stat is a real request against the same server,
      // and N tracks opening at once used to issue N stats outside the cap.
      await limitConcurrency(() => this.fetchRange(this.url, 0, 0))
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
    // Parse total file size from Content-Range (e.g. "bytes 0-255/12345"). The
    // first successful range fetch populates the module-level sizeCache, so a
    // later stat() needs no HEAD of its own; an already-known size is left
    // alone (the file is not expected to change under us mid-session).
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

  /**
   * Fetch one contiguous run of missing chunks as a single range request, and
   * publish a promise for each of its chunks. Publication is synchronous —
   * before the request is awaited — so a read planned while this is in flight
   * awaits these chunks instead of asking for the same bytes again.
   */
  private fetchRun(url: string, run: ChunkRun, init?: RequestInit) {
    const data = limitConcurrency(() =>
      this.fetchRange(
        url,
        run.start * CHUNK_SIZE,
        (run.end + 1) * CHUNK_SIZE - 1,
        init,
      ),
    )
    const pending: PendingChunk[] = []
    for (let index = run.start; index <= run.end; index++) {
      const key = cacheKey(url, index)
      const offset = (index - run.start) * CHUNK_SIZE
      // A run crossing EOF comes back short: its last chunk with data is short
      // and any chunk past that is empty. Both are cached as-is, so a later read
      // sees the EOF marker instead of re-requesting past EOF.
      //
      // slice, not subarray: a view would keep the whole run buffer alive for as
      // long as any one of its chunks stays cached, so evicting a chunk would
      // free nothing and MAX_CACHE_ENTRIES would bound nothing.
      const chunk = data.then(buffer => {
        const copy = buffer.slice(offset, offset + CHUNK_SIZE)
        putCached(key, copy)
        return copy
      })
      const entry = { chunk, signal: init?.signal }
      inFlight.set(key, entry)
      const forget = () => {
        // only if still the owner: clearCache, or a later run for the same
        // chunk, may have replaced this entry
        if (inFlight.get(key) === entry) {
          inFlight.delete(key)
        }
      }
      // runs after the putCached above, so a chunk is never absent from both the
      // cache and this map
      void chunk.then(forget, forget)
      pending.push({ index, chunk })
    }
    return pending
  }

  /**
   * Await a chunk fetch another read already had in flight, and re-issue it if
   * that read was canceled out from under us.
   *
   * Sharing one fetch between reads is what makes a row of adjacent genomic
   * blocks cheap, but it also means another reader's `AbortSignal` can reject a
   * chunk this read still needs — a failure that says nothing about this read.
   * Our own abort, and every other error, propagates untouched. `@gmod/bam`
   * applies the same retry to its own chunk cache one layer up.
   *
   * Retried exactly once, then propagated: the re-issue prefers the cache or a
   * live sibling, and bounding it means the pathological case is one duplicate
   * 256 KiB fetch *per joined chunk* — this runs once per chunk, so a read that
   * joined N chunks of a cancelled owner can re-issue N of them — rather than a
   * recursion whose depth depends on how the aborts interleave.
   */
  private async joinChunk(
    url: string,
    index: number,
    flight: InFlightChunk,
    init?: RequestInit,
  ) {
    try {
      return await flight.chunk
    } catch (e) {
      if (flight.signal?.aborted !== true || init?.signal?.aborted === true) {
        throw e
      }
      // a sibling joiner may have re-opened this chunk already; its owner is a
      // live reader in every case but another interleaved abort, which is what
      // the single-retry bound covers
      const key = cacheKey(url, index)
      const cached = getCached(key)
      const sibling = inFlight.get(key)
      return cached === undefined
        ? sibling !== undefined && sibling !== flight
          ? sibling.chunk
          : this.fetchRun(url, { start: index, end: index }, init)[0]!.chunk
        : cached
    }
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

    // Plan the fetches. Contiguous runs of missing chunks become one range
    // request each; a chunk another read is already fetching is awaited instead.
    // Planning and publishing run to completion without an await, so two reads
    // in the same tick can't both open a run for the same chunk.
    //
    // Stops at a cached chunk shorter than CHUNK_SIZE — the file ended inside it,
    // so every later chunk starts past EOF. That covers the over-read above even
    // when the size is unknown (CORS hiding Content-Range).
    const pending: PendingChunk[] = []
    const runs: ChunkRun[] = []
    let endChunk = lastChunk
    for (let index = startChunk; index <= lastChunk; index++) {
      const key = cacheKey(url, index)
      const cached = getCached(key)
      if (cached === undefined) {
        const flight = inFlight.get(key)
        if (flight === undefined) {
          const lastRun = runs.at(-1)
          if (lastRun?.end === index - 1) {
            lastRun.end = index
          } else {
            runs.push({ start: index, end: index })
          }
        } else {
          pending.push({
            index,
            chunk: this.joinChunk(url, index, flight, init),
          })
        }
      } else {
        chunks.set(index, cached)
        if (cached.length < CHUNK_SIZE) {
          endChunk = index
          break
        }
      }
    }
    for (const run of runs) {
      pending.push(...this.fetchRun(url, run, init))
    }

    await Promise.all(
      pending.map(async ({ index, chunk }) => {
        chunks.set(index, await chunk)
      }),
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
