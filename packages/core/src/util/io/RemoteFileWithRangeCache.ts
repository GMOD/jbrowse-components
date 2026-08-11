import { RemoteFile } from 'generic-filehandle2'

import type {
  FilehandleOptions,
  GenericFilehandle,
  ReadFileOptions,
  ReadFileTextOptions,
} from 'generic-filehandle2'

const CHUNK_SIZE = 256 * 1024

// Cached chunks own their bytes (see fetchRun), so this entry count is a true
// bound on retained memory: MAX_CACHE_ENTRIES * CHUNK_SIZE = 256 MB per module
// instance, and the main thread and each RPC worker have their own.
//
// It looks oversized and is not. Panning twelve windows of a 105 MB BAM and
// panning back issues *zero* requests on the second pass — a region @gmod/bam has
// already parsed never reaches this layer — and on that workload dropping this
// to 4 entries cost one extra range request and 1.3 MB. But that measurement was
// taken with @gmod/bam's parsed cache under its 1 GB budget, so it never evicted.
// On the data this browser is actually pointed at, it does: a single 1000x track
// panned across a 250 kb contig already peaks past that. Once the layer above is
// evicting, a re-read falls through to here, and this is the only thing between
// it and the network. Do not shrink it on the strength of a workload that stayed
// inside the parsed budget.
const MAX_CACHE_ENTRIES = 1000

// Drop a chunk nothing has read for fifteen minutes.
//
// Longer than the three minutes every parsed cache above uses (@gmod/bam,
// @gmod/cram, @gmod/tabix all take a cacheIdleTimeoutMs), and deliberately so:
// this is the cheap layer. Raw compressed bytes cost roughly an order of
// magnitude less per unit of genomic coverage than the parsed features above
// them, and they are what stands between a re-read and a re-download once those
// caches expire. Matching their three minutes meant expiring at the exact moment
// this became the only thing helping — measured, a reader who stepped away for
// four minutes re-downloaded all 73.5 MB of a pan.
//
// Fifteen rather than forever because forever is what this was, and what the
// whole sweep exists to end: 100 MB per worker, resident after the track closed,
// after the tab hid, and after four minutes idle.
const CACHE_IDLE_TIMEOUT_MS = 15 * 60 * 1000
// A quarter of the timeout, so the lag between a chunk going idle and being
// dropped is ~1.25x it rather than 2x.
//
// Chrome's intensive throttling of a hidden page — timers checked once a minute
// after five minutes hidden — does not reach this where it matters: workers are
// not throttled, and the workers are where the bytes are. On the main thread it
// costs some lag on a cache measured holding no chunks at all.
const SWEEP_INTERVAL_MS = CACHE_IDLE_TIMEOUT_MS / 4

const MAX_CONCURRENT = 20

interface ChunkRun {
  start: number
  end: number
}

interface PendingChunk {
  index: number
  chunk: Promise<Uint8Array>
}

// Reference count for one range request. The unit of *fetching* is a run of
// contiguous chunks covered by a single request, while the unit of *joining* is
// a chunk — so the count lives on the run, and every chunk it produced points
// back at it. The request is cancelled only once every reader interested in any
// of its chunks has given up.
interface RunState {
  // signals of the readers still waiting on this request
  signals: Set<AbortSignal>
  // true once a reader joins without a signal, which pins the request
  pinned: boolean
  // aborts when every reader has given up. what the request runs under
  controller: AbortController
  // aborted to take this run's listeners back off its readers' signals
  dispose: AbortController
  settled: boolean
}

interface InFlightChunk {
  chunk: Promise<Uint8Array>
  run: RunState
}

interface CacheEntry {
  bytes: Uint8Array
  // when a read last looked at this chunk, for sweepIdleCache. Per entry rather
  // than one timestamp for the whole cache: a session polling one small file
  // would otherwise keep every cold chunk of every other file alive with it.
  lastTouched: number
}

let cache = new Map<string, CacheEntry>()
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
  const entry = cache.get(key)
  if (entry !== undefined) {
    // Re-insert to move this key to the end of the Map's iteration order, which
    // is the end putCached evicts from. Without it eviction is FIFO by first
    // fetch, so a constantly-read chunk (bgzf header, bam index block) is
    // dropped as readily as a one-shot one.
    cache.delete(key)
    cache.set(key, entry)
    entry.lastTouched = Date.now()
  }
  return entry?.bytes
}

