import fetchMock from 'jest-fetch-mock'

import {
  RemoteFileWithRangeCache,
  clearCache,
} from './RemoteFileWithRangeCache.ts'

// Disable jest-fetch-mock so our custom mock fetch functions work
fetchMock.disableMocks()

const CHUNK = 256 * 1024

// Deterministic 1MB "file" where each byte equals its position mod 256
const FILE_SIZE = 2 * 1024 * 1024
const fileData = new Uint8Array(FILE_SIZE)
for (let i = 0; i < FILE_SIZE; i++) {
  fileData[i] = i % 256
}

function slice(start: number, end: number) {
  return fileData.slice(start, end + 1)
}

// Mock fetch that serves range requests from fileData and tracks calls
function createMockFetch() {
  const calls: { start: number; end: number }[] = []
  const mockFetch = async (
    _url: string | URL | Request,
    init?: RequestInit,
  ) => {
    const range = new Headers(init?.headers).get('range')
    if (range) {
      const m = /bytes=(\d+)-(\d+)/.exec(range)
      if (m) {
        const start = Number(m[1])
        const end = Math.min(Number(m[2]), FILE_SIZE - 1)
        calls.push({ start, end })
        return new Response(slice(start, end), { status: 206 })
      }
    }
    return new Response('', { status: 200 })
  }
  return { calls, mockFetch }
}

// Same, but exposing Content-Range so the size is discoverable (the common case
// outside a misconfigured CORS setup)
function createSizedMockFetch() {
  const calls: { start: number; end: number }[] = []
  const mockFetch = async (
    _url: string | URL | Request,
    init?: RequestInit,
  ) => {
    const range = new Headers(init?.headers).get('range')
    const m = range ? /bytes=(\d+)-(\d+)/.exec(range) : null
    if (m) {
      const start = Number(m[1])
      const end = Math.min(Number(m[2]), FILE_SIZE - 1)
      calls.push({ start, end })
      // real servers answer 416 for a range starting past EOF
      return start >= FILE_SIZE
        ? new Response('', { status: 416 })
        : new Response(slice(start, end), {
            status: 206,
            headers: { 'content-range': `bytes ${start}-${end}/${FILE_SIZE}` },
          })
    }
    return new Response('', { status: 200 })
  }
  return { calls, mockFetch }
}

function makeFile(mockFetch: typeof globalThis.fetch) {
  return new RemoteFileWithRangeCache('https://example.com/data.bin', {
    fetch: mockFetch,
  })
}

async function fetchRange(
  file: RemoteFileWithRangeCache,
  start: number,
  end: number,
) {
  const res = await file.fetch('https://example.com/data.bin', {
    headers: { range: `bytes=${start}-${end}` },
  })
  return new Uint8Array(await res.arrayBuffer())
}

afterEach(() => {
  clearCache()
})

