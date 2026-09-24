type ChunkId = string | number
type ChunkHandler = (chunkId: ChunkId, promises: Promise<unknown>[]) => void

export interface WebpackChunkRuntime {
  f?: Record<string, ChunkHandler | undefined>
}

export interface WorkerScope {
  importScripts: (url: string) => void
  location: { href: string }
  fetch: (url: string) => Promise<{ arrayBuffer: () => Promise<unknown> }>
}

declare const __webpack_require__: WebpackChunkRuntime | undefined

/**
 * Download the chunks of a dynamic import together in a classic web worker.
 *
 * Webpack's worker chunk handler (`f.i`) runs `importScripts` for one chunk at
 * a time, and `importScripts` blocks until its file has arrived, so an import
 * spanning 26 chunks waits on 26 round trips in a row. This handler asks the
 * original which url it would load (none, if the chunk is installed), fetches
 * it, and runs `importScripts` once the fetch lands, by then a cache read. A
 * chunk file only registers module factories, so install order is free.
 *
 * Only same-origin http(s) chunks are prefetched: another origin would need
 * CORS for `fetch`, and a `file:` worker (Desktop) has no round trip to save.
 */
export function parallelizeChunkLoading(
  runtime: WebpackChunkRuntime | undefined,
  scope: WorkerScope,
) {
  const handlers = runtime?.f
  const original = handlers?.i
  if (!handlers || !original) {
    return
  }
  const { origin, protocol } = new URL(scope.location.href)
  if (protocol !== 'http:' && protocol !== 'https:') {
    return
  }
  const importScripts = scope.importScripts.bind(scope)
  const loading = new Map<string, Promise<void>>()

  const urlOriginalWouldLoad = (
    chunkId: ChunkId,
    promises: Promise<unknown>[],
  ) => {
    let url: string | undefined
    scope.importScripts = (u: string) => {
      url = u
    }
    try {
      original(chunkId, promises)
    } finally {
      scope.importScripts = importScripts
    }
    return url
  }

  handlers.i = (chunkId, promises) => {
    const url = urlOriginalWouldLoad(chunkId, promises)
    if (url === undefined) {
      return
    }
    if (new URL(url, scope.location.href).origin !== origin) {
      importScripts(url)
      return
    }
    let pending = loading.get(url)
    if (!pending) {
      pending = scope
        .fetch(url)
        .then(r => r.arrayBuffer())
        .then(
          () => {},
          () => {},
        )
        .then(() => {
          importScripts(url)
        })
      pending.catch(() => {
        loading.delete(url)
      })
      loading.set(url, pending)
    }
    promises.push(pending)
  }
}

export function parallelizeWorkerChunkLoading() {
  parallelizeChunkLoading(
    // eslint-disable-next-line unicorn/no-typeof-undefined -- undeclared outside webpack, so a direct read throws
    typeof __webpack_require__ === 'undefined'
      ? undefined
      : __webpack_require__,
    globalThis as unknown as WorkerScope,
  )
}
