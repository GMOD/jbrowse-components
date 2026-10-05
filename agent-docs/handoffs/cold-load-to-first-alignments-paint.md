---
name: cold-load-to-first-alignments-paint
description: "A 2026-10-04 profile of jbrowse-web's cold load to a BAM or CRAM track's first paint. On small data the wait is serialized idle time, not bytes or a CPU hot spot. The 300ms Suspense reveal throttle, the render-RPC code's late discovery and CRAM's header-then-index order are fixed; left are ~117ms of diffuse main-thread work before the render request, and a synchronous WebGL2 shader compile at first draw. Deep windows are bound by one RPC worker."
---

# Cold load to first alignments paint

Measured 2026-10-04 on main `677a5d63db`: a production build with
`node products/jbrowse-web/scripts/build.ts --stats`, headless Chrome on an idle 24-core box, a fresh
browser context per cold load, medians of 3-5 interleaved runs. Colin agreed the
plan below the same day.

**Retake any number here** with
[`probe-coldload-phases.ts`](../../products/jbrowse-web/browser-tests/probe-coldload-phases.ts)
(page and worker trace, milestones, source-mapped CPU, `--arms=nothrottle` and
`--arms=suspense`) and
[`measure-load-latency.ts`](../../products/jbrowse-web/browser-tests/measure-load-latency.ts)
`"--only=one BAM" --latency=80 [--nothrottle] --waterfall`. The probe's
`--set=heavy` reads `build/bench/config.json` and the jb2bench corpus copied
beside it. **A/B two builds by alternating whole invocations** (`--runs=1`,
swapping `build/` between them) and swap the order once: on a laptop carrying
other agents, a 100 ms difference flipped sign with the order.

## Where a small load goes

`volvox_bam` cold on a local server, drawn at 812 ms, before `c223294d1d`
removed the 145-354 ms idle stretch (the InitialLoad throttle; 580 ms on ada
after it). A launching track now also loads its display's render-RPC code
beside its adapter's (`RpcMethodType.preload`, `DisplayType.rpcMethods`), which
took one round trip off each `measure-load-latency` scenario at 80 ms RTT.

- 0-60 ms: HTML, `main.js` and the config; the prewarmed worker starts.
- 60-145 ms: the first chunks evaluate.
- 145-354 ms: idle, nothing in flight.
- 354-555 ms: plugin chunks (page and worker in one round) and the session.
- 555-713 ms: assembly, refNames, display chunks.
- 713-812 ms: fetch, render and the first draw.

Boot CPU is diffuse: the costliest app function, `loadSessionSpec`, is 21 ms
inclusive, so the main-thread boot has no hot spot to optimize.

## Plan

### 1. Shorten the main-thread chain before the render request

The header reads no longer wait a round trip on their index: CRAM's
`readSamHeader` reads header and `.crai` together, and `@gmod/bam` 10.0.4
reads the first bgzf block beside the index and awaits both.

On ada each took 195-200 ms off one track at 200 ms RTT and about nothing at
80 ms, because a second chain is now as long: the assembly's `.2bit` read, then
~117 ms of main-thread work before the render request goes out. That work is
diffuse (probe `inclusive` over the window): `launchTrackGeneric` 21 ms
inclusive, forced layout in `useScrollPortOverflow` and `useChromeHeightVar`
~14 ms, then the alignments display's layout getters (`sections`, `lanes`,
`scrollContentHeight`) and React's first render of the track. Worth checking
whether the fetch autorun can run before React renders the display rather
than after it.

### 2. Compile WebGL2 shaders before the first draw

[`webgl2Hal.ts`](../../packages/render-core/src/hal/webgl2Hal.ts) links every
pass on first draw and reads `COMPILE_STATUS` right after `compileShader`, so
the compile runs synchronously in the draw task after the data arrives: 158-167
ms of it under SwiftShader. The WebGPU HAL already uses
`createRenderPipelineAsync`. The candidate: issue compile and link for every
declared pass when the HAL is created, while data is still in flight, and query
status at first use (`KHR_parallel_shader_compile` where present). **Needs a
headed real-GPU number first**: the SwiftShader figure does not show what a
user's driver costs.

### 3. Decide whether deep windows parallelize the parse

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

The first draw's main-thread task was 546 ms: shader compile (item 2), about
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

### 4. Minor

The BGZF pool (BAM) and the CRAM slice pool each start four workers for volvox
files of 140-400 KB, 4-31 ms of CPU each and off the critical path.

## Not worth chasing here

The pileup display's Suspense boundary (`AlignmentsTooltip`) shows a fallback
on every BAM and CRAM load, but its reveal lands with the first draw and the
`nothrottle` arm does not beat `base`, so it does not hold the paint. Its chunk
is the main-thread request that starts late in the 80 ms waterfall, beside the
render request rather than ahead of it.

Bytes: the cold shell is 902 KB gzipped in 56 chunks, a BAM track adds 153 KB
in 31, and a warm load that downloads nothing still pays item 1.
`source-map-js` arrives through the runtime re-export registry whenever a config
names a plugin, which [EAGER_BUNDLE.md](../reference/EAGER_BUNDLE.md) records
and declines, as
[ADR-043](../architecture-decision-records/adr-043-rpc-workers-carry-ui-code.md)
does for the worker's UI code.