function putCached(key: string, chunk: Uint8Array) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value
    if (oldestKey !== undefined) {
      cache.delete(oldestKey)
    }
  }
  cache.set(key, { bytes: chunk, lastTouched: Date.now() })
  startSweep()
}

let sweepTimer: ReturnType<typeof setInterval> | undefined

/**
 * `unref` the sweep timer where it exists.
 *
 * Duck-typed rather than cast because `setInterval` returns a number in the
 * browser and a `Timeout` under node, and this module runs in both. Under jest
 * it is the difference between the suite exiting and "a worker process has
 * failed to exit gracefully".
 */
function unrefIfPossible(timer: unknown) {
  if (
    typeof timer === 'object' &&
    timer !== null &&
    'unref' in timer &&
    typeof timer.unref === 'function'
  ) {
    timer.unref()
  }
}

/**
 * Drop every chunk no read has touched for {@link CACHE_IDLE_TIMEOUT_MS}.
 *
 * Safe to call at any moment, including mid-fetch, and that is not an accident:
 * `getCachedRange` holds a strong local reference to every chunk it will
 * assemble from before its first await, precisely so that eviction underneath it
 * is harmless. A chunk dropped here that somebody still wants is re-fetched.
 *
 * Deliberately narrower than {@link clearCache}: it touches neither `inFlight`
 * nor `queue`, whose entries are by definition active, and it keeps `sizeCache`,
 * which is one number per URL and costs a round trip to re-derive.
 *
 * Exported so a caller can reclaim on its own schedule — a tab going hidden,
 * say — rather than only on the interval. The interval is what makes this work
 * for the case it exists for, though: an idle consumer is calling nothing, so a
 * lazy check inside `getCached` would never fire for exactly the reader who has
 * walked away.
 */
export function sweepIdleCache() {
  const cutoff = Date.now() - CACHE_IDLE_TIMEOUT_MS
  for (const [key, entry] of cache) {
    if (entry.lastTouched <= cutoff) {
      cache.delete(key)
    }
  }
  if (cache.size === 0) {
    stopSweep()
  }
}

// Costs nothing while the cache is empty: the timer starts with the first chunk
// and the sweep that empties the cache stops it again.
function startSweep() {
  if (sweepTimer === undefined) {
    sweepTimer = setInterval(sweepIdleCache, SWEEP_INTERVAL_MS)
    unrefIfPossible(sweepTimer)
  }
}

function stopSweep() {
  if (sweepTimer !== undefined) {
    clearInterval(sweepTimer)
    sweepTimer = undefined
  }
}

