import { SharedBudget } from '@gmod/shared-read-cache'

/**
 * Ceilings on what the indexed-format libraries retain, shared by every adapter
 * in this JS context — so one per RPC worker, plus one on the main thread,
 * which is the scope that actually runs out of memory.
 *
 * ## Why these are not per file
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
 * ## The numbers are not new
 *
 * Both are the libraries' own per-file defaults, moved from per-file to
 * per-context. That makes this a strict tightening — retention can only fall —
 * and avoids inventing a number that would need its own justification. The
 * budget still has to clear one query's working set or the cliff returns, and
 * on that workload 512 MB shared across three tracks already cost 43 refills
 * where 1 GB cost 4.
 *
 * ## Two budgets, because units cannot mix
 *
 * `SharedBudget.total` is a sum over its members, so they must all weigh in the
 * same unit. `@gmod/bam` and `@gmod/tabix` weigh decompressed bytes;
 * `@gmod/cram` weighs decoded records, because a decoded record has no cheap
 * size. A single budget spanning them would add records to bytes and bound
 * neither. `sizeOf` is opaque, so nothing can catch that at runtime — hence two
 * budgets named for their units.
 */
export const decompressedBytesBudget = new SharedBudget(1024 * 2 ** 20)

/** See {@link decompressedBytesBudget}. Records, not bytes — CRAM only. */
export const decodedRecordsBudget = new SharedBudget(1_000_000)
