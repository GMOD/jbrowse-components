---
status: Accepted
summary: "@gmod/bam, @gmod/tabix and @gmod/cram each bound their parsed-chunk cache per file, and dataAdapterCache holds one file per open track, so the ceilings multiplied by track count with nothing bounding the sum — three deep alignments tracks browsing eight windows retained 1109 MB with every cache still well under its own 1 GB ceiling; the adapters now share one SharedBudget per JS context, in two of them because bytes and records cannot be summed"
---

# ADR-064: Parsed-chunk budgets are per worker, not per file

## Status

Accepted (2026-08). Requires `@gmod/shared-read-cache` 1.5.0, `@gmod/bam` 8.4.0,
`@gmod/tabix` 3.7.1, `@gmod/cram` 11.4.0.

## Context

[ADR-059](./adr-059-the-raw-chunk-cache-is-the-long-tail-layer.md) settled the
*raw* byte layer and noted the layer above it: every indexed format's library
keeps its own cache of parsed results, each with a per-file budget and a
three-minute idle sweep. Those budgets were sized against a single track panning
— below one query's working set a cache does not cache less, it caches nothing
(`@gmod/bam` ADR 0014) — so they are generous on purpose.

`dataAdapterCache` holds one adapter, and so one `BamFile` /
`TabixIndexedFile` / `IndexedCramFile`, per open track for the life of that
track. Nothing multiplied that out. Measured (`@gmod/bam` ADR 0018), three
moderately deep alignments tracks browsing eight 50 kb windows:

<!-- BEGIN GENERATED MEASUREMENT cache-budget-retention-climb -->

| window (of 8) | aggregate held |         RSS |
| ------------: | -------------: | ----------: |
|             0 |         303 MB |      567 MB |
|             3 |         610 MB |      994 MB |
|             7 |    **1109 MB** | **1665 MB** |

<!-- END GENERATED MEASUREMENT cache-budget-retention-climb -->

Still climbing at the end, and **every cache was well under its own 1 GB
ceiling** — so the ceiling was not what held the line, and nothing else was
either. Six tracks reached 1442 MB / 2250 MB RSS.

The idle timeouts cannot cover this by construction: they reclaim what has gone
quiet, and nothing is quiet while the reader is browsing. Browsing was exactly
the complaint.

## Decision

**One `SharedBudget` per JS context** — so one per RPC worker plus one on the
main thread — in `packages/core/src/util/cacheBudgets.ts`, passed by every
adapter that constructs one of these files.

The numbers are the libraries' own per-file defaults moved to per-context: 1 GB
and 1,000,000 records. That makes this a strict tightening, since retention can
only fall, and avoids inventing a number needing its own justification.

**Two budgets, because units cannot mix.** `SharedBudget.total` is a sum over
members, so they must weigh in the same unit. bam and tabix weigh decompressed
bytes; cram weighs decoded *records*, because a decoded record has no cheap
size. One budget spanning them would add records to bytes and bound neither, and
`sizeOf` is opaque so nothing catches it at runtime. Hence
`decompressedBytesBudget` and `decodedRecordsBudget`, named for their units.

## Rejected: divide each library's ceiling by the track count

The obvious fix, and worse than doing nothing. Three tracks, browse then pan
back, counting refills on the revisit:

<!-- BEGIN GENERATED MEASUREMENT cache-budget-per-file-split -->

| per-file budget | aggregate held | revisit refills |
| --------------- | -------------: | --------------: |
| 128 MB          |         348 MB |         **101** |
| 256 MB          |         609 MB |              30 |
| 512 MB          |         918 MB |               8 |
| 1024 MB         |        1109 MB |               0 |

<!-- END GENERATED MEASUREMENT cache-budget-per-file-split -->

The cold pass was 98 refills, so 128 MB — what eight tracks under a gigabyte
would each get — is worse than having no cache at all. The divisor is the thing
that makes each share too small. A shared budget has no such failure, because a
member yields only what is globally least-recently-used: tracks the reader is
not looking at hand their space to the one being panned, so the active track
keeps a whole working set however many are open. At an equal aggregate ceiling
it held 1024 MB for 4 refills where the split held 773 MB for 16.

## Consequences

- **Inert until it binds.** At two and four open tracks, shared and per-file
  measured identical — same retention, same refill counts. It is a ceiling, not
  an allocation.

- **Bounding costs re-reads.** Six tracks under a shared gigabyte cost 33
  revisit refills against 0. That is the trade, and it is the point.

- **RSS moves less than retention.** 1442 → 989 MB held is 31%; 2250 → 1984 MB
  RSS is 12%. The rest is transient, `@gmod/bgzf-filehandle`'s grow-only
  module-global wasm memory among it — see `REJECTED_IDEAS.md`, which already
  identifies that as the source of the hundreds-of-MB peaks. No cache budget
  touches it, and it is the next thing to look at if crashes persist.

- **Members are held weakly.** `SharedBudget` keeps a `WeakRef` per member, so
  a budget living as long as its worker can never be why a closed track stays
  reachable — which would be a leak of exactly the kind this exists to prevent,
  and would have undone `b4a353c163`'s adapter eviction.

## A silent 50 MB that this replaces

Nine tabix adapters passed `chunkCacheSize: 50 * 2 ** 20`, a line predating
2020. In `@gmod/tabix` v3.5.2 that parameter stopped being divided by 64 KB to
get an entry count and became real decompressed bytes — shipped as a patch, with
no rename, so the value silently went from 800 whole chunks (unbounded in
practice) to a 50 MB budget, twenty times under the library default.

Measured on `tabix-js/test/data/1kg.chr1.subset.vcf.gz`, six windows stepping
and doubling back: **47 refills out of 47** on the warm pass against 0 at the
default, 7348 ms against 1513 ms, while holding 82.7 MB in a single entry — over
the budget it was given, because the last settled entry is kept regardless. At a
10 kb window (15.8 MB compressed, inside the 30 MB `fetchSizeLimit` the SV demo
ships) it was 16/16 against 0. Sparse files measured bit-identical at both
budgets, so the override was doing nothing on the tracks it did not break.

Those nine call sites now pass `chunkCacheBudget` instead. The lesson worth
keeping is that the bug was found by checking a *unit*, not by reading the code.

## Re-running the measurements

`@gmod/bam` ADR 0018 §Methodology: `~/src/jb2bench/data`, `LocalFile`, and
`cacheIdleTimeoutMs: 0` so the idle sweep cannot be mistaken for the budget
working. Working sets must be measured with the budget off, or `totalSize`
reports what survived eviction rather than what the query needed.
