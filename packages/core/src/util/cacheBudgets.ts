import { SharedBudget } from '@gmod/shared-read-cache'

/**
 * The ceiling on what the indexed-format libraries retain, shared by every
 * adapter in this JS context — so one per RPC worker, plus one on the main
 * thread, which is the scope that actually runs out of memory.
 *
 * ## Why this is not per file
 *
 * `@gmod/bam`, `@gmod/tabix` and `@gmod/cram` each take a per-file budget,
 * sized so that a single track panning never falls off the cliff where a cache
 * smaller than one query's working set stops caching entirely (`@gmod/bam` ADR
 * 0014). But `dataAdapterCache` holds one adapter — and so one `BamFile`, one
 * `TabixIndexedFile`, one `IndexedCramFile` — per open track for the life of
 * that track, so a per-file ceiling is multiplied by the track count and
 * nothing bounds the sum.
 *
 * Measured in `@gmod/bam` ADR 0018: three moderately deep alignments tracks
 * browsing eight windows retained 1109 MB at 1665 MB RSS, still climbing, with
 * **every cache well under its own 1 GB ceiling** — so the ceiling was not what
 * held the line, and nothing else was either. Six tracks reached 1442 MB. The
 * idle timeouts cannot help here by construction: they reclaim what has gone
 * quiet, and nothing is quiet while the reader is browsing.
 *
 * Dividing each library's ceiling by the track count is the obvious fix and it
 * is worse than doing nothing: at 128 MB per file — eight tracks under a
 * gigabyte — the same workload cost 101 refills on the revisit against 98 for
 * the cold pass. A shared budget has no such failure, because a member yields
 * only what is globally least-recently-used: tracks the reader is not looking
 * at hand their space to the one being panned, so the active track keeps a
 * whole working set however many are open.
 *
 * ## The number is not new
 *
 * 1 GB is the libraries' own per-file default (`DEFAULT_MAX_CACHE_BYTES` in
 * both `@gmod/bam` and `@gmod/cram`), moved from per-file to per-context. That
 * makes this a strict tightening — retention can only fall — and avoids
 * inventing a number that would need its own justification. With one file open
 * the two ceilings coincide; from the second file on, this one is the one that
 * binds. The budget still has to clear one query's working set or the cliff
 * returns, and on that workload 512 MB shared across three tracks already cost
 * 43 refills where 1 GB cost 4.
 *
 * ## One budget, because every member weighs bytes
 *
 * `SharedBudget.total` is a sum over its members, so they must all weigh in the
 * same unit, and `sizeOf` is opaque, so nothing could catch a mismatch at
 * runtime. `@gmod/bam` and `@gmod/tabix` weigh decompressed bytes, and since 14
 * `@gmod/cram` weighs a decoded slice by `DecodedSlice.byteLength` — its typed
 * columns exactly and its strings by estimate, within 1–8% of the measured heap
 * (its ADR 0013). Before that a CRAM slice weighed its record count, which is
 * why this used to be two budgets named for their units: a million records
 * could not be added to bytes, and never bound long-read data either, where a
 * 6 MB slice counted as 37.
 */
export const decompressedBytesBudget = new SharedBudget(1024 * 2 ** 20)
