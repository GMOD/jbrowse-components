---
name: cold-load-profile
description: "What does jbrowse-web's cold load to a BAM or CRAM track's first paint wait on (2026-10-04)? Small loads wait on serialized idle time, repeat visits on CPU and GPU, deep windows on one RPC worker. Shader compile and Suspense were measured and declined."
kind: measurement
---

# Cold load to first alignments paint

Measured 2026-10-04 on main `677a5d63db`: a production build with
`node products/jbrowse-web/scripts/build.ts --stats`, headless Chrome on an idle
24-core box, a fresh browser context per cold load, medians of 3-5 interleaved
runs.

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
after it). A launching track now also loads its display's render-RPC code beside
its adapter's (`RpcMethodType.preload`, `DisplayType.rpcMethods`), which took one
round trip off each `measure-load-latency` scenario at 80 ms RTT. CRAM's
`readSamHeader` reads header and `.crai` together, and `@gmod/bam` 10.0.4 reads
the first bgzf block beside the index.

- 0-60 ms: HTML, `main.js` and the config; the prewarmed worker starts.
- 60-145 ms: the first chunks evaluate.
- 145-354 ms: idle, nothing in flight.
- 354-555 ms: plugin chunks (page and worker in one round) and the session.
- 555-713 ms: assembly, refNames, display chunks.
- 713-812 ms: fetch, render and the first draw.

Boot CPU is diffuse: the costliest app function, `loadSessionSpec`, is 21 ms
inclusive, so the main-thread boot has no hot spot to optimize.

The header-beside-index reads took 195-200 ms off one track at 200 ms RTT and
about nothing at 80 ms, because a second chain is now as long: the assembly's
`.2bit` read, then ~117 ms of main-thread work before the render request goes
out. That work is diffuse (probe `inclusive` over the window):
`launchTrackGeneric` 21 ms, forced layout in `useScrollPortOverflow` and
`useChromeHeightVar` ~14 ms, then the alignments display's layout getters
(`sections`, `lanes`, `scrollContentHeight`) and React's first render of the
track. The remaining move is
[start-the-fetch-before-react-renders-the-display](../ideas/ready/start-the-fetch-before-react-renders-the-display.md).

## Code-discovery rounds

At 80 ms RTT a cold load found its code in six serial rounds: the HTML,
`main.js`, the Loader group and worker, the re-export registry when the config
names a plugin, the view's chunks, then the display's.
`HtmlPreloadPlugin` (`products/jbrowse-web/scripts/config.ts`) names the Loader
group and the worker's chunks in the HTML, so they download beside `main.js`.
Measured 2026-10-08 on `c69bf194f6`, one build with the links stripped or kept,
medians of 5-9 interleaved cold loads on ada. One BAM track: 1116 ms to 1035 ms
at 80 ms RTT, 2040 to 1894 at 200 ms, 735 to 721 at 20 ms and 664 to 643 with
no latency. At 80 ms the four-track session went from 1267 ms to 1178 and the
hg38 hub from 1311 to 1224.

Declined: preloading the linear genome view's component and the workspace
container as well. It measured no faster at any RTT (1043 and 1023 ms against
1035), because the view's UI is not on the path to the first data request.

Preloading every chunk a BAM load uses took a further ~140 ms off at 80 ms RTT
in an injected-link experiment, so three levers remain:

- **The assembly's sequence adapter chunks.** Preloading the TwoBit, Cytoband
  and FromConfig adapters moved the page's first data read from 755 ms to 627 ms
  and ready by 36 ms (62 ms at 200 ms RTT). The adapter depends on the config,
  so the real fix is starting the assembly load when the config arrives, not a
  static link.
- **The re-export registry.** Its 37 chunks are requested ~90 ms after the
  config arrives, once the Loader group has evaluated; `earlyStart.ts` could
  start the import when the prefetched config text names a plugin.
- **The plugin store manifest.** On a hub, config, `plugin-store/v2/plugins.json`
  (181 ms, 2.75 KB, `no-cache`), each plugin's entry and its chunks are four
  serial rounds.

## Repeat visits

A returning user's load is CPU and GPU, not network: `static/` is immutable,
config and data files carry only `Last-Modified` on jbrowse.org so browsers reuse
them heuristically, and `index.html` revalidates for one round trip.
`measure-load-latency.ts --warm` at 80 ms RTT on ada: one BAM track ready in
0.36 s against 1.11 s cold, the 11-track session (`"--only=11 tracks"`) in 0.65 s
against 1.25 s. What grows with track count on the WebGL2 rung is one context and
one set of programs per display, recorded in
[cut-webgl2-contexts-per-display](../ideas/waiting-on-someone-else/cut-webgl2-contexts-per-display.md).

## Deep windows

100x short reads over 1 Mb, BAM: drawn at 3.96 s, and the render worker was busy
2.6 s of it. Inclusive:

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

The first draw's main-thread task was 546 ms: shader compile, about 155 ms of
`sortLayout`, then packing and `createBuffer`. Each worker line is a 3-7% cut;
only splitting one region's parse across the RPC pool gives 2x or more
([split-one-regions-parse-across-the-rpc-pool](../ideas/waiting-on-a-call/split-one-regions-parse-across-the-rpc-pool.md)).
The other heavy cells, mount to drawn: 200x at 100 kb 1.1 s BAM / 1.0 s CRAM;
1000x at 19 kb 1.06 s / 0.93 s; 200x long reads at 19 kb 0.97 s / 0.70 s.

## Measured and declined

The WebGL2 shader compile at first draw. In headed Chrome on an Intel UHD 630 it
is 145-213 ms on a first visit and 19-26 ms once Chrome's shader cache holds the
programs; Firefox Nightly's WebGPU creates its 17 pipelines asynchronously in
2-35 ms each, off the critical path. Starting every pass's compile when the HAL
is created was a loss, recorded in `webgl2Hal.ts`.

The pileup display's Suspense boundary (`AlignmentsTooltip`) shows a fallback on
every BAM and CRAM load, but its reveal lands with the first draw and the
`nothrottle` arm does not beat `base`, so it does not hold the paint. Its chunk
is the main-thread request that starts late in the 80 ms waterfall, beside the
render request rather than ahead of it.

The BGZF pool (BAM) and the CRAM slice pool each start four workers for volvox
files of 140-400 KB, 4-31 ms of CPU each and off the critical path.

Bytes: the cold shell is 902 KB gzipped in 56 chunks, a BAM track adds 153 KB in
31, and a warm load that downloads nothing still pays the main-thread chain.
`source-map-js` arrives through the runtime re-export registry whenever a config
names a plugin, which [EAGER_BUNDLE.md](EAGER_BUNDLE.md) records and declines, as
[ADR-043](../architecture-decision-records/adr-043-rpc-workers-carry-ui-code.md)
does for the worker's UI code.
