import fetchMock from 'jest-fetch-mock'

import { RemoteFileWithRangeCache, clearCache } from './RemoteFileWithRangeCache.ts'

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
  const mockFetch = async (_url: string | URL | Request, init?: RequestInit) => {
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

async function fetchRange(file: RemoteFileWithRangeCache, start: number, end: number) {
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
