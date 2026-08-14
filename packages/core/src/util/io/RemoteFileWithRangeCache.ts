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
  // Delete before the size check, so that re-caching a key already present
  // neither evicts an innocent entry to make room for one already counted nor
  // leaves it at the rank it held before — `Map.set` on an existing key keeps
  // its position, so without this a chunk that was evicted and re-fetched goes
  // straight back to being first in line to be evicted again.
  cache.delete(key)
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

// ---------------------------------------------------------------------------
// Failing legibly.
//
// The status path was already the good example here — the 416, the "server
// ignored the Range header" hint, the Content-Range note stat() throws — and
// the two gaps it left were the request that gets no status at all and the
// request that gets no answer at all. Everything down to parseByteRange is
// about those two.
//
// Deliberately no retry: a failed range read surfaces as an error and the
// reader decides, using the Retry the display's error chrome already offers.
// ---------------------------------------------------------------------------

// How long a range request may go without the server beginning to answer.
//
// This bounds the wait for a RESPONSE, not for the bytes: `fetch` resolves when
// the response headers arrive, and the deadline is cleared there, before a byte
// of the body is read. That distinction is load-bearing rather than fussy,
// because this layer makes range requests unusually large — a contiguous run of
// missing chunks becomes one request, measured at 6.5 MiB for a single 4 kb
// viewport over a 2000x BAM (agent-docs/reference/NETWORK_ABORT.md). A deadline
// over the whole transfer would cut that read off on any link slower than about
// 2 Mbps, turning a slow session into a broken one.
//
// What it does catch is the one failure that produces no error at all: a
// connection that is open and silent. Nothing is wrong from the display's point
// of view — `loading` is true and a fetch really is in flight — so the reader
// gets a spinner that never resolves and never the error bar whose Retry button
// is the way out. Thirty seconds is deliberately generous; a server that has not
// begun to answer by then is not about to.
//
// Only the HTTP path carries one. `CachedFilehandle` wraps a local file or a
// Blob, which return or throw; there is no socket there to sit open on.
const RESPONSE_TIMEOUT_MS = 30_000

/**
 * One signal that aborts when either of two do.
 *
 * `AbortSignal.any` where it exists — Chrome 116, Firefox 124, Safari 17.4, so
 * comfortably inside the `last 1 chrome version` browserslist both products
 * build against, and present in the jsdom the tests run under. The manual
 * composition stays behind a feature test rather than being deleted because
 * `@jbrowse/core` is published for embedders who set their own targets, where a
 * missing static would be a TypeError on every range request.
 */
function anySignal(a: AbortSignal, b: AbortSignal) {
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([a, b])
  }
  const composed = new AbortController()
  for (const source of [a, b]) {
    if (source.aborted) {
      composed.abort(source.reason)
    } else {
      source.addEventListener(
        'abort',
        () => {
          composed.abort(source.reason)
        },
        { once: true },
      )
    }
  }
  return composed.signal
}

interface ResponseDeadline {
  /** what to hand `fetch`: the caller's signal and this deadline, composed */
  signal: AbortSignal
  /** the error to report, set once the deadline has fired */
  expired?: Error
  /** stop the clock; call as soon as a response arrives */
  dispose: () => void
}

/**
 * `signal`, plus a {@link RESPONSE_TIMEOUT_MS} deadline on the server beginning
 * to answer, and the disposer that stops that clock.
 *
 * **The caller's signal is composed, never replaced.** It is what carries the
 * stop token down to the socket (agent-docs/reference/NETWORK_ABORT.md) and what
 * the run's reference count aborts once every reader has given up; handing
 * `fetch` a deadline signal in its place would silently take cancellation back
 * off the socket, which is worth ~6.5 MiB per cancelled navigation.
 *
 * `describe` is a thunk so nothing builds the message unless the deadline fires.
 */
function withResponseDeadline(
  signal: AbortSignal | null | undefined,
  describe: () => string,
) {
  const timeout = new AbortController()
  const deadline: ResponseDeadline = {
    signal: signal ? anySignal(signal, timeout.signal) : timeout.signal,
    dispose: () => {},
  }
  const timer = setTimeout(() => {
    deadline.expired = new Error(describe())
    timeout.abort(deadline.expired)
  }, RESPONSE_TIMEOUT_MS)
  // a deadline still pending must not hold a node process (or a jest worker)
  // open, same reasoning as the sweep interval above
  unrefIfPossible(timer)
  deadline.dispose = () => {
    clearTimeout(timer)
  }
  return deadline
}

/**
 * Whether a rejection is a network-level one — the request never reached a
 * response, so there is no status and no headers, only a `TypeError`.
 *
 * Checked down the `cause` chain rather than on the rejection itself, because
 * `RemoteFile.fetch` catches that TypeError first and rethrows
 * `new Error(`${message} fetching ${url}`, { cause: e })` (and, on Chrome's
 * exact "Failed to fetch" wording, retries once through the cache to work around
 * a Chrome CORS-cache bug). By the time it gets here the class is gone and the
 * chain is the only thing that still says what it was. Depth-bounded because a
 * cause chain is not guaranteed acyclic.
 */
