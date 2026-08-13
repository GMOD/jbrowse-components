import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'

import { GoogleDriveFile } from './GoogleDriveFilehandle.ts'

import type { RequestInitWithMetadata } from './model.tsx'

const CHUNK = 256 * 1024
const SIZE = CHUNK + 1000

const fileData = new Uint8Array(SIZE)
for (let i = 0; i < SIZE; i++) {
  fileData[i] = i % 256
}

/**
 * Drive as the chunk cache sees it: a metadata endpoint that reports the size
 * (as a JSON string, the way Drive serializes its int64 fields), and a media
 * endpoint that serves ranges but carries no `Content-Range` — so `stat` is the
 * only place the size is ever observable.
 */
function createMockFetch(metadata: Record<string, string>) {
  const calls: { start: number; end: number }[] = []
  const mockFetch = async (
    _input: RequestInfo,
    init?: RequestInitWithMetadata,
  ) => {
    if (init?.metadataOnly) {
      return new Response(JSON.stringify(metadata), { status: 200 })
    }
    const m = /bytes=(\d+)-(\d+)/.exec(
      new Headers(init?.headers).get('range') ?? '',
    )!
    const start = Number(m[1])
    const end = Number(m[2])
    calls.push({ start, end })
    return start >= SIZE
      ? new Response('', { status: 416 })
      : new Response(fileData.slice(start, Math.min(end + 1, SIZE)), {
          status: 206,
        })
  }
  return { calls, mockFetch }
}

function makeFile(mockFetch: ReturnType<typeof createMockFetch>['mockFetch']) {
  return new GoogleDriveFile('https://drive.example/file', {
    fetch: mockFetch as unknown as typeof globalThis.fetch,
  })
}

afterEach(() => {
  clearCache()
})

test('stat() reports the size as a number', async () => {
  const { mockFetch } = createMockFetch({ size: String(SIZE) })
  expect(await makeFile(mockFetch).stat()).toEqual({ size: SIZE })
})

test('stat() teaches the chunk cache the size, clamping the bgzf over-read', async () => {
  const { calls, mockFetch } = createMockFetch({ size: String(SIZE) })
  const file = makeFile(mockFetch)
  await file.stat()

  // @gmod/bam and @gmod/tabix size their last read of a file to cover the whole
  // final bgzf block, so it runs past EOF by construction. A known size clamps
  // it to the one chunk that exists; without one this asked for two, and the
  // second was a round trip to be told 416.
  expect((await file.read(CHUNK, SIZE - 100)).length).toBe(100)
  expect(calls).toEqual([{ start: CHUNK, end: 2 * CHUNK - 1 }])
})

test('a file Drive reports no size for does not poison later reads', async () => {
  // Drive populates `size` only for files that have one — not folders,
  // shortcuts or native editor documents. Caching the NaN that `Number(...)` of
  // a missing field produces makes the clamp NaN too, and every later read of
  // the file then returns empty with nothing said.
  const { mockFetch } = createMockFetch({})
  const file = makeFile(mockFetch)
  expect((await file.stat()).size).toBeNaN()
  expect((await file.read(100, 0)).length).toBe(100)
})
