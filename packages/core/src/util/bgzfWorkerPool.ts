import type { BgzfWorkerPool } from '@gmod/bgzf-filehandle'

/**
 * The BGZF inflate pool the indexed-format libraries decompress large chunks on,
 * one per JS context like `decompressedBytesBudget`: one per RPC worker plus one
 * on the main thread. BGZF decompression is 70-90% of a cold query (`@gmod/bam`
 * ADR 0003), and its blocks inflate independently.
 *
 * Holding it costs nothing. `@gmod/bgzf-filehandle` 6.7 starts the workers only
 * when a chunk of at least `POOL_MIN_DECOMPRESSED_BYTES` (0.4MB inflated)
 * arrives, inflates in process while they boot, and inflates in process for good
 * if one of them fails, so no read waits on a worker. What it is worth per
 * format, and why GFF3 and GTF go without it: reference/BGZF_WORKER_POOL.md.
 *
 * A function over a dynamic import because the library inlines its worker bundle
 * as a base64 string, and a static import pins it into every entry point that
 * can reach this helper: measured with esbuild, 23.4kb gzipped against 141b. Test
 * speed is not a reason either way; three jbrowse-web variant suites ran 13.887s
 * static against 13.856s dynamic.
 *
 * Resolves to `undefined` wherever Workers cannot be created (node, jest), which
 * keeps `@gmod/bam` and `@gmod/tabix` on their in-process path, and the `catch`
 * keeps anything else going wrong here on it too.
 */
export function sharedBgzfWorkerPool(): Promise<BgzfWorkerPool | undefined> {
  return import('@gmod/bgzf-filehandle')
    .then(m => m.getSharedWorkerPool())
    .catch(() => undefined)
}
