---
title: Memory and retention
description:
  What a browsing session holds on to, which ceiling bounds each layer, and the
  ones nothing bounds
guide_category: Advanced topics
---

**TL;DR:** Every ceiling on what JBrowse retains is scoped to a JS context, not
to a file, because a per-file ceiling multiplies by the open track count and
bounds nothing. Those ceilings bound retained bytes; a tab's peak is made of
things they do not reach.

[](/docs/developer_guides/optimizations) is where a track's _time_ goes. This
page is what stays resident afterwards.

## What retains

| layer                        | unit                        | scope         | bounded by                 |
| ---------------------------- | --------------------------- | ------------- | -------------------------- |
| `RemoteFileWithRangeCache`   | compressed bytes            | module        | its size and idle timeout  |
| the parser's own chunk cache | decompressed bytes          | JS context    | `decompressedBytesBudget`  |
| the CRAM record cache        | decoded records             | JS context    | `decodedRecordsBudget`     |
| `rpcDataMap`                 | one region's packed columns | display model | the regions the view shows |
| GPU buffers                  | uploaded vertex data        | display       | per-object guards only     |

The two named budgets live in `packages/core/src/util/cacheBudgets.ts`.

## A per-file ceiling is not a bound

`@gmod/bam`, `@gmod/tabix` and `@gmod/cram` each take a per-file budget, and
`dataAdapterCache` holds one adapter per open track, so those ceilings multiply
with nothing summing them. Three moderately deep alignments tracks over eight
windows, every cache still well under its own 1 GB ceiling throughout:

<!-- BEGIN GENERATED MEASUREMENT cache-budget-retention-climb -->

| window (of 8) | aggregate held |         RSS |
| ------------: | -------------: | ----------: |
|             0 |         303 MB |      567 MB |
|             3 |         610 MB |      994 MB |
|             7 |    **1109 MB** | **1665 MB** |

<!-- END GENERATED MEASUREMENT cache-budget-retention-climb -->

The idle timeouts cannot cover this: they reclaim what has gone quiet, and
nothing is quiet while the reader browses. So both budgets are **one
`SharedBudget` per JS context** — one per RPC worker plus one on the main
thread.

### Dividing by the track count is worse than doing nothing

Same three tracks, browsing then panning back, counting refills on the revisit:

<!-- BEGIN GENERATED MEASUREMENT cache-budget-per-file-split -->

| per-file budget | aggregate held | revisit refills |
| --------------- | -------------: | --------------: |
| 128 MB          |         348 MB |         **101** |
| 256 MB          |         609 MB |              30 |
| 512 MB          |         918 MB |               8 |
| 1024 MB         |        1109 MB |               0 |

<!-- END GENERATED MEASUREMENT cache-budget-per-file-split -->

The cold pass cost 98 refills, so the smallest share is worse than no cache at
all: the divisor makes each share too small to hold one working set. A shared
budget yields only what is globally least-recently-used, so idle tracks hand
their space to the one being panned.

Two budgets rather than one, because `SharedBudget.total` sums over its members
and cram weighs decoded records where bam and tabix weigh bytes.

## What no budget bounds

- **Reads in flight.** Eviction never touches an unsettled read.
- **A query's working set.** It holds every chunk it parsed until it returns.
- **Records that grow after weighing.** `end`, `CIGAR` and `tags` memoize onto a
  record when a renderer first reads them.
- **Grow-only wasm memory.** `@gmod/bgzf-filehandle`'s module-global heap never
  shrinks, and is the source of the hundreds-of-MB peaks.

Across six tracks, bounding retention moved held bytes 31% and RSS 12%. Bound
total memory somewhere that can see the whole process.

## GPU memory is guarded per object, not per session

Nothing sums uploaded bytes across displays, so OOM there is reportable rather
than preventable; both backends route through `OomReporter` to a
zoom-in-or-reduce-height message. WebGPU refuses past the adapter's own
`maxBufferSize`, WebGL2 past a fixed 256 MiB, so a region can banner on WebGL2
while rendering on WebGPU.

The largest allocation is not the data: `WebGPUHal` holds one 4x MSAA color
attachment per display, sized from canvas area, so an empty tall track costs
what a full one does — 79.2 MiB for one, counted nowhere. How many GPU displays
a page can open at all is a separate ceiling,
[](/docs/developer_guides/creating_gpu_display#the-webgl2-context-ceiling).

[ADR-064](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/architecture-decision-records/adr-064-parsed-chunk-budgets-are-per-worker-not-per-file.md)
owns every measurement here.
[ARCHITECTURAL_LIMITS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/ARCHITECTURAL_LIMITS.md)
is the live register of the ceilings, each with the condition that retires it.