describe('RemoteFileWithRangeCache', () => {
  test('returns correct bytes for a small range within one chunk', async () => {
    const { calls, mockFetch } = createMockFetch()
    const file = makeFile(mockFetch)
    const result = await fetchRange(file, 100, 199)
    expect(result).toEqual(slice(100, 199))
    expect(calls).toHaveLength(1)
  })

  test('returns correct bytes spanning two chunks', async () => {
    const { calls, mockFetch } = createMockFetch()
    const file = makeFile(mockFetch)
    const start = CHUNK - 10
    const end = CHUNK + 10
    const result = await fetchRange(file, start, end)
    expect(result).toEqual(slice(start, end))
    expect(calls).toHaveLength(1)
  })

  test('second request for same range hits cache with no new fetches', async () => {
    const { calls, mockFetch } = createMockFetch()
    const file = makeFile(mockFetch)
    await fetchRange(file, 0, 99)
    expect(calls).toHaveLength(1)
    const result = await fetchRange(file, 0, 99)
    expect(result).toEqual(slice(0, 99))
    expect(calls).toHaveLength(1)
  })

  test('overlapping request reuses cached chunks', async () => {
    const { calls, mockFetch } = createMockFetch()
    const file = makeFile(mockFetch)

    // Fetch first chunk
    await fetchRange(file, 0, CHUNK - 1)
    expect(calls).toHaveLength(1)

    // Fetch range spanning first and second chunk — only second chunk fetched
    const start = CHUNK - 50
    const end = CHUNK + 50
    const result = await fetchRange(file, start, end)
    expect(result).toEqual(slice(start, end))
    expect(calls).toHaveLength(2)
    // Second fetch should only be for chunk 1, not chunk 0
    expect(calls[1]!.start).toBe(CHUNK)
  })

  test('large range spanning many chunks makes a single fetch', async () => {
    const { calls, mockFetch } = createMockFetch()
    const file = makeFile(mockFetch)
    const start = 0
    const end = CHUNK * 5 - 1
    const result = await fetchRange(file, start, end)
    expect(result).toEqual(slice(start, end))
    expect(calls).toHaveLength(1)
  })

  test('gap detection fetches only missing middle chunks', async () => {
    const { calls, mockFetch } = createMockFetch()
    const file = makeFile(mockFetch)

    // Prime chunk 0 and chunk 3
    await fetchRange(file, 0, CHUNK - 1)
    await fetchRange(file, CHUNK * 3, CHUNK * 4 - 1)
    expect(calls).toHaveLength(2)

    // Now request chunks 0-3: only chunks 1-2 should be fetched
    const result = await fetchRange(file, 0, CHUNK * 4 - 1)
    expect(result).toEqual(slice(0, CHUNK * 4 - 1))
    expect(calls).toHaveLength(3)
    expect(calls[2]!.start).toBe(CHUNK)
    expect(calls[2]!.end).toBe(CHUNK * 3 - 1)
  })

  test('non-range request passes through without caching', async () => {
    const { mockFetch } = createMockFetch()
    const file = makeFile(mockFetch)
    const res = await file.fetch('https://example.com/data.bin')
    expect(res.status).toBe(200)
  })

  // clearCache used to do `queue.length = 0`, which strands every waiting
  // limitConcurrency call with no resolve and no reject: the read neither runs
  // nor settles. Above MAX_CONCURRENT (20) in-flight reads that is a hang.
  test('clearCache settles reads that were queued behind the concurrency cap', async () => {
    const chunk = 256 * 1024
    const bigFileSize = 64 * chunk
    const url = 'https://example.com/big.bin'
    const bigFetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
      const range = new Headers(init?.headers).get('range')!
      const [start, end] = /bytes=(\d+)-(\d+)/
        .exec(range)!
        .slice(1)
        .map(Number) as [number, number]
      const last = Math.min(end, bigFileSize - 1)
      return new Response(new Uint8Array(last - start + 1), {
        status: 206,
        headers: { 'content-range': `bytes ${start}-${last}/${bigFileSize}` },
      })
    }
    const file = new RemoteFileWithRangeCache(url, { fetch: bigFetch })

    // one distinct chunk each, so none joins another's in-flight fetch and more
    // than MAX_CONCURRENT of them are waiting on the queue at once
    const reads = Array.from({ length: 32 }, (_, i) =>
      file
        .fetch(url, {
          headers: { range: `bytes=${i * chunk}-${i * chunk + 9}` },
        })
        .then(res => res.arrayBuffer()),
    )
    clearCache()
    const results = await Promise.all(reads)
    expect(results.map(r => r.byteLength)).toEqual(Array(32).fill(10))
  })

  test('clearCache causes subsequent requests to re-fetch', async () => {
    const { calls, mockFetch } = createMockFetch()
    const file = makeFile(mockFetch)
    await fetchRange(file, 0, 99)
    expect(calls).toHaveLength(1)

    clearCache()

    await fetchRange(file, 0, 99)
    expect(calls).toHaveLength(2)
  })

  test('unaligned range within a chunk returns exact bytes', async () => {
    const { mockFetch } = createMockFetch()
    const file = makeFile(mockFetch)
    const start = 1000
    const end = 2000
    const result = await fetchRange(file, start, end)
    expect(result).toEqual(slice(start, end))
    expect(result).toHaveLength(1001)
  })

  test('fetch error propagates with status', async () => {
    const mockFetch = async () => new Response('', { status: 404 })
    const file = makeFile(mockFetch)
    await expect(fetchRange(file, 0, 99)).rejects.toThrow('HTTP 404')
    await expect(fetchRange(file, 0, 99)).rejects.toHaveProperty('status', 404)
  })

  test('HTTP 416 range not satisfiable returns empty buffer', async () => {
    // Simulates a BAM file where the chunk-aligned range start is past EOF
    const mockFetch = async () => new Response('', { status: 416 })
    const file = makeFile(mockFetch)
    const result = await fetchRange(file, 0, 99)
    expect(result).toHaveLength(0)
  })

  // Concurrent reads over adjacent genomic blocks routinely land in the same
  // 256 KiB chunk. Each read plans synchronously and publishes a promise per
  // chunk it is about to fetch, so the later read awaits that promise instead of
  // requesting the same bytes again (and burning a second concurrency slot).
  describe('in-flight chunk sharing', () => {
    // A mock that parks every request until released, so both reads plan while
    // the first fetch is still outstanding
    function createGatedMockFetch() {
      const calls: { start: number; end: number }[] = []
      let release = () => {}
      const gate = new Promise<void>(resolve => {
        release = resolve
      })
      const mockFetch = async (
        _url: string | URL | Request,
        init?: RequestInit,
      ) => {
        const m = /bytes=(\d+)-(\d+)/.exec(
          new Headers(init?.headers).get('range')!,
        )!
        const start = Number(m[1])
        const end = Math.min(Number(m[2]), FILE_SIZE - 1)
        calls.push({ start, end })
        await gate
        return new Response(slice(start, end), { status: 206 })
      }
      return {
        calls,
        mockFetch,
        release: () => {
          release()
        },
      }
    }

    test('two reads of the same missing chunk share one request', async () => {
      const { calls, mockFetch, release } = createGatedMockFetch()
      const file = makeFile(mockFetch)

      const first = fetchRange(file, 0, 99)
      const second = fetchRange(file, 100, 199)
      release()

      expect(await first).toEqual(slice(0, 99))
      expect(await second).toEqual(slice(100, 199))
      expect(calls).toHaveLength(1)
    })

    test('a read overlapping an in-flight run fetches only what it adds', async () => {
      const { calls, mockFetch, release } = createGatedMockFetch()
      const file = makeFile(mockFetch)

      const first = fetchRange(file, 0, CHUNK * 2 - 1)
      // chunk 1 is in flight above, chunk 2 is nobody's yet
      const second = fetchRange(file, CHUNK, CHUNK * 3 - 1)
      release()

      expect(await first).toEqual(slice(0, CHUNK * 2 - 1))
      expect(await second).toEqual(slice(CHUNK, CHUNK * 3 - 1))
      expect(calls).toEqual([
        { start: 0, end: CHUNK * 2 - 1 },
        { start: CHUNK * 2, end: CHUNK * 3 - 1 },
      ])
    })

    test('a failed shared request rejects both readers and is retried later', async () => {
      const calls: number[] = []
      let failing = true
      const mockFetch = async (
        _url: string | URL | Request,
        init?: RequestInit,
      ) => {
        const m = /bytes=(\d+)-(\d+)/.exec(
          new Headers(init?.headers).get('range')!,
        )!
        const start = Number(m[1])
        calls.push(start)
        // yield so both reads plan before the first response settles
        await Promise.resolve()
        return failing
          ? new Response('', { status: 503 })
          : new Response(slice(start, Math.min(Number(m[2]), FILE_SIZE - 1)), {
              status: 206,
            })
      }
      const file = makeFile(mockFetch)

      const first = fetchRange(file, 0, 99)
      const second = fetchRange(file, 100, 199)
      await expect(first).rejects.toThrow('HTTP 503')
      await expect(second).rejects.toThrow('HTTP 503')
      expect(calls).toHaveLength(1)

      // the failure left nothing cached and nothing marked in flight
      failing = false
      expect(await fetchRange(file, 0, 99)).toEqual(slice(0, 99))
      expect(calls).toHaveLength(2)
    })
  })

  test('multiple disjoint gaps produce separate fetches', async () => {
    const { calls, mockFetch } = createMockFetch()
    const file = makeFile(mockFetch)

    // Prime chunks 0 and 2, leaving 1 and 3 as separate gaps
    await fetchRange(file, 0, CHUNK - 1)
    await fetchRange(file, CHUNK * 2, CHUNK * 3 - 1)
    expect(calls).toHaveLength(2)

    // Request chunks 0-3: should fetch chunk 1 and chunk 3 separately
    const result = await fetchRange(file, 0, CHUNK * 4 - 1)
    expect(result).toEqual(slice(0, CHUNK * 4 - 1))
    expect(calls).toHaveLength(4)
    expect(calls[2]!.start).toBe(CHUNK)
    expect(calls[2]!.end).toBe(CHUNK * 2 - 1)
    expect(calls[3]!.start).toBe(CHUNK * 3)
    expect(calls[3]!.end).toBe(CHUNK * 4 - 1)
  })

  // Regression test: @gmod/bam and @gmod/tabix compute
  // fetchedSize() = maxv.blockPosition + (1<<16) - minv.blockPosition to
  // guarantee they read the complete final bgzf block. When the file ends
  // near a 256 KiB chunk boundary, this over-read crosses into a chunk whose
  // start is past EOF — the server would return 416 for that chunk.
  //
  // Fix: once a cached chunk is shorter than CHUNK_SIZE, the file ended
  // within it. Any chunk beyond it starts past EOF and is skipped without a
  // network request.
  test('skips chunk past EOF when previous chunk was short (bam/tabix over-read pattern)', async () => {
    // File ends 210 000 bytes into chunk 1 (chunks are 256 KiB = 262 144 bytes).
    const smallFileSize = CHUNK + 210_000 // 472 144 bytes
    const smallFile = new Uint8Array(smallFileSize)
    for (let i = 0; i < smallFileSize; i++) {
      smallFile[i] = i % 256
    }

    const calls: { start: number; end: number }[] = []
    const mockFetch = async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      const range = new Headers(init?.headers).get('range')
      if (range) {
        const m = /bytes=(\d+)-(\d+)/.exec(range)
        if (m) {
          const reqStart = Number(m[1])
          const reqEnd = Number(m[2])
          calls.push({ start: reqStart, end: reqEnd })
          if (reqStart >= smallFileSize) {
            // Should never reach here — the fix prevents this request
            return new Response('', { status: 416 })
          }
          const end = Math.min(reqEnd, smallFileSize - 1)
          return new Response(smallFile.slice(reqStart, end + 1), {
            status: 206,
          })
        }
      }
      return new Response('', { status: 200 })
    }

    const file = new RemoteFileWithRangeCache('https://example.com/small.bin', {
      fetch: mockFetch,
    })

    // Prime chunk 0 (full) and chunk 1 (short — server clips to smallFileSize)
    await file.fetch('https://example.com/small.bin', {
      headers: { range: `bytes=0-${CHUNK - 1}` },
    })
    await file.fetch('https://example.com/small.bin', {
      headers: { range: `bytes=${CHUNK}-${2 * CHUNK - 1}` },
    })
    expect(calls).toHaveLength(2)
    // Chunk 1 server response was shorter than CHUNK bytes

    // Over-read pattern: start near end of chunk 1, length = 1<<16,
    // which crosses into chunk 2 (starts at 2*CHUNK = 524 288 > smallFileSize)
    const overreadStart = CHUNK + 200_000 // 462 144 — within chunk 1, within file
    const overreadEnd = overreadStart + 65_535 // 527 679 — lands in chunk 2
    expect(Math.floor(overreadEnd / CHUNK)).toBe(2) // confirm chunk 2 is involved

    const res = await file.fetch('https://example.com/small.bin', {
      headers: { range: `bytes=${overreadStart}-${overreadEnd}` },
    })
    const result = new Uint8Array(await res.arrayBuffer())

    // Only the bytes that actually exist are returned
    expect(result).toEqual(smallFile.slice(overreadStart, smallFileSize))

    // Chunk 2 (starts at 2*CHUNK, past EOF) must NOT have been requested
    const chunk2Requests = calls.filter(c => c.start >= 2 * CHUNK)
    expect(chunk2Requests).toHaveLength(0)
    // Total fetches: 2 priming + 0 new (chunk 1 already cached, chunk 2 skipped)
    expect(calls).toHaveLength(2)
  })

  test('stat() returns file size from Content-Range header', async () => {
    const { mockFetch } = createSizedMockFetch()
    const stat = await makeFile(mockFetch).stat()
    expect(stat.size).toBe(FILE_SIZE)
  })

  test('stat() throws when Content-Range is not exposed (CORS)', async () => {
    const { mockFetch } = createMockFetch() // no Content-Range headers
    const file = makeFile(mockFetch)
    // Throws loudly rather than silently lying with size:0 — callers that can
    // degrade gracefully (e.g. ImportWizard size check) wrap stat in try/catch.
    await expect(file.stat()).rejects.toThrow(/Could not determine size/)
  })

  // Regression: a fresh filehandle whose chunk cache is already populated (e.g.
  // from a previous filehandle instance's leaked fetch in the same process)
  // must still return the correct file size from stat(). Previously stat()
  // would short-circuit on the cached chunk and never observe Content-Range,
  // returning a bogus size of 0.
  test('stat() returns correct size after chunk cache is pre-populated by another instance', async () => {
    const { mockFetch } = createSizedMockFetch()
    // First instance: prime the module-level chunk cache for the URL.
    const file1 = makeFile(mockFetch)
    await fetchRange(file1, 0, 99)

    // Second instance for the same URL — its per-instance state starts fresh.
    // stat() must NOT depend on the (per-instance) cachedStat field that would
    // have been populated only as a side effect of file1's range fetch.
    const file2 = makeFile(mockFetch)
    const stat = await file2.stat()
    expect(stat.size).toBe(FILE_SIZE)
  })

  // Cold cache: the over-read request is the FIRST request, so no short chunk
  // is cached yet. The coalesced fetch covers both a valid and past-EOF chunk
  // in one HTTP request — the server clips the response, and the past-EOF
  // chunk is cached as empty. No 416.
  test('cold-cache over-read handles partial server response gracefully', async () => {
    const smallFileSize = CHUNK + 210_000
    const smallFile = new Uint8Array(smallFileSize)
    for (let i = 0; i < smallFileSize; i++) {
      smallFile[i] = i % 256
    }

    const calls: { start: number; end: number }[] = []
    const mockFetch = async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      const range = new Headers(init?.headers).get('range')
      if (range) {
        const m = /bytes=(\d+)-(\d+)/.exec(range)
        if (m) {
          const reqStart = Number(m[1])
          const reqEnd = Number(m[2])
          calls.push({ start: reqStart, end: reqEnd })
          if (reqStart >= smallFileSize) {
            return new Response('', { status: 416 })
          }
          const end = Math.min(reqEnd, smallFileSize - 1)
          return new Response(smallFile.slice(reqStart, end + 1), {
            status: 206,
          })
        }
      }
      return new Response('', { status: 200 })
    }

    const file = new RemoteFileWithRangeCache('https://example.com/small.bin', {
      fetch: mockFetch,
    })

    // Single request spanning chunks 1 and 2, with no prior cached chunks.
    // Chunk 1 has data, chunk 2 is past EOF.
    const overreadStart = CHUNK + 200_000
    const overreadEnd = overreadStart + 65_535
    const res = await file.fetch('https://example.com/small.bin', {
      headers: { range: `bytes=${overreadStart}-${overreadEnd}` },
    })
    const result = new Uint8Array(await res.arrayBuffer())

    // Returns only the bytes that exist
    expect(result).toEqual(smallFile.slice(overreadStart, smallFileSize))

    // Both chunks were in one coalesced run — only one HTTP request
    expect(calls).toHaveLength(1)
    expect(calls[0]!.start).toBe(CHUNK)
  })

  // Regression: the module-global LRU is capped and shared across every file.
  // A chunk this read already holds can be evicted by other concurrent reads'
  // putCached calls during the fetch await window. Assembly must not re-read
  // the (possibly-evicted) chunk from the Map — it holds a local reference —
  // else getCached returns undefined and undefined.length throws a TypeError.
  test('evicting a needed chunk mid-fetch still assembles correct bytes', async () => {
    // Read spans chunk 0 (already cached) and chunk 1 (missing → slow fetch).
    // While chunk 1's fetch is parked, flood the shared LRU past its cap so
    // chunk 0's Map entry is evicted. Assembly must still produce chunk 0's
    // bytes from its locally-held reference.
    let releaseChunk1 = () => {}
    const chunk1Gate = new Promise<void>(res => {
      releaseChunk1 = res
    })

    const mainUrl = 'https://example.com/evict.bin'
    const mockFetch = async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      const range = new Headers(init?.headers).get('range')
      const m = range ? /bytes=(\d+)-(\d+)/.exec(range) : null
      if (m) {
        const start = Number(m[1])
        const end = Math.min(Number(m[2]), FILE_SIZE - 1)
        if (String(url) === mainUrl && start >= CHUNK) {
          await chunk1Gate
        }
        return new Response(slice(start, end), { status: 206 })
      }
      return new Response('', { status: 200 })
    }

    // fetch() keys the cache on the url argument, so call it directly with
    // distinct URLs here (the shared fetchRange helper hardcodes one URL).
    const read = async (url: string, s: number, e: number) => {
      const res = await new RemoteFileWithRangeCache(url, {
        fetch: mockFetch,
      }).fetch(url, { headers: { range: `bytes=${s}-${e}` } })
      return new Uint8Array(await res.arrayBuffer())
    }

    // Prime chunk 0 so it is present in the LRU (and captured by the next read).
    await read(mainUrl, 0, 99)

    // Read spanning chunk 0 (cached) + chunk 1 (missing); parks on chunk1Gate.
    const start = CHUNK - 50
    const end = CHUNK + 50
    const readPromise = read(mainUrl, start, end)

    // Flood the shared LRU from other URLs past MAX_CACHE_ENTRIES (2000) so the
    // FIFO eviction discards chunk 0's key while the read above is in flight.
    for (let i = 0; i < 2100; i++) {
      await read(`https://example.com/flood${i}.bin`, 0, 99)
    }

    releaseChunk1()
    const result = await readPromise
    expect(result).toEqual(slice(start, end))
  })

  // Regression: assembly used to accumulate `written` as it copied, so a first
  // chunk shorter than the offset into it produced a negative copy length and a
  // negative `written` — and result.subarray(0, negative) handed back a
  // fabricated zero byte where the file has nothing. Now every copy offset is
  // computed from absolute positions.
  test('read starting past EOF inside a cached short chunk returns empty', async () => {
    const smallFileSize = CHUNK + 100
    const smallFile = new Uint8Array(smallFileSize)
    for (let i = 0; i < smallFileSize; i++) {
      smallFile[i] = i % 256
    }
    const url = 'https://example.com/tiny.bin'
    const mockFetch = async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      const m = /bytes=(\d+)-(\d+)/.exec(
        new Headers(init?.headers).get('range')!,
      )!
      const reqStart = Number(m[1])
      return reqStart >= smallFileSize
        ? new Response('', { status: 416 })
        : new Response(
            smallFile.slice(
              reqStart,
              Math.min(Number(m[2]), smallFileSize - 1) + 1,
            ),
            { status: 206 },
          )
    }
    const file = new RemoteFileWithRangeCache(url, { fetch: mockFetch })
    const read = async (s: number, e: number) => {
      const res = await file.fetch(url, {
        headers: { range: `bytes=${s}-${e}` },
      })
      return new Uint8Array(await res.arrayBuffer())
    }

    // prime chunk 1; the server clips it to the 100 bytes that exist
    expect(await read(CHUNK, 2 * CHUNK - 1)).toHaveLength(100)
    // now read a range wholly past EOF but still inside chunk 1
    expect(await read(CHUNK + 200, CHUNK + 300)).toHaveLength(0)
  })

  // Once the size is known from Content-Range, a read whose tail extends past
  // EOF (the bam/tabix 1<<16 over-read) is clamped before planning, so no
  // request is issued for a chunk that starts past EOF even on a cold cache.
  test('known file size clamps a read extending past EOF', async () => {
    const { calls, mockFetch } = createSizedMockFetch()
    const file = makeFile(mockFetch)
    expect(await file.stat()).toEqual({ size: FILE_SIZE })
    calls.length = 0

    // last 100 bytes of the file, over-read by 64 KiB past EOF
    const start = FILE_SIZE - 100
    const result = await fetchRange(file, start, start + 65_635)
    expect(result).toEqual(slice(start, FILE_SIZE - 1))
    // one request, clamped to the final chunk — nothing past FILE_SIZE
    expect(calls).toHaveLength(1)
    expect(calls[0]!.start).toBe(CHUNK * 7)
  })

  test('a read entirely past a known EOF makes no request', async () => {
    const { calls, mockFetch } = createSizedMockFetch()
    const file = makeFile(mockFetch)
    await fetchRange(file, 0, 99)
    calls.length = 0
    const result = await fetchRange(file, FILE_SIZE + 10, FILE_SIZE + 200)
    expect(result).toHaveLength(0)
    expect(calls).toHaveLength(0)
  })

  // Range reads go through a rebuilt request. Auth headers an internet account
  // (or the caller of RemoteFile.read) put on the request must survive it —
  // dropping them turns a signed read into a 401/403.
  test('caller headers are preserved on range requests', async () => {
    const seen: (string | null)[] = []
    const mockFetch = async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      const headers = new Headers(init?.headers)
      seen.push(headers.get('authorization'))
      const m = /bytes=(\d+)-(\d+)/.exec(headers.get('range')!)!
      const start = Number(m[1])
      return new Response(slice(start, Math.min(Number(m[2]), FILE_SIZE - 1)), {
        status: 206,
      })
    }
    const file = makeFile(mockFetch)
    await file.fetch('https://example.com/data.bin', {
      headers: { authorization: 'Bearer token', range: 'bytes=0-99' },
    })
    expect(seen).toEqual(['Bearer token'])
  })

  test('open-ended and multi-range headers pass through uncached', async () => {
    const seen: (string | null)[] = []
    const mockFetch = async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      seen.push(new Headers(init?.headers).get('range'))
      return new Response('', { status: 206 })
    }
    const file = makeFile(mockFetch)
    for (const range of ['bytes=100-', 'bytes=0-9,20-29']) {
      await file.fetch('https://example.com/data.bin', { headers: { range } })
    }
    // forwarded verbatim rather than partially honored from the chunk cache
    expect(seen).toEqual(['bytes=100-', 'bytes=0-9,20-29'])
  })

  test('different URLs do not share cache', async () => {
    const { calls, mockFetch } = createMockFetch()
    const file = makeFile(mockFetch)

    await fetchRange(file, 0, 99)
    expect(calls).toHaveLength(1)

    // Same range but different URL should trigger a new fetch
    const res = await file.fetch('https://example.com/other.bin', {
      headers: { range: 'bytes=0-99' },
    })
    const result = new Uint8Array(await res.arrayBuffer())
    expect(result).toEqual(slice(0, 99))
    expect(calls).toHaveLength(2)
  })

  // A server that ignores Range and replies 200 with the whole file would
  // otherwise have its body sliced at the requested offsets, silently serving
  // bytes from position 0 as if they came from `start` (classic symptom
  // downstream: "invalid bgzf header").
  describe('server that ignores range requests', () => {
    function rangeIgnoringFetch() {
      return async () => new Response(fileData, { status: 200 })
    }

    test('throws instead of returning wrong bytes for a range past byte 0', async () => {
      const file = makeFile(rangeIgnoringFetch())
      await expect(fetchRange(file, CHUNK, CHUNK + 99)).rejects.toThrow(
        /ignored the Range header/,
      )
    })

    test('accepts a 200 when the request started at 0', async () => {
      const file = makeFile(rangeIgnoringFetch())
      // the body does start at byte 0, so slicing it at the requested offsets
      // is correct — no need to fail a server whose file fits in one chunk
      expect(await fetchRange(file, 0, 99)).toEqual(slice(0, 99))
    })

    test('uses the 200 body length as the file size', async () => {
      const file = makeFile(rangeIgnoringFetch())
      await fetchRange(file, 0, 99)
      // there is no Content-Range on a 200, but the body is the whole file
      expect(await file.stat()).toEqual({ size: FILE_SIZE })
    })
  })
})

