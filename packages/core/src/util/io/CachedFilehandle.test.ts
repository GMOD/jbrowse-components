import fetchMock from 'jest-fetch-mock'

import {
  CachedFilehandle,
  RemoteFileWithRangeCache,
  clearCache,
} from './RemoteFileWithRangeCache.ts'

import type { GenericFilehandle } from 'generic-filehandle2'

fetchMock.disableMocks()

const CHUNK = 256 * 1024
const FILE_SIZE = 2 * 1024 * 1024
const fileData = new Uint8Array(FILE_SIZE)
for (let i = 0; i < FILE_SIZE; i++) {
  fileData[i] = i % 256
}

function slice(start: number, end: number) {
  return fileData.slice(start, end + 1)
}

function createMockFetch({ sized = false } = {}) {
  const calls: { start: number; end: number }[] = []
  const mockFetch = (_url: string | URL | Request, init?: RequestInit) => {
    const range = new Headers(init?.headers).get('range')
    const m = range ? /bytes=(\d+)-(\d+)/.exec(range) : null
    if (m) {
      const start = Number(m[1])
      const end = Math.min(Number(m[2]), FILE_SIZE - 1)
      calls.push({ start, end })
      if (start >= FILE_SIZE) {
        return Promise.resolve(new Response('', { status: 416 }))
      }
      return Promise.resolve(
        new Response(slice(start, end), {
          status: 206,
          headers: sized
            ? { 'content-range': `bytes ${start}-${end}/${FILE_SIZE}` }
            : {},
        }),
      )
    }
    return Promise.resolve(new Response('', { status: 200 }))
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

describe('read() serves bytes without a Response round trip', () => {
  test('read() returns the same bytes as the fetch() path', async () => {
    const { mockFetch } = createMockFetch()
    const file = makeFile(mockFetch)
    const cases: [number, number][] = [
      [0, 100],
      [1000, CHUNK],
      [CHUNK - 50, 200],
      [3 * CHUNK + 7, 2 * CHUNK],
    ]
    for (const [start, len] of cases) {
      const viaRead = await file.read(len, start)
      const viaFetch = await fetchRange(file, start, start + len - 1)
      expect([...viaRead]).toEqual([...viaFetch])
      expect([...viaRead]).toEqual([...slice(start, start + len - 1)])
    }
  })

  test('read() and fetch() share one chunk cache, in both directions', async () => {
    const { calls, mockFetch } = createMockFetch()
    const file = makeFile(mockFetch)

    // read() populates the cache that fetch() then hits
    await file.read(100, 0)
    expect(calls.length).toBe(1)
    await fetchRange(file, 0, 99)
    expect(calls.length).toBe(1)

    // and the other way round
    const before = calls.length
    await fetchRange(file, 5 * CHUNK, 5 * CHUNK + 99)
    expect(calls.length).toBe(before + 1)
    await file.read(100, 5 * CHUNK)
    expect(calls.length).toBe(before + 1)
  })

  test('read() keeps the guards RemoteFile.read applies', async () => {
    const { calls, mockFetch } = createMockFetch()
    const file = makeFile(mockFetch)
    expect((await file.read(0, 0)).length).toBe(0)
    expect(calls.length).toBe(0)
    await expect(file.read(Number.NaN, 0)).rejects.toThrow(TypeError)
    await expect(file.read(10, Number.NaN)).rejects.toThrow(TypeError)
    expect(calls.length).toBe(0)
  })

  test('read() honors an abort signal', async () => {
    const { mockFetch } = createMockFetch()
    const file = makeFile(mockFetch)
    const controller = new AbortController()
    controller.abort()
    await expect(
      file.read(100, 0, { signal: controller.signal }),
    ).rejects.toThrow(/abort/i)
  })

  test('read() past EOF comes back short rather than throwing', async () => {
    const { mockFetch } = createMockFetch({ sized: true })
    const file = makeFile(mockFetch)
    const bytes = await file.read(CHUNK, FILE_SIZE - 100)
    expect(bytes.length).toBe(100)
  })
})

/** A minimal non-HTTP filehandle, standing in for LocalFile/BlobFile. */
function fakeInner() {
  const calls: { length: number; position: number }[] = []
  const inner: GenericFilehandle = {
    read(length: number, position: number) {
      calls.push({ length, position })
      const end = Math.min(position + length, FILE_SIZE)
      return Promise.resolve(fileData.slice(position, end))
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readFile(): any {
      return Promise.resolve(fileData)
    },
    stat() {
      return Promise.resolve({ size: FILE_SIZE })
    },
    close() {
      return Promise.resolve()
    },
  }
  return { calls, inner }
}

describe('CachedFilehandle wraps any filehandle', () => {
  test('caches reads from a non-HTTP filehandle', async () => {
    const { calls, inner } = fakeInner()
    const file = new CachedFilehandle(inner, 'file:///tmp/x.bam')

    expect([...(await file.read(100, 0))]).toEqual([...slice(0, 99)])
    expect(calls.length).toBe(1)

    // a second read inside the same chunk never reaches the inner handle
    expect([...(await file.read(50, 20))]).toEqual([...slice(20, 69)])
    expect(calls.length).toBe(1)
  })

  test('reads a whole chunk from the inner handle, not just the bytes asked for', async () => {
    const { calls, inner } = fakeInner()
    const file = new CachedFilehandle(inner, 'file:///tmp/y.bam')
    await file.read(10, 0)
    expect(calls[0]!.length).toBe(CHUNK)
    expect(calls[0]!.position).toBe(0)
  })

  test('two wrappers on one key share chunks; different keys do not', async () => {
    const a = fakeInner()
    const b = fakeInner()
    await new CachedFilehandle(a.inner, 'file:///tmp/same.bam').read(100, 0)
    await new CachedFilehandle(b.inner, 'file:///tmp/same.bam').read(100, 0)
    expect(a.calls.length).toBe(1)
    expect(b.calls.length).toBe(0)

    await new CachedFilehandle(b.inner, 'file:///tmp/other.bam').read(100, 0)
    expect(b.calls.length).toBe(1)
  })

  test('stat() delegates and teaches the cache the file size', async () => {
    const { calls, inner } = fakeInner()
    const file = new CachedFilehandle(inner, 'file:///tmp/z.bam')
    expect((await file.stat()).size).toBe(FILE_SIZE)
    // with the size known, an over-read past EOF is clamped rather than asking
    // the inner handle for chunks that start past the end
    expect((await file.read(CHUNK, FILE_SIZE - 100)).length).toBe(100)
    expect(calls.every(c => c.position < FILE_SIZE)).toBe(true)
  })

  test('an over-read past EOF is short even with no size known', async () => {
    const { inner } = fakeInner()
    const file = new CachedFilehandle(inner, 'file:///tmp/v.bam')
    // no stat() first, so the clamp cannot help — the short inner read is what
    // has to carry it, which is how @gmod/bam's final-block over-read lands
    expect((await file.read(CHUNK, FILE_SIZE - 100)).length).toBe(100)
  })

  test('read() guards and zero-length behave like the remote path', async () => {
    const { calls, inner } = fakeInner()
    const file = new CachedFilehandle(inner, 'file:///tmp/w.bam')
    expect((await file.read(0, 0)).length).toBe(0)
    expect(calls.length).toBe(0)
    await expect(file.read(Number.NaN, 0)).rejects.toThrow(TypeError)
  })

  test('readFile and close delegate to the inner handle', async () => {
    const { inner } = fakeInner()
    const file = new CachedFilehandle(inner, 'file:///tmp/u.bam')
    expect((await file.readFile()).length).toBe(FILE_SIZE)
    await expect(file.close()).resolves.toBeUndefined()
  })
})
