---
name: cold-load-to-first-alignments-paint
description: "A 2026-10-04 profile of jbrowse-web's cold load to a BAM or CRAM track's first paint. On small data the wait is serialized idle time, not bytes or a CPU hot spot: React's 300ms Suspense reveal throttle at InitialLoad, three serial round trips between session and data, and a synchronous WebGL2 shader compile at first draw. Deep windows are bound by one RPC worker. Plan agreed with Colin; nothing started."
---

# Cold load to first alignments paint

Measured 2026-10-04 on main `677a5d63db`: a production build with
`node scripts/build.ts --stats`, headless Chrome on an idle 24-core box, a fresh
browser context per cold load, medians of 3-5 interleaved runs. Colin agreed the
plan below the same day; nothing in it has started.

**Retake any number here** with
[`probe-coldload-phases.ts`](../../products/jbrowse-web/browser-tests/probe-coldload-phases.ts)
(page and worker trace, milestones, source-mapped CPU, `--arms=nothrottle` and
`--arms=suspense`) and
[`measure-load-latency.ts`](../../products/jbrowse-web/browser-tests/measure-load-latency.ts)
`--only=volvox, one --latency=80 [--nothrottle] --waterfall`. The probe's
`--set=heavy` reads `build/bench/config.json` and the jb2bench corpus copied
beside it.

## Where a small load goes

`volvox_bam` cold on a local server, drawn at 812 ms:

- 0-60 ms: HTML, `main.js` and the config; the prewarmed worker starts.
- 60-145 ms: the first chunks evaluate.
- **145-354 ms: idle**, nothing in flight. Item 1.
- 354-555 ms: plugin chunks (page and worker in one round) and the session.
- 555-713 ms: assembly, refNames, display chunks. Item 2.
- 713-812 ms: fetch, render and the first draw.

Boot CPU is diffuse: the costliest app function, `loadSessionSpec`, is 21 ms
inclusive, so the main-thread boot has no hot spot to optimize.

## Plan

### 1. Commit no Suspense fallback at the app's top boundary

React 19 holds a retry-lane commit until 300 ms after the last fallback commit
(`globalMostRecentFallbackTime + 300 - now()` in `react-dom-client`).
[`InitialLoad.tsx`](../../products/jbrowse-web/src/InitialLoad.tsx) wraps the
lazy `Loader` in `<Suspense fallback={<Loading />}>`, so the first commit shows
`Loading` and the app's reveal waits out the remainder. In a trace it is a
`TimerInstall` of 200-300 ms from `performWorkOnRoot`.

Collapsing the throttle page-side (`--arms=nothrottle`) moved BAM cold
803 → 576 ms, BAM warm 545 → 279 ms, CRAM cold 847 → 615 ms, the empty LGV warm
446 → 164 ms; at 80 ms RTT BAM 1.35 → 1.24 s and CRAM 1.40 → 1.30 s. The
`suspense` arm names the boundary: shown at 56 ms, revealed at 359 ms. The
tracks-container and pileup boundaries also show fallbacks, but other updates
flush their reveals early.

The fix: start the `Loader` import in
[`earlyStart.ts`](../../products/jbrowse-web/src/earlyStart.ts) and show
`Loading` through plain state until it resolves, so no fallback is ever
committed. That is the direction `lazyWithPreload` and `ada2693d40`,
`53745aedd5`, `f24f8e8adb` already took for child chunks. **Done when** the
`nothrottle` arm no longer beats `base`. Check the jbrowse-desktop and embedded
products for the same top-level shape, and re-read
[destroying-an-mst-tree-that-something-still-observes](../ideas/waiting-on-a-number/destroying-an-mst-tree-that-something-still-observes.md),
whose leak is also a Suspense boundary discarding a pass.

### 2. Overlap the three serial round trips between session and data

At 80 ms RTT each costs about 85 ms, BAM and CRAM alike:

- **The worker loads its render-RPC code on the first render call**: chunks
  holding `executeRenderAlignmentData.ts` and `interbaseCoverage.ts` (~175 KB
  source), after the byte estimate returns. The early worker already receives
  the plugin list through `hintPrewarmedWorker`
  ([`prewarmedWorker.ts`](../../products/jbrowse-web/src/prewarmedWorker.ts));
  naming the session's track or RPC types there would let it preload them.
- **The BAM header waits on the index.** `@gmod/bam` `getHeaderPre` awaits
  `index.parse()` only to size the first header read, and the range cache
  rounds that read to a 256 KB page anyway. Read the header beside the index
  and fall back to the sized read when it does not parse. That is a `@gmod/bam`
  change. For CRAM the order is reversed: the `.crai` (needed for the byte
  estimate) waits on the header.
- `NoTracksActiveButton` and `AlignmentsTooltip` load one after the other at
  display mount. Check whether either blocks the first paint before touching
  them.

### 3. Compile WebGL2 shaders before the first draw

[`webgl2Hal.ts`](../../packages/render-core/src/hal/webgl2Hal.ts) links every
pass on first draw and reads `COMPILE_STATUS` right after `compileShader`, so
the compile runs synchronously in the draw task after the data arrives: 158-167
ms of it under SwiftShader. The WebGPU HAL already uses
`createRenderPipelineAsync`. The candidate: issue compile and link for every
declared pass when the HAL is created, while data is still in flight, and query
status at first use (`KHR_parallel_shader_compile` where present). **Needs a
headed real-GPU number first**: the SwiftShader figure does not show what a
user's driver costs.

### 4. Decide whether deep windows parallelize the parse

100x short reads over 1 Mb, BAM: drawn at 3.96 s, and the render worker was
busy 2.6 s of it. Inclusive:

- `extractFeatureArrays` 608 ms (CIGAR 264, mismatches 261, read names 135)
- BGZF unzip 378 ms: 187 inflated in-thread beside the pool, plus 168 in
  `concatUint8Array` joining the inflated blocks
- coverage pipeline 309 ms
- `@gmod/bam` record parsing 285 ms
- GC 209 ms
- `seqFetchSpan` 120 ms
- `dedupeById` in
  [`filterChainFeatures.ts`](../../plugins/alignments/src/RenderAlignmentDataRPC/filterChainFeatures.ts)
  108 ms, against its comment's "nearly free"

The first draw's main-thread task was 546 ms: shader compile (item 3), about
155 ms of `sortLayout`, then packing and `createBuffer`. Each worker line above
is a 3-7% cut. Only splitting one region's parse across the RPC pool could give
2x or more, and that is a design decision to weigh against
[ADR-053](../architecture-decision-records/adr-053-alignments-layout-stays-on-the-main-thread.md),
[CRAM_STACK_INTEGRATION.md](../reference/CRAM_STACK_INTEGRATION.md) §"Slice-decode
parallelism is not the lever",
[copies-between-each-parser-and-its-instance-buffer](../ideas/waiting-on-a-number/copies-between-each-parser-and-its-instance-buffer.md)
and [collections/alignments](../ideas/collections/alignments.md). The other
heavy cells, mount to drawn: 200x at 100 kb 1.1 s BAM / 1.0 s CRAM; 1000x at
19 kb 1.06 s / 0.93 s; 200x long reads at 19 kb 0.97 s / 0.70 s.

### 5. Minor

The BGZF pool (BAM) and the CRAM slice pool each start four workers for volvox
files of 140-400 KB, 4-31 ms of CPU each and off the critical path.

## Not worth chasing here

Bytes: the cold shell is 902 KB gzipped in 56 chunks, a BAM track adds 153 KB
in 31, and a warm load that downloads nothing still pays item 1.
`source-map-js` arrives through the runtime re-export registry whenever a config
names a plugin, which [EAGER_BUNDLE.md](../reference/EAGER_BUNDLE.md) records
and declines, as
[ADR-043](../architecture-decision-records/adr-043-rpc-workers-carry-ui-code.md)
does for the worker's UI code.