function isNetworkRejection(e: unknown) {
  let cause = e
  for (let depth = 0; depth < 5 && cause instanceof Error; depth++) {
    if (cause instanceof TypeError) {
      return true
    }
    cause = cause.cause
  }
  return false
}

/**
 * A https page may not load a http file, and the browser blocks it before it is
 * sent — one of the two causes of a bare network rejection that is checkable
 * from inside the page.
 */
function isMixedContent(url: string) {
  if (typeof location === 'undefined' || location.protocol !== 'https:') {
    return false
  }
  try {
    return new URL(url, location.href).protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * What to tell someone whose request never reached a response.
 *
 * A CORS denial, a mixed-content block, a DNS failure, a refused connection and
 * an offline browser all arrive as the same bare TypeError — `Failed to fetch`
 * in Chrome, `Load failed` in Safari, `NetworkError when attempting to fetch
 * resource` in Firefox — with no status, no headers and no URL. The browser
 * withholds the difference deliberately, since an error that named the cause
 * would itself be a cross-origin read. So this names the two that are checkable
 * from here and then the one that is left, which is also the one that is nearly
 * always right for a genome file on someone else's server.
 */
function networkFailureHint(url: string) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return ' (the browser reports no network connection)'
  } else if (isMixedContent(url)) {
    return ' (a page served over https may not load a file served over http, and the browser blocked this before it left; the file has to be served over https too)'
  } else {
    return ' (no response at all, so there is no status to report — most often CORS: the server must send Access-Control-Allow-Origin, and Access-Control-Expose-Headers: Content-Range as well or the size of the file cannot be read either. A host that is down, a DNS failure and a blocked port look identical from here)'
  }
}

/**
 * What a reader can do about a status, appended to the message carrying it.
 * Only for the statuses where there is something to say; anything else gets the
 * number, the URL and the byte range, which is already more than `fetch` gives.
 */
