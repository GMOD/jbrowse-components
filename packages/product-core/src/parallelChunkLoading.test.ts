import { parallelizeChunkLoading } from './parallelChunkLoading.ts'

import type {
  WebpackChunkRuntime,
  WorkerScope,
} from './parallelChunkLoading.ts'

// Mirrors webpack's classic-worker handler, `(id, p) => { installed[id] ||
// importScripts(url(id)) }`, whose `importScripts` is a global looked up when
// it runs.
function setup(href = 'https://example.org/jb2/static/js/worker.js') {
  const installed = new Set<string>()
  const fetches: { url: string; resolve: () => void; reject: () => void }[] = []
  const executed: string[] = []
  const scope: WorkerScope = {
    location: { href },
    importScripts: (url: string) => {
      if (url.includes('missing')) {
        throw new Error(`NetworkError: ${url}`)
      }
      executed.push(url)
      installed.add(url.split('/').pop()!.split('.')[0]!)
    },
    fetch: (url: string) =>
      new Promise((resolve, reject) => {
        fetches.push({
          url,
          resolve: () => {
            resolve({ arrayBuffer: async () => new ArrayBuffer(0) })
          },
          reject,
        })
      }),
  }
  const runtime: WebpackChunkRuntime = {
    f: {
      i: (id: string | number) => {
        if (!installed.has(String(id))) {
          scope.importScripts(
            String(id).startsWith('cdn')
              ? `https://cdn.example.com/${id}.chunk.js`
              : `https://example.org/jb2/static/js/${id}.chunk.js`,
          )
        }
      },
    },
  }
  const load = (id: string) => {
    const promises: Promise<unknown>[] = []
    runtime.f!.i!(id, promises)
    return Promise.all(promises)
  }
  return { installed, fetches, executed, scope, runtime, load }
}

test('the chunks of one import download together, then install', async () => {
  const s = setup()
  parallelizeChunkLoading(s.runtime, s.scope)
  const all = Promise.all(['a', 'b', 'c'].map(id => s.load(id)))

  expect(s.fetches.map(f => f.url.split('/').pop())).toEqual([
    'a.chunk.js',
    'b.chunk.js',
    'c.chunk.js',
  ])
  expect(s.executed).toEqual([])

  for (const f of s.fetches) {
    f.resolve()
  }
  await all
  expect(s.executed).toHaveLength(3)

  // the stand-in used to read the url is gone once each lookup returns
  s.scope.importScripts('https://example.org/jb2/static/js/z.chunk.js')
  expect(s.executed).toHaveLength(4)
})

test('an installed chunk is neither fetched nor waited on', async () => {
  const s = setup()
  s.installed.add('a')
  parallelizeChunkLoading(s.runtime, s.scope)
  const promises: Promise<unknown>[] = []
  s.runtime.f!.i!('a', promises)
  expect(promises).toEqual([])
  expect(s.fetches).toEqual([])
})

test('a chunk two imports ask for is fetched and run once', async () => {
  const s = setup()
  parallelizeChunkLoading(s.runtime, s.scope)
  const both = Promise.all([s.load('a'), s.load('a')])
  expect(s.fetches).toHaveLength(1)
  s.fetches[0]!.resolve()
  await both
  expect(s.executed).toEqual(['https://example.org/jb2/static/js/a.chunk.js'])
})

test('a failed prefetch still reports the load error, and a retry fetches again', async () => {
  const s = setup()
  parallelizeChunkLoading(s.runtime, s.scope)
  const first = s.load('missing')
  s.fetches[0]!.reject()
  await expect(first).rejects.toThrow('NetworkError')

  const second = s.load('missing')
  expect(s.fetches).toHaveLength(2)
  s.fetches[1]!.resolve()
  await expect(second).rejects.toThrow('NetworkError')
})

test('a chunk on another origin loads the old way', () => {
  const s = setup()
  parallelizeChunkLoading(s.runtime, s.scope)
  const promises: Promise<unknown>[] = []
  s.runtime.f!.i!('cdnchunk', promises)
  expect(s.fetches).toEqual([])
  expect(s.executed).toEqual(['https://cdn.example.com/cdnchunk.chunk.js'])
})

test('a file: worker and a runtime without the importScripts handler are left alone', () => {
  const desktop = setup('file:///app/static/js/worker.js')
  const before = desktop.runtime.f!.i
  parallelizeChunkLoading(desktop.runtime, desktop.scope)
  expect(desktop.runtime.f!.i).toBe(before)

  const esm: WebpackChunkRuntime = { f: {} }
  parallelizeChunkLoading(esm, desktop.scope)
  expect(esm.f).toEqual({})
  parallelizeChunkLoading(undefined, desktop.scope)
})
