import { getSharedWorkerPool } from '@gmod/bgzf-filehandle'

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
  return getSharedWorkerPool()
}