function statusHint(status: number) {
  if (status === 200) {
    return ' (the server ignored the Range header and returned the whole file; byte-range support is required for BAM/CRAM/tabix/bigwig files)'
  } else if (status === 401 || status === 403) {
    return ' (the file is there and the request was refused; a signed URL may have expired, or a bucket policy may not grant read to the page origin)'
  } else if (status === 404) {
    return ' (no such file; check the URL, and that the index file sits where the adapter expects it alongside the data file)'
  } else if (status === 429 || status >= 500) {
    return ' (the server is failing or declining to serve this file just now; nothing is retried automatically, so try again once it recovers)'
  } else {
    return ''
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
 * `RemoteFile.read`'s NaN guard, which neither reader in this module reaches any
 * more: both enter the chunk cache below that method. A NaN length arrives from
 * a corrupt index and would otherwise become a `bytes=NaN-NaN` request.
 */
function assertReadArgs(key: string, length: number, position: number) {
  if (Number.isNaN(length) || Number.isNaN(position)) {
    throw new TypeError(
      `read() of ${key} called with NaN length or position (length=${length}, position=${position}); the index the offset came from is probably corrupt or truncated`,
    )
  }
}

/**
 * Record a size a filehandle learned some way other than a range request — a
 * `stat` the underlying source answers directly, or one a subclass gets from a
 * metadata endpoint. Authoritative, so unlike the Content-Range observation
 * below it overwrites what is already there.
 *
 * Guarded on finiteness because a non-finite size does not fail, it *poisons*:
 * `Math.min(start + length, NaN)` is NaN, so getCachedRange's chunk loop never
 * runs and every later read of that file returns empty with nothing said. Drive
 * populates `size` only for files that have one — not for folders, shortcuts or
 * native editor documents — so `Number(undefined)` is a reachable input rather
 * than a hypothetical.
 */
function recordSize(key: string, size: number) {
  if (Number.isFinite(size)) {
    sizeCache.set(key, size)
  }
}

/**
 * Record a file's total size from a `Content-Range` header — `bytes 0-255/12345`
 * on a 206, `bytes * /12345` on a 416. An already-known size is left alone (the
 * file is not expected to change under us mid-session).
 */
function recordSizeFromContentRange(url: string, res: Response) {
  if (!sizeCache.has(url)) {
    const contentRange = res.headers.get('content-range')
    const match = contentRange ? /\/(\d+)$/.exec(contentRange) : null
    if (match) {
      sizeCache.set(url, Number.parseInt(match[1]!, 10))
    }
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
  /**
   * Publish a size this handle learned other than by a range request.
   *
   * A subclass that overrides `stat` answers from somewhere the chunk cache
   * never sees — GoogleDriveFile reads Drive's metadata endpoint — and so leaves
   * `sizeCache` empty for its URL however many times it is called. That clamp is
   * not an optimization: @gmod/bam and @gmod/tabix compute their last read of a
   * file to include the whole final bgzf block, so it runs past EOF by
   * construction, and without a known size that tail asks for chunks starting
   * past the end and the server answers 416.
   */
  protected recordSize(size: number) {
    recordSize(this.url, size)
  }

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
      //
      // The request itself succeeded, so this is the one CORS misconfiguration
      // that is invisible from the network tab: the header is on the wire and
      // the browser will not let the page read it. Name the header to add.
      throw new Error(
        `Could not determine size of ${this.url} (the server answered but the Content-Range header was not readable; a cross-origin server has to send Access-Control-Expose-Headers: Content-Range before the browser will show it to the page)`,
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
    // Deliberately here rather than a layer up: this call is the shared one.
    // fetchRun coalesces every reader of these chunks onto it, so the deadline
    // belongs to the request and fails all of them together — one stalled
    // reader with a deadline of its own would strand the rest on a fetch nobody
    // is watching any more.
    const deadline = withResponseDeadline(
      init?.signal,
      () =>
        `No response from ${url} for bytes ${start}-${end} after ${RESPONSE_TIMEOUT_MS / 1000}s (the connection was open and the server sent nothing; a transfer already under way is not subject to this limit, so this is a stalled request rather than a slow one)`,
    )
    let res: Response
    try {
      res = await super.fetch(url, {
        ...init,
        headers,
        signal: deadline.signal,
      })
    } catch (e) {
      if (deadline.expired) {
        throw deadline.expired
      } else if (isNetworkRejection(e) && !deadline.signal.aborted) {
        // `!aborted` because an implementation that reports a cancellation as a
        // TypeError rather than as the signal's reason would otherwise have a
        // cancelled pan explained as a CORS misconfiguration, which is the worst
        // place to be confidently wrong.
        throw new Error(
          `Network error fetching ${url} bytes ${start}-${end}${networkFailureHint(url)}`,
          { cause: e },
        )
      } else {
        throw e
      }
    } finally {
      // either the response is here or the request is over; from here the body
      // may take as long as it takes
      deadline.dispose()
    }
    if (res.status === 416) {
      // Range Not Satisfiable: requested range starts past end of file. RFC 9110
      // has the server report the real length here, as `bytes * /12345`, and
      // that is the one thing this response carries worth keeping: learning the
      // size lets getCachedRange clamp every later over-read instead of asking
      // for past-EOF chunks and being refused again. It is also the only way
      // stat() can answer for an empty file, every range of which is
      // unsatisfiable.
      recordSizeFromContentRange(url, res)
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
      const msg = `HTTP ${res.status} fetching ${url} bytes ${start}-${end}${statusHint(res.status)}`
      throw Object.assign(new Error(msg), { status: res.status })
    }
    const buffer = new Uint8Array(await res.arrayBuffer())
    // The first successful range fetch populates the module-level sizeCache, so
    // a later stat() needs no HEAD of its own.
    if (res.status === 200) {
      // no Content-Range on a 200, but the body is the entire file
      if (!sizeCache.has(url)) {
        sizeCache.set(url, buffer.byteLength)
      }
    } else {
      recordSizeFromContentRange(url, res)
    }
    return buffer
  }

  // named apart from the module-level getCachedRange it calls, which is the one
  // doing the work; this only binds it to this instance's fetch
  private cachedRange(
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
    assertReadArgs(this.url, length, position)
    return this.cachedRange(this.url, position, length, {
      ...(opts.signal ? { signal: opts.signal } : {}),
      headers: opts.headers,
      ...opts.overrides,
    })
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
        const buffer = await this.cachedRange(
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
    assertReadArgs(this.key, length, position)
    return getCachedRange(
      this.key,
      position,
      length,
      opts.signal ? { signal: opts.signal } : undefined,
      (start, end, init) =>
        this.inner.read(end - start + 1, start, {
          ...(init?.signal ? { signal: init.signal } : {}),
        }),
    )
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
    recordSize(this.key, stats.size)
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
 *
 * Returns undefined when the run is not joinable, and the caller fetches the
 * chunk itself instead.
 */
function joinChunk(flight: InFlightChunk, init?: RequestInit) {
  if (flight.run.controller.signal.aborted) {
    // Every reader of this run gave up, so its request was cancelled — but the
    // rejection takes a tick to arrive and the entry is not removed until after
    // that, so in between it sits here looking joinable. Joining it hands this
    // reader somebody else's AbortError, which is the exact thing the reference
    // count exists to prevent. On a pan that window is the ordinary sequence
    // rather than a corner: the old blocks are aborted and the new ones
    // requested in the same tick, and adjacent blocks routinely want the same
    // 256 KiB chunk. Refusing is safe because fetchRun's cleanup removes only
    // its own entry, so the fresh run replacing this one survives the doomed
    // one settling.
    return undefined
  }
  // a settled run has dropped its abort listeners, so joining it would add a
  // signal nothing will ever take back out. Its chunk is still the one to await:
  // putCached runs after settle, so there is a window in which the bytes have
  // arrived and are in neither the cache nor this map.
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
      const joined = flight ? joinChunk(flight, init) : undefined
      if (joined === undefined) {
        const lastRun = runs.at(-1)
        if (lastRun?.end === index - 1) {
          lastRun.end = index
        } else {
          runs.push({ start: index, end: index })
        }
      } else {
        pending.push({ index, chunk: joined })
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