// A gated fetch: each request hangs until released, and rejects with an
// AbortError if its own signal aborts first. Lets two reads share one in-flight
// chunk and cancel independently.
function createGatedFetch() {
  const calls: { start: number; end: number }[] = []
  const gates: (() => void)[] = []
  const mockFetch = async (
    _url: string | URL | Request,
    init?: RequestInit,
  ) => {
    const range = new Headers(init?.headers).get('range')
    const m = range ? /bytes=(\d+)-(\d+)/.exec(range) : null
    if (m) {
      const start = Number(m[1])
      const end = Math.min(Number(m[2]), FILE_SIZE - 1)
      calls.push({ start, end })
      await new Promise<void>((resolve, reject) => {
        gates.push(resolve)
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'))
        })
      })
      return new Response(slice(start, end), { status: 206 })
    }
    return new Response('', { status: 200 })
  }
  return {
    calls,
    mockFetch,
    release: () => {
      for (const gate of gates.splice(0)) {
        gate()
      }
    },
  }
}

describe('RemoteFileWithRangeCache aborted-chunk sharing', () => {
  test('does not re-fetch a shared chunk when the read that opened it aborts', async () => {
    const { calls, mockFetch, release } = createGatedFetch()
    const file = makeFile(mockFetch)
    const controller = new AbortController()

    // the owner opens the chunk fetch, the joiner shares it rather than asking
    // for the same 256 KiB again
    const owner = file.fetch('https://example.com/data.bin', {
      headers: { range: 'bytes=0-99' },
      signal: controller.signal,
    })
    const joiner = fetchRange(file, 100, 199)
    expect(calls).toHaveLength(1)

    // The joiner never asked to be canceled, so the request it is sharing is
    // not canceled either — it is still in flight, waiting to be released. The
    // owner's abort is the owner's business.
    controller.abort()
    release()

    await expect(owner).rejects.toThrow(/abort/i)
    expect(await joiner).toEqual(slice(100, 199))
    // One request, not two. Nothing was re-issued because nothing was
    // canceled; this asserted 2 back when a joiner had to re-fetch the 256 KiB
    // an aborting owner dropped on the floor.
    expect(calls).toHaveLength(1)
  })

  test('cancels the request once every sharer has aborted', async () => {
    const { calls, mockFetch } = createGatedFetch()
    const file = makeFile(mockFetch)
    const owner = new AbortController()
    const joiner = new AbortController()

    const ownerRead = file.fetch('https://example.com/data.bin', {
      headers: { range: 'bytes=0-99' },
      signal: owner.signal,
    })
    const joinerRead = file.fetch('https://example.com/data.bin', {
      headers: { range: 'bytes=100-199' },
      signal: joiner.signal,
    })
    expect(calls).toHaveLength(1)

    // the other half of the contract: with nobody left wanting these bytes the
    // request is torn down rather than run to completion and discarded. The
    // gate is never released — the abort is what unblocks the fetch.
    owner.abort()
    joiner.abort()

    await expect(ownerRead).rejects.toThrow(/abort/i)
    await expect(joinerRead).rejects.toThrow(/abort/i)
  })

  test('propagates the abort to a joiner that was itself canceled', async () => {
    const { mockFetch } = createGatedFetch()
    const file = makeFile(mockFetch)
    const owner = new AbortController()
    const both = new AbortController()

    const ownerRead = file.fetch('https://example.com/data.bin', {
      headers: { range: 'bytes=0-99' },
      signal: owner.signal,
    })
    const joinerRead = file.fetch('https://example.com/data.bin', {
      headers: { range: 'bytes=100-199' },
      signal: both.signal,
    })

    both.abort()
    owner.abort()
    await expect(ownerRead).rejects.toThrow(/abort/i)
    await expect(joinerRead).rejects.toThrow(/abort/i)
  })

  test('a non-abort failure still rejects every sharer', async () => {
    const calls: number[] = []
    const failingFetch = async () => {
      calls.push(1)
      return new Response('', { status: 500 })
    }
    const file = makeFile(failingFetch)
    const first = fetchRange(file, 0, 99)
    const second = fetchRange(file, 100, 199)
    await expect(first).rejects.toThrow(/HTTP 500/)
    await expect(second).rejects.toThrow(/HTTP 500/)
    // no retry: the failure is real, and each read would have gotten it alone
    expect(calls).toHaveLength(1)
  })
})