export function clearCache() {
  cache = new Map<string, CacheEntry>()
  sizeCache = new Map<string, number>()
  // the new cache is empty, so nothing is left for the sweep to find; putCached
  // starts it again with the next chunk
  stopSweep()
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
  const waiters = queue.splice(0)
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

  private getCachedRange(
    url: string,
    start: number,
    length: number,
    init?: RequestInit,
  ) {
    return getCachedRange(url, start, length, init, (s, e, runInit) =>
      this.fetchRange(url, s, e, runInit),
    )
  }

  /**
   * Bytes for a byte range, straight out of the chunk cache.
   *
   * `RemoteFile.read` would build the range header, call {@link fetch}, and
   * unwrap the `Response` it got back. Every one of those steps is a copy of
   * the whole range, and on a cache hit there is no network for them to hide
   * behind: measured warm, with the chunk cache fully populated, the
   * `Response` round trip was **69-77%** of the read (6.15ms vs 1.90ms at
   * 16MB, 0.36ms vs 0.08ms at 256KB).
   *
   * `fetch` below still caches, so anything that reaches this class by that
   * route — a caller setting its own range header — is unaffected. This is
   * the same cache, entered one layer lower.
   */
  override async read(
    length: number,
    position: number,
    opts: FilehandleOptions = {},
  ): Promise<Uint8Array<ArrayBuffer>> {
    // mirrors RemoteFile.read's guards, which we no longer go through
    if (length === 0) {
      return new Uint8Array(0)
    }
    if (Number.isNaN(length) || Number.isNaN(position)) {
      throw new TypeError(
        `read() called with NaN length or position (length=${length}, position=${position}). The index file may be corrupt.`,
      )
    }
    const bytes = await this.getCachedRange(this.url, position, length, {
      ...(opts.signal ? { signal: opts.signal } : {}),
      headers: opts.headers,
      ...opts.overrides,
    })
    return bytes
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

/**
 * The same chunk cache, in front of any filehandle.
 *
 * `RemoteFileWithRangeCache` gets its cache by *being* a `RemoteFile`, so for
 * as long as that was the only entry point, local paths and blobs got no
 * caching at all — `openLocation` handed back a bare `LocalFile`/`BlobFile` and
 * every read went to disk. Nothing in the cache is about HTTP, so this wraps
 * whatever it is given instead.
 *
 * `key` namespaces this file's chunks in the module-global cache, so it has to
 * identify the underlying bytes: a path or a URL for something with a stable
 * name, and something instance-unique for a Blob, which has no name to key on.
 * Two wrappers sharing a key share chunks, which is right for two handles on
 * one path and wrong for two unrelated blobs.
 */
export class CachedFilehandle implements GenericFilehandle {
  constructor(
    private inner: GenericFilehandle,
    private key: string,
  ) {}

  async read(
    length: number,
    position: number,
    opts: FilehandleOptions = {},
  ): Promise<Uint8Array<ArrayBuffer>> {
    if (length === 0) {
      return new Uint8Array(0)
    }
    if (Number.isNaN(length) || Number.isNaN(position)) {
      throw new TypeError(
        `read() called with NaN length or position (length=${length}, position=${position}). The index file may be corrupt.`,
      )
    }
    const bytes = await getCachedRange(
      this.key,
      position,
      length,
      opts.signal ? { signal: opts.signal } : undefined,
      (start, end, init) =>
        this.inner.read(end - start + 1, start, {
          ...(init?.signal ? { signal: init.signal } : {}),
        }),
    )
    return bytes
  }

  // Whole-file reads bypass the chunk cache: they are one pass over bytes the
  // caller is about to hold in full anyway, so chunking them would double the
  // peak for no reuse. This is what `RemoteFile.readFile` does too.
  readFile(options?: ReadFileOptions): Promise<Uint8Array<ArrayBuffer>>
  readFile(options: ReadFileTextOptions): Promise<string>
  readFile(
    options?: ReadFileOptions | ReadFileTextOptions,
  ): Promise<Uint8Array<ArrayBuffer> | string> {
    return this.inner.readFile(options as ReadFileOptions)
  }

  async stat() {
    const stats = await this.inner.stat()
    // lets getCachedRange clamp reads that run past EOF, which every bgzf
    // reader does by construction on its last block
    sizeCache.set(this.key, stats.size)
    return stats
  }

  close() {
    return this.inner.close()
  }
}

/**
 * Fetches an inclusive byte range `[start, end]`, however the underlying source
 * does that. The one thing the chunk cache below needs from a file.
 */
type FetchByteRange = (
  start: number,
  end: number,
  init?: RequestInit,
) => Promise<Uint8Array>

/**
 * The chunk machinery, as free functions over a `FetchByteRange`.
 *
 * It was written as private methods on the HTTP class, but none of it is about
 * HTTP: it is chunk indexing, an LRU, in-flight de-duplication and abort
 * reference counting over byte ranges. Lifting it out is what lets the same
 * cache sit in front of a local file or a Blob, which previously got no caching
 * at all — see {@link CachedFilehandle}.
 */
function fetchRun(
  key: string,
  run: ChunkRun,
  init: RequestInit | undefined,
  doFetch: FetchByteRange,
) {
  const state: RunState = {
    signals: new Set(),
    pinned: false,
    controller: new AbortController(),
    dispose: new AbortController(),
    settled: false,
  }
  // The request runs under the run's own signal, not the opening reader's: it
  // is shared, so it must outlive any one reader giving up. joinRun registers
  // them, starting with the reader that opened it.
  const data = limitConcurrency(() =>
    doFetch(run.start * CHUNK_SIZE, (run.end + 1) * CHUNK_SIZE - 1, {
      ...init,
      signal: state.controller.signal,
    }),
  )
  joinRun(state, init?.signal)
  const settle = () => {
    state.settled = true
    // nothing reads these once the request has settled, and holding them
    // would pin each reader's AbortController behind this run
    state.dispose.abort()
    state.signals.clear()
  }
  data.then(settle, settle)
  const pending: PendingChunk[] = []
  for (let index = run.start; index <= run.end; index++) {
    const chunkKey = cacheKey(key, index)
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
      putCached(chunkKey, copy)
      return copy
    })
    const entry = { chunk, run: state }
    inFlight.set(chunkKey, entry)
    const forget = () => {
      // only if still the owner: clearCache, or a later run for the same
      // chunk, may have replaced this entry
      if (inFlight.get(chunkKey) === entry) {
        inFlight.delete(chunkKey)
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
 * Register a reader's interest in a run, so its request survives until that
 * reader has given up too.
 *
 * A reader with **no signal cannot give up**, so it pins the run: there is no
 * longer any set of aborts that should stop it. That is the honest reading of
 * a caller that never asked to be cancellable, and it means one signal-free
 * read makes that request uncancellable for everyone sharing it.
 */
function joinRun(state: RunState, signal: RequestInit['signal']) {
  if (!signal) {
    state.pinned = true
  } else if (signal.aborted) {
    // A reader that has already given up is not a waiter, and must not be
    // counted as one: an `abort` listener never fires on a signal that
    // aborted before it was added, so nothing would ever take this signal
    // back out of the set. The count would never reach zero and the request
    // would be uncancellable for everyone sharing it, silently.
    //
    // `getCachedRange` rejects such a reader before it gets here, so this is
    // the belt to that braces — the invariant is too quiet to fail to be left
    // resting on a check several frames away.
    if (!state.pinned && state.signals.size === 0) {
      state.controller.abort(signal.reason)
    }
  } else if (!state.signals.has(signal)) {
    // guarded so one signal joining twice — a read spanning several chunks of
    // the same run — does not add two listeners
    state.signals.add(signal)
    signal.addEventListener(
      'abort',
      () => {
        state.signals.delete(signal)
        if (!state.pinned && state.signals.size === 0) {
          state.controller.abort(signal.reason)
        }
      },
      // `once` covers the abort firing; `dispose` covers it never firing
      { once: true, signal: state.dispose.signal },
    )
  }
}

/**
 * Await a chunk fetch another read already had in flight.
 *
 * Sharing one fetch between reads is what makes a row of adjacent genomic
 * blocks cheap. It used to mean another reader's `AbortSignal` could reject a
 * chunk this read still needed, which was handled by re-issuing the fetch —
 * correct, but it threw away a 256 KiB request that was already in flight and
 * that somebody still wanted. Joining the run's reference count instead means
 * the request is simply not cancelled while anyone is still waiting on it, so
 * there is nothing to re-issue. `@gmod/bam` and `@gmod/cram` do the same at
 * their own cache layers.
 */
function joinChunk(flight: InFlightChunk, init?: RequestInit) {
  // a settled run has dropped its abort listeners, so joining it would add a
  // signal nothing will ever take back out
  if (!flight.run.settled) {
    joinRun(flight.run, init?.signal)
  }
  return flight.chunk
}

async function getCachedRange(
  key: string,
  start: number,
  length: number,
  init: RequestInit | undefined,
  doFetch: FetchByteRange,
) {
  // A read whose caller has already given up must not join, or even open, a
  // request. On a pan the abort routinely lands while the index is still
  // being read — nothing between there and here looks at the signal — so a
  // whole batch of reads arrives already cancelled, and letting them through
  // both wastes the fetch and poisons the reference count (see joinRun).
  init?.signal?.throwIfAborted()
  // Clamp to a known file size. @gmod/bam and @gmod/tabix compute
  // fetchedSize() = maxv.blockPosition + (1<<16) - minv.blockPosition to
  // guarantee they read the complete final bgzf block, so their last read of
  // a file routinely extends past EOF; unclamped, that tail asks for chunks
  // starting past EOF and the server answers 416.
  const size = sizeCache.get(key)
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
    const chunkKey = cacheKey(key, index)
    const cached = getCached(chunkKey)
    if (cached === undefined) {
      const flight = inFlight.get(chunkKey)
      if (flight === undefined) {
        const lastRun = runs.at(-1)
        if (lastRun?.end === index - 1) {
          lastRun.end = index
        } else {
          runs.push({ start: index, end: index })
        }
      } else {
        pending.push({ index, chunk: joinChunk(flight, init) })
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
    pending.push(...fetchRun(key, run, init, doFetch))
  }

  await Promise.all(
    pending.map(async ({ index, chunk }) => {
      chunks.set(index, await chunk)
    }),
  )
  // The bytes arrived, but this read gave up while waiting for them — the
  // request it was sharing kept going because somebody else still wanted it.
  // Cancellation is per-reader even though the fetch is not.
  init?.signal?.throwIfAborted()

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
        `internal: chunk ${i} missing during range assembly of ${key}`,
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
