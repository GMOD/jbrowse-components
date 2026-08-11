import type { BgzfWorkerPool } from '@gmod/bgzf-filehandle'

/**
 * The BGZF inflate pool the indexed-format libraries decompress their chunks
 * on, instead of decompressing them on the thread that asked.
 *
 * BGZF decompression is 70-90% of a cold query (`@gmod/bam` ADR 0003) and BGZF
 * blocks are independently inflatable, so spreading them across workers is the
 * largest remaining lever in the read path. Measured 1.95x end to end on the
 * BAM side: a 22-view pan / zoom out / pan back over 1000x long-read data, real
 * HTTP, headless Chrome, 4 workers, with both arms returning the same 38,246
 * records.
 *
 * ## One pool per JS context, like the cache budgets
 *
 * Same scope and same reason as `decompressedBytesBudget` — see
 * {@link ./cacheBudgets.ts} — so one per RPC worker plus one on the main
 * thread. That is the scope with spare cores: a track's queries are sticky to a
 * single RPC worker, so without a pool every chunk of every query inflates on
 * that one thread while the rest of the machine idles. `getSharedWorkerPool()`
 * memoizes per context, so every adapter in a worker shares its four workers
 * rather than each opening its own.
 *
 * ## Call it, don't hoist it
 *
 * This is a function and not an exported constant on purpose: it spawns workers
 * the first time it is called, and a module-level call would spawn them on
 * import, in every context that pulls in anything from `util`, whether or not a
 * bgzip-backed track is ever opened. Call it where a file is constructed.
 *
 * ## The dynamic import is about bundle weight, and only that
 *
 * `@gmod/bgzf-filehandle` inlines its worker bundle as a base64 string, and
 * `getSharedWorkerPool` is what reaches it, so a **static** import pins that
 * blob into the initial bundle of every entry point that reaches this helper.
 * Measured with esbuild, splitting and minifying, on the import alone:
 *
 * ```
 * static    entry 54.7kb  (23.4kb gzipped) — the blob is in the initial bundle
 * dynamic   entry 114b    (141b  gzipped) + 123.9kb in a split chunk
 * ```
 *
 * So ~23kb gzipped off every bundle that can reach a bgzip adapter, deferred to
 * a chunk that is only fetched once such a track is actually opened. Core's
 * `util/unzip.ts` and `fetchAndMaybeUnzip.ts` dodge it the same way. It costs
 * nothing to do, because the libraries want a promise anyway — their callers'
 * `configure()` is synchronous and the pool is only available asynchronously.
 *
 * **It is not about test speed**, though it has been described that way. That
 * claim was checked here and did not reproduce: three jbrowse-web variant
 * suites ran 13.887s static against 13.856s dynamic, warm cache, and a 29s
 * reading that started this off turned out to be a cold jest transform cache in
 * a fresh worktree. Don't reintroduce a static import on the grounds that the
 * jest argument was wrong — the bundle argument above is the real one, and it
 * stands on its own.
 *
 * The `catch` is deliberate, but for a plain reason rather than a specific
 * failure: a pool is an optimization, `@gmod/bam` and `@gmod/tabix` both await
 * this, and anything going wrong here has to degrade to inflating in process
 * rather than break every read. A documented CJS-interop throw under jest was
 * the original motivation; that no longer reproduces (core's own suite, the
 * BamAdapter suites and jbrowse-web's Alignments suite all pass with the catch
 * removed), so keep it for the invariant, not the anecdote.
 *
 * ## Safe to pass unconditionally
 *
 * Returns a promise, and the libraries await it at the point of use rather than
 * at construction — which is what lets a synchronous `configure()` hand the
 * pending pool straight over. It resolves to `undefined` wherever Workers
 * cannot be created (node, jest), and `@gmod/bam` and `@gmod/tabix` then take
 * their in-process path, so no caller needs an environment check and the test
 * suites are unaffected.
 *
 * Needs no cross-origin isolation: each worker's range is transferred to it as
 * an ArrayBuffer rather than shared, so this works on an ordinary page. That
 * was the point of dropping SharedArrayBuffer in `@gmod/bgzf-filehandle` 6.4.0
 * — measured, the shared transport was at parity at best.
 */
export function sharedBgzfWorkerPool(): Promise<BgzfWorkerPool | undefined> {
  return import('@gmod/bgzf-filehandle')
    .then(m => m.getSharedWorkerPool())
    .catch(() => undefined)
}
