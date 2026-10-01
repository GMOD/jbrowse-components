---
name: perf-instrumentation
description: Instrumentation for GPU render and scroll jank, and a mobx.spy render census in jsdom that answers which components re-render per frame with no browser. Read when diagnosing a perf regression, before reaching for a CPU profile.
kind: operations
---

# Perf instrumentation patterns

How to diagnose "is the GPU rendering slow / why is scroll choppy" without
guessing. Probes are temporary: gate each on a `?gpu-perf=1` URL flag, and strip
them before landing while keeping the fixes.

## Render counts need no browser

`mobx-react-lite` names every observer's reaction `observer<ComponentName>`, and
`Reaction.track` wraps the render itself, so `mobx.spy()` filtered to
`type: 'reaction'` is a per-component render count in jsdom.
`products/jbrowse-web/src/tests/renderCensus.ts` is the helper and
`ZoomRenderCensus.test.tsx` drives it (`ZOOM_CENSUS=1` prints per-component
tables). Use it before a CPU profile whenever the question is counts rather than
wall time. [INTERACTION_PERF.md](INTERACTION_PERF.md) carries its two limits (a
count is a floor, and only the view-geometry half is deterministic) and the
rules that came out of it.

## Layers to time, one at a time

The synteny pipeline runs: mousemove or wheel, then `panStack` / the wheel zoom
controller, then one action moving `offsetPx` / `bpPerPx` on every row, then
the render autorun, `backend.renderBlocks`, and the HAL frame, with
`observer()` re-renders flushing alongside. The slow layer is the bottleneck.

**The synteny drag path has no rAF, deliberately.** `panStack` runs on every
mousemove, which already arrives at ~60 Hz, and the action is what coalesces the
views a stack drives. The rAF-coalesced path is `useRafCommit`
(`VerticalScrollbar.tsx`'s `flushScroll`), reached by dragging a scrollbar.

1. **HAL ops.** Wrap `writeUniforms`, `drawPass`, `bindAttributes` and
   `beginFrame`/`endFrame` in `performance.now()` deltas, accumulate in private
   fields, log averages every 60 frames.
2. **Render dispatch gap.** Track min and max wall time between consecutive
   `render()` calls. A 7 ms min with a 200 ms max means something is gating the
   renderer, not the GPU.
3. **Autorun fire counters.** Count fires and total time per autorun in
   `attachRenderingBackend`. An upload autorun firing 60x/sec with unchanged data
   is the refetch-storm symptom.
4. **Main-thread blocks, cross-browser.** `PerformanceObserver` `longtask` is
   Chrome-only. Poll with a self-rescheduling `setTimeout(poll, 4)` and warn when
   the gap exceeds 50 ms. GC pauses and compositor stalls in other threads do not
   show; use the Firefox Profiler for those.
5. **offsetPx cycle and React flush.** An autorun on `view.offsetPx` records the
   time between changes, plus a microtask delta for the React commit. A ~40 ms
   cycle with ~1 ms flush means React is fast and wheel arrival gates the cycle.
6. **Dependency diff.** When an autorun fires unexpectedly, cache the previous
   dep values in closure variables and log which changed. This names the
   offending dep directly.
7. **RPC reference equality.** Log the previous and new `instanceData` reference
   in `setRpcData`. `REF NEW` with equal counts on every scroll means the RPC
   reruns and returns identical content in a fresh object.

## Findings worth knowing

- **Wheel-event rate caps render fps.** A mouse wheel emits ~28 events/sec, one
  rAF each, so perceived rate stays ~28 fps however fast the renderer is.
  Escaping that needs a wider-than-viewport canvas CSS-translated during scroll;
  not built.
- **A fetch autorun that tracks `offsetPx`/`bpPerPx` is the top GPU-path
  footgun.** `installComparativeFetchAutorun`
  (`LinearSyntenyDisplay/afterAttach.ts`) reads them through `untracked()`, so the
  worker sees current values for culling without scroll triggering a refetch of
  identical content in new references.
- **Overdraw drives bounding-quad shaders.** One axis-aligned bbox per ribbon
  gave ~150x overdraw on slanted thin ribbons; the tessellated trapezoids in
  `syntenyFillCurve.slang` cut it ~11x.
- **Uniform writes, VAO setup and React reconciliation are cheap.** Don't
  optimize them first; measure before suspecting a React commit.
- **`console.warn` in a hot getter costs real time** when an observable cascade
  trips it. Strip guard warnings from hot paths.

## Measuring on a contended box

Other agents run `tsc` concurrently, so load average often sits at 60-80 on 16
cores. That invents or erases results: a sequential before/after reported a
babel change as a 2.2x win that an interleaved A/B put at zero.

- Check `uptime` before believing anything.
- Interleave the arms and take medians; never run all of A then all of B.
- Warm both variants before timing an in-process benchmark.
- `website/scripts/ab-compare.ts` interleaves two prebuilt `build/` trees.

Contention can also compress a ratio: the GTF scanner measured 1.65-1.78x at
load ~30 and 1.71-2.12x at load ~4, because the allocation-heavy arm is already
GC-bound. Read a ratio measured under load as a floor, and take the median of
per-round paired ratios rather than a ratio of medians, which lets drift between
two long runs into the answer.

## Decoding a Firefox profile export offline

For `preprocessedProfileVersion: 66`:

- The tables live under `d['shared']` (`stackTable`, `frameTable`, `funcTable`,
  `stringArray`), not per thread.
- `stackTable` has `prefixOffset`, not `prefix`:
  `prefix(i) = None if prefixOffset[i] == 0 else i - prefixOffset[i]`.
- Self time is the frame at the sample's own stack, weighted by
  `samples.timeDeltas`. A raw sum spans idle gaps.
- The JBrowse content process is not thread 0; scan every thread's `funcTable`
  for app symbols.
- Dev builds carry React-only work (`validateProperty`, `warnUnknownProperties`,
  `jsxDEVImpl`, ~7% of JS self time) that production lacks. Rank targets by self
  time in our own code, not inclusive component time.

## Startup profiling harnesses

All in `website/scripts/`, all running the built bundle:

- `profile-app.ts`: CDP CPU profile of the main thread and every worker across
  cold load, warm load and a pan/zoom burst; `profile-resolve.ts` maps self time
  to source through sourcemaps.
- `probe-startup.ts`: counters for programs linked, GL contexts, workers, blob
  URLs and sync XHRs.
- `ab-compare.ts`: interleaved A/B of two `build/` trees with a pixel diff.

**Shader compilation dominated first paint, and laziness fixed it.** `webgl2Hal`
compiles a pass on its first draw (`getPass`). Deferring the link-status check is
not the fix: the first `useProgram` forces the driver to finish anyway, and
`KHR_parallel_shader_compile` buys little for a program used at once. Compile
fewer programs.

**Shrinking the RPC worker pool is not a win; don't retry it.** Forcing
`rpc.workerCount: 1` was a wash, because worker boots overlap off the critical
path and heavy datasets are where the pool earns its keep.

## Cancellation and worker UI code

Cancellation is an `AbortSignal`; ADR-056 and ADR-122 record why the
`SharedArrayBuffer` and revoked-blob-XHR mechanisms went.
`website/scripts/cancel-mechanism-bench.ts` is the bench to re-run before
touching `createAbortBreakpoint`.

RPC workers parse UI code they never run, because every worker entry statically
imports every plugin index. ADR-043 records the measurement, why a
`splitChunks` cacheGroup or a partial pass does not help, and the campaign.
`node scripts/check-worker-imports.ts --causes` is its worklist.
