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

function makeFile(mockFetch: typeof globalThis.fetch) {
  return new RemoteFileWithRangeCache('http://example.com/data.bin', {
    fetch: mockFetch,
  })
}

async function fetchRange(
  file: RemoteFileWithRangeCache,
  start: number,
  end: number,
) {
  const res = await file.fetch('http://example.com/data.bin', {
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
    const res = await file.fetch('http://example.com/data.bin')
    expect(res.status).toBe(200)
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

    const file = new RemoteFileWithRangeCache('http://example.com/small.bin', {
      fetch: mockFetch,
    })

    // Prime chunk 0 (full) and chunk 1 (short — server clips to smallFileSize)
    await file.fetch('http://example.com/small.bin', {
      headers: { range: `bytes=0-${CHUNK - 1}` },
    })
    await file.fetch('http://example.com/small.bin', {
      headers: { range: `bytes=${CHUNK}-${2 * CHUNK - 1}` },
    })
    expect(calls).toHaveLength(2)
    // Chunk 1 server response was shorter than CHUNK bytes

    // Over-read pattern: start near end of chunk 1, length = 1<<16,
    // which crosses into chunk 2 (starts at 2*CHUNK = 524 288 > smallFileSize)
    const overreadStart = CHUNK + 200_000 // 462 144 — within chunk 1, within file
    const overreadEnd = overreadStart + 65_535 // 527 679 — lands in chunk 2
    expect(Math.floor(overreadEnd / CHUNK)).toBe(2) // confirm chunk 2 is involved

    const res = await file.fetch('http://example.com/small.bin', {
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
          return new Response(slice(start, end), {
            status: 206,
            headers: {
              'content-range': `bytes ${start}-${end}/${FILE_SIZE}`,
            },
          })
        }
      }
      return new Response('', { status: 200 })
    }
    const file = new RemoteFileWithRangeCache('http://example.com/data.bin', {
      fetch: mockFetch,
    })
    const stat = await file.stat()
    expect(stat.size).toBe(FILE_SIZE)
  })

  test('stat() does not throw when Content-Range is not exposed (CORS)', async () => {
    const { mockFetch } = createMockFetch() // no Content-Range headers
    const file = makeFile(mockFetch)
    // Falls back to parent stat() — should not crash
    await expect(file.stat()).resolves.toBeDefined()
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

    const file = new RemoteFileWithRangeCache('http://example.com/small.bin', {
      fetch: mockFetch,
    })

    // Single request spanning chunks 1 and 2, with no prior cached chunks.
    // Chunk 1 has data, chunk 2 is past EOF.
    const overreadStart = CHUNK + 200_000
    const overreadEnd = overreadStart + 65_535
    const res = await file.fetch('http://example.com/small.bin', {
      headers: { range: `bytes=${overreadStart}-${overreadEnd}` },
    })
    const result = new Uint8Array(await res.arrayBuffer())

    // Returns only the bytes that exist
    expect(result).toEqual(smallFile.slice(overreadStart, smallFileSize))

    // Both chunks were in one coalesced run — only one HTTP request
    expect(calls).toHaveLength(1)
    expect(calls[0]!.start).toBe(CHUNK)
  })

  test('different URLs do not share cache', async () => {
    const { calls, mockFetch } = createMockFetch()
    const file = makeFile(mockFetch)

    await fetchRange(file, 0, 99)
    expect(calls).toHaveLength(1)

    // Same range but different URL should trigger a new fetch
    const res = await file.fetch('http://example.com/other.bin', {
      headers: { range: 'bytes=0-99' },
    })
    const result = new Uint8Array(await res.arrayBuffer())
    expect(result).toEqual(slice(0, 99))
    expect(calls).toHaveLength(2)
  })
})
