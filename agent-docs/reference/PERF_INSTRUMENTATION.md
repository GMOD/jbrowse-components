---
name: perf-instrumentation
description: Instrumentation patterns for GPU render and scroll jank, and the one question that needs no browser at all — a mobx.spy render census in jsdom answers "which components re-render per frame" in integers. Read when diagnosing a perf regression, and before reaching for a CPU profile to count renders.
---

# Perf instrumentation patterns

How to diagnose "is the GPU rendering slow / why is scroll choppy" without
guessing. The patterns below were validated against a real synteny scroll-jank
report on Firefox WebRender, whole-genome view, 15K instances. See "Findings"
at the bottom for what the investigation actually concluded.

## Activation

Gate every probe on a single URL flag so production stays quiet:

```ts
const perfLog =
  typeof window !== 'undefined' &&
  /(?:\?|&)gpu-perf=1\b/.test(window.location.search)
```

Reload with `?gpu-perf=1` to enable. Alternatively allow `window.DEBUG.gpuPerf = true`
in the devtools console (set it, then reload).

When tests fail or commits land, **strip the instrumentation** — keep the actual
fixes. Diagnostic logs are for the duration of an investigation, not forever.

## Counting React re-renders needs none of this

Everything below instruments a running browser. **"Which components re-render
per frame, and how many" does not need one**: `mobx-react-lite` names every
observer's reaction `observer<ComponentName>` and `Reaction.track` wraps the
render itself, so `mobx.spy()` filtered to `type: 'reaction'` is a per-component
render count in jsdom — integers, one run, ~20s, no build.
`products/jbrowse-web/src/tests/renderCensus.ts` is the helper and
`ZoomRenderCensus.test.tsx` drives it over a real multi-track session
(`ZOOM_CENSUS=1` for the per-component tables).

Reach for it before a CPU profile whenever the question is about render counts
rather than wall time. `agent-docs/reference/INTERACTION_PERF.md` carries what it
found, its two limits — a count is a FLOOR, and only the view-geometry half is
deterministic — and the three rules that came out of it.

## Layers worth measuring

The synteny render pipeline goes:

```
drag (mousemove on the synteny canvas)     wheel
  → dragPan(dx), synchronously               → createWheelZoomController
      ↓                                          ↓
  transaction(() => for each v: v.horizontalScroll(dx) / zoomTo(...))
    → offsetPx / bpPerPx change (MobX observable mutation)
      → autorun deps fire (renderState getter, etc.)
        → render autorun callback runs
          → GpuSyntenyRenderer.render(state)
            → hal.beginFrame / writeUniforms / drawPass / endFrame
      → mobx-react flushes observer() re-renders (React commit)
```

**There is no rAF in the synteny drag path, deliberately** — `dragPan`
(`LevelSyntenyCanvas.tsx`) flushes on every mousemove, since those already
arrive at ~60Hz and `transaction` is what coalesces the several views a stack
drives from one gesture. Don't go looking for a frame boundary to measure
across; the batching is the transaction. The rAF-coalesced path is the *LGV*'s
own side-scroll (`useSideScroll`'s `flushScroll`), which is a different pipeline
reached by dragging a track rather than the connector canvas.

Time each step independently. The slow one is the bottleneck.

### 1. HAL ops (WebGL2 / WebGPU)

Instrument every hot HAL call (`writeUniforms`, `drawPass`, `bindAttributes`,
`beginFrame`/`endFrame`) by wrapping in `performance.now()` deltas, accumulating
into private fields, and logging averages every N=60 frames:

```ts
writeUniforms(data: ArrayBuffer) {
  const t0 = this.perf ? performance.now() : 0
  // ...existing body...
  if (this.perf) {
    this.perfWriteUniformsMs += performance.now() - t0
    this.perfWriteUniformsCalls += 1
  }
}
```

In `endFrame`, log + reset the counters every 60 frames so the noise from a single
frame averages out:

```
[WebGL2Hal #1 perf] frame 0.05ms | drawPass 0.02ms (1.0 calls, 15265 insts) |
  bindAttrs 0.00ms (1.0 calls) | writeUniforms 0.02ms (1.0 calls)
```

### 2. Render dispatch interval (gap min/max)

The HAL only sees frames that fire. To detect "render isn't being called often
enough" or "render fires fast but with huge gaps," track wall-clock time **between
consecutive render() invocations**:

```ts
const now = performance.now()
if (lastRenderClockMs > 0) {
  const gap = now - lastRenderClockMs
  maxGap = Math.max(maxGap, gap)
  minGap = Math.min(minGap, gap)
}
lastRenderClockMs = now
// log min/max every 60 calls, then reset
```

`gap min ≈ 7ms`, `gap max = 200ms` means the renderer *can* run at 143fps but is
being **gated** somewhere — not the GPU.

### 3. Autorun fire counters

Track how often each autorun in `attachRenderingBackend` fires:

```ts
autorun(() => {
  const t0 = perfLog ? performance.now() : 0
  // ...callback body...
  if (perfLog) {
    fires += 1
    totalMs += performance.now() - t0
    if (now - lastLogMs > 2000) {
      console.warn(`[Lifecycle perf 2s] uploadAutorun fires=${fires}`)
      // reset
    }
  }
})
```

This catches "upload is firing 60×/sec even though data didn't change" — the
classic refetch-storm symptom.

### 4. Main-thread block detector (cross-browser)

`PerformanceObserver({entryTypes:['longtask']})` is **Chrome-only** as of
2026; Firefox throws `Ignoring unsupported entryTypes: longtask`. Use a
self-rescheduling `setTimeout(0)` poll instead — if its callback is delayed,
the main thread was blocked:

```ts
let lastTick = performance.now()
function poll() {
  const now = performance.now()
  const gap = now - lastTick
  if (gap > 50) {
    console.warn(`[MainThreadBlock] ${gap.toFixed(0)}ms gap at ${now.toFixed(0)}`)
  }
  lastTick = now
  setTimeout(poll, 4)
}
setTimeout(poll, 4)
```

This catches *any* JS block ≥ 50ms regardless of browser. GC pauses and compositor
stalls in another thread don't appear here — useful diagnostic boundary.

### 5. OffsetPx-change cycle + React-flush timing

To measure "from one scroll event to the next, what's the cycle time" without
caring which scroll handler fired (synteny canvas's wheel, LGV's wheel, drag,
arrow keys, …), put a MobX autorun on `view.offsetPx` itself:

```ts
addDisposer(self, autorun(() => {
  const now = performance.now()
  const offs = self.views.map(v => v.offsetPx)
  // ... track changes vs last snapshot ...
  const txMs = now - lastChange  // cycle time
  lastChange = now
  Promise.resolve().then(() => {
    const reactMs = performance.now() - now  // React-commit drain
    // record txMs + reactMs, log every 20 events
  })
}))
```

`tx median ≈ 40ms` with `react-flush ≈ 1ms` means **React is fast and the
cycle is gated by something else** (typically wheel-event arrival rate).

### 6. RPC dependency-change tracing

When an autorun fires unexpectedly, log *which dep changed*. Cache previous
values in closure variables and diff on each fire:

```ts
const changes: string[] = []
if (viewSnaps[0]!.offsetPx !== lastOffsetPx0) {
  changes.push(`offsetPx0:${lastOffsetPx0}→${viewSnaps[0]!.offsetPx}`)
  lastOffsetPx0 = viewSnaps[0]!.offsetPx
}
// ... repeat for each dep ...
console.warn(`[Fetch] autorun fire → deps changed: ${changes.join(' ')}`)
```

This is the single most useful pattern for finding "why is this autorun firing
on scroll when it shouldn't" — it directly identifies the offending dep.

### 7. RPC reference-equality check

When tracking down "is this re-firing because data changed, or just reference?":

```ts
setRpcData(featureData, instanceData) {
  if (perfLog) {
    const prev = self.instanceData
    console.warn(
      `[Display.setRpcData] instances ${prev?.count}→${instanceData?.count}` +
      ` instanceData REF ${prev === instanceData ? 'SAME' : 'NEW'}`,
    )
  }
  // ...
}
```

`REF NEW` with same instance counts on every scroll = the RPC is re-running and
producing identical-content-but-new-reference data. Either fix the fetch
to not refire, or short-circuit downstream when content is equal.

## Findings from the actual investigation (May 2026)

Recording these because future investigations will likely re-discover them.

1. **Wheel-event rate caps render fps**. Each wheel event → one rAF → one offsetPx
   update → one render. Typical mouse wheel emits ~28 events/sec. With the
   render itself at 0.1ms, perceived frame rate ≈ 28fps regardless of how much
   we optimize the renderer. Trackpads emit faster (~60-120Hz).

2. **Fetch-autorun deps are the #1 GPU-path footgun**. Synteny's
   `syntenyFetchAutorun` originally read `v.offsetPx` and `v.bpPerPx` directly
   in the deps phase, triggering a worker round-trip on every scroll (after
   500ms debounce) with **identical content but new references**. Downstream:
   `instanceData REF NEW` → `renderInstanceData` re-runs → upload autorun
   fires → `interleaveInstances` (1-2ms) + `bufferData` (per scroll). Fix:
   read those values via `untracked()` so the worker still sees current
   offsetPx/bpPerPx for viewport culling, but their changes don't trigger
   refetches. See `plugins/linear-comparative-view/src/LinearSyntenyDisplay/afterAttach.ts`.

3. **Per-frame uniform writes are batched & cheap**. WebGPU's ring buffer
   coalesces all writeUniforms into one `device.queue.writeBuffer` per frame
   (~50µs). WebGL2's bufferSubData per write is similar. Don't optimize this
   layer first.

4. **VAO setup is per-VAO, not per-draw**. The WebGL2 HAL has one VAO per pass,
   and `vertexAttribPointer` calls inside `bindAttributes()` re-set the VAO's
   stored attribute state on every draw. Measured cost: ~0.02ms per draw call
   on this hardware. Not significant for our case (1 draw call per track), but
   if you ever see this layer dominating, the fix is per-(pass, region) VAOs.

5. **Fragment-shader overdraw matters for bounding-quad geometry**. The
   single-axis-aligned-bbox approach to per-fragment bezier evaluation creates
   ~150× overdraw on slanted thin ribbons (a 1bp diagonal spanning 200px
   horizontally on a 200px-tall track produces ~42,600 fragments inside the
   bbox vs ~280 actual ribbon pixels). The 8-segment tessellated-trapezoid
   geometry reduces this ~11×. See `syntenyFill.slang`.

6. **React reconciliation is fast on modern React + MobX**. React-flush of
   <2ms even during scroll. If you're suspecting "React commits are slow,"
   measure first — usually it isn't.

7. **Firefox lacks `longtask` PerformanceObserver**. Use setTimeout(0) polling
   instead. Firefox GC pauses (50-200ms) don't show in either — those need
   the Firefox Profiler (`about:profiling`).

8. **`console.warn` in hot getters is real overhead**. The synteny renderParams
   getter originally had 4 guard-trip `console.warn` calls. Each fires on
   every observable-cascade in error paths. Strip these or keep only on debug.

## What the investigation could NOT fix

- Wheel-event arrival rate (hardware-limited).
- Firefox's occasional 50-200ms compositor/GC pauses during scroll
  (visible as `[MainThreadBlock]` but not from JS we control).
- React commit cost is dominated by `observer()`-wrapped components reading
  scroll-dependent state. Worth a follow-up audit if scroll perf is still a
  pain point after the GPU fixes.

To push past wheel-event-rate cap, the only architectural path is **decoupling
visual scroll from offsetPx updates** — render a wider-than-viewport canvas and
CSS-translate it during scroll, only re-rendering when offsetPx exits the
buffered region. Substantial change; not attempted in May 2026.

## Measuring on a contended box

This dev machine regularly sits at load average 60-80 on 16 cores, because other
agents run `tsc`/`tsgolint` concurrently. That is enough to invent or erase any
result you are likely to be chasing: the *same* cold jest run varied 18.6-25.9s
purely from contention.

A sequential before/after is therefore worthless here, and not just in theory —
a babel change was reported as a **2.2x win** off one, and an interleaved,
repeated A/B put the real difference at **zero**.

- Check `uptime` before you believe anything.
- Interleave the arms and take medians; never run all of A then all of B.
- For in-process benchmarks, warm *both* variants before timing. Running variant
  A first made it look 2x slower than B when the real gap was 8%.
- `ab-compare.ts` below does the interleaving for built bundles.

**Contention can also *compress* a ratio, not only add noise to it.** Worth
knowing because it makes a contended measurement feel safe: the number is
merely conservative rather than wrong, so it survives review and then
undersells the change. The GTF attribute scanner measured **1.65-1.78x** at load
28-36 and **1.71-2.12x** on the same corpus and harness at load ~4, with the
per-round spread tightening from 1.29-2.61x to 1.55-1.87x. Both arms slow down
under load, but the arm that allocates more is already GC-bound, so the extra
contention lands disproportionately on the faster one.

The safe reading: a ratio measured under load is a **floor**, not an estimate.
Take medians of *paired* rounds — each arm run back to back, ratio computed per
round — rather than a ratio of medians, which lets drift between two long runs
walk straight into the answer. Two consecutive ratio-of-medians runs of that
same GTF case disagreed 1.49x vs 2.46x; pairing inside the round is what made it
reproducible.

## Decoding a shared Firefox profile offline

Colin drops Firefox profiler exports (`~/Downloads/Firefox <date> profile.json.gz`)
to drive perf work. For `preprocessedProfileVersion: 66`:

- **The tables are shared across threads**, under `d['shared']` — `stackTable`,
  `frameTable`, `funcTable`, `stringArray` — not per-thread.
- **`stackTable` has no `prefix` column**, it has `prefixOffset`. Decode as
  `prefix(i) = None if prefixOffset[i] == 0 else i - prefixOffset[i]`. Verify by
  reconstructing one stack: it should read leaf→root with `js::RunScript` frames
  nesting.
- Self time is the frame at the sample's own stack index, weighted by
  `samples.timeDeltas`. A naive sum of `timeDeltas` is not wall time — it spans
  idle gaps.
- The content process running JBrowse is **not thread 0**. Find it by scanning
  every thread's `funcTable` for app symbols.

**These are dev builds, so subtract React's dev-only work before sizing a render
finding**: ~7% of JS self time is `validateProperty`, `warnUnknownProperties`,
`validateProperties$2`, `setCurrentFiber`, `jsxDEVImpl`, none of which exists in
production. It does not affect plain compute frames. Rank targets by **self**
time in our own code — a component's inclusive time is mostly its children plus
reconciliation.

## Startup profiling (July 2026)

Four throwaway harnesses in `website/scripts/`, all running the built bundle
with no source changes:

- `profile-app.ts` — CDP CPU profile of the main thread and every worker across
  a cold load, a warm load and a pan/zoom burst, plus network bytes, long tasks
  and a rAF frame-time distribution. Writes `.cpuprofile` files and a markdown
  report; `profile-resolve.ts` attributes self time to real source files through
  the build sourcemaps.
- `probe-startup.ts` — API-level counters (programs linked, shader-status time,
  GL contexts, workers, blob stop-tokens, sync XHRs) by wrapping the platform
  APIs in `evaluateOnNewDocument`.
- `ab-compare.ts` — interleaved A/B of two prebuilt `build/` trees: startup
  timings, program counts, and an ImageMagick pixel diff of the settled view.
  Build one variant, copy `build/` aside, build the other, point it at both.

Two results worth not re-deriving.

**Shader compilation dominated first paint, and laziness fixed it.** A
three-track LGV linked 29 WebGL programs and drew with 14 — the alignments
renderer alone declares 21 passes, most behind a setting a default pileup never
turns on. On a cold GPU program cache that was ~1.9 s of blocking driver time.
`webgl2Hal` now compiles a pass on its first draw (`getPass`), which halves the
program count and is pixel-identical. **Deferring the status check is not the
fix** — stubbing `LINK_STATUS`/`COMPILE_STATUS` to `true` removes the time from
the measurement but not from the load, because the first `useProgram` forces the
driver to finish anyway. `KHR_parallel_shader_compile` buys little for a program
used immediately after linking; compiling *fewer* programs is the lever.

**Shrinking the RPC worker pool is not a win — don't retry it.** Three tracks
boot three workers, each parsing ~1.9 MB of the same chunks (400–560 ms each),
which looks like obvious waste. Forcing `rpc.workerCount: 1` and A/B-ing it is a
wash (3430 vs 3534 ms to settled): the boots overlap, so they are not on the
wall-clock critical path, and heavy datasets are where the pool earns its keep.
The live lever is bundle *content* — see below.

## The SharedArrayBuffer stop-token path does work — it just never runs

`stopToken.ts` cancels at await boundaries by posting the stopped token's id to
every worker, and a `SharedArrayBuffer` token additionally carries an atomic flag
that a *synchronous* loop can read without yielding. Only the message path ever
runs in practice, because SAB needs `crossOriginIsolated` and nothing sets
COOP/COEP (see [NETWORK_ABORT.md](NETWORK_ABORT.md) for why that is deliberate
and not fixable for an embeddable library). `hasSharedArrayBuffer` asks
`crossOriginIsolated` directly — it used to ask only whether one could be
constructed, which is the same question in a browser and a different one in a
V8 embedder, so jest and Electron both took a path no deployment takes. ADR-056's
consequences carry what that cost.

`node website/scripts/coi-probe.ts [--coi]` serves the build with and without
`Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy:
require-corp` and checks the observable consequences. Verified July 2026 — with
isolation on, the fast path engages correctly end to end:

| | no COOP/COEP | with COOP/COEP |
| --- | --- | --- |
| `crossOriginIsolated` | false | true |
| blob URLs created (fallback tokens) | 3 | **0** |
| SharedArrayBuffers reaching workers | 0 | **3** |
| `blob:` sync-XHR probes in workers | 0 | 0 |
| displays painted / page errors | 5 / 0 | 5 / 0 |

The SAB survives the RPC argument serialization intact (it arrives as a real
`SharedArrayBuffer`, not a mangled object), which is the part most likely to
have rotted silently. The blob-URL row reads the other way round now: a
non-isolated page **must** mint them, because the blob is what the synchronous
probe fails against, and `fetch-cancellation.ts` fails if it ever sees zero.

On a **light** load it buys nothing: 5 runs each, time-to-settled medians
1933 ms without isolation vs 1917 ms with. That measurement is misleading on its
own, though, and it is the wrong workload — a volvox LGV has almost nothing to
cancel, and cancellation is the entire point of a stop token.

`node website/scripts/cancel-bench.ts [--coi] [--credentialless]` measures the
case that matters: the ultra-deep (~2000x) BAM in `extra_test_data/`, driven
through six navigations 350 ms apart so each one cancels a fetch still in
flight.

### The sync-XHR fallback measured at zero here, and that was the wrong workload

The blob-URL/sync-XHR probe used to be how a non-isolated deployment interrupted
a synchronous worker loop, and this bench once credited it with a real gap
(median 1016 ms settle on the XHR path vs 692 ms on SAB, 6 runs each). **That
comparison predated cancellation-by-message.** Once await boundaries cancel for
free on every deployment, the probe's only remaining job was intra-loop
interruption, and re-running the same bench with it on and off gave nothing
(5 runs each, back to back, no isolation):

| | probe on | probe off |
| --- | --- | --- |
| settle after last of 6 hops | median **513 ms** (477–564) | median **513 ms** (428–594) |
| whole 6-hop burst | median **2670 ms** | median **2675 ms** |
| blob URLs created | 4 | **0** |

The reason is that *alignments* loops are already chunked by awaits at region
granularity, so there was little to interrupt inside one. **That conclusion did
not generalise and the probe was restored.** `getLDMatrix.ts` fills an O(n²)
Float32Array with no await anywhere — millions of pair computations where the
probe is the only possible interruption — and this bench never touches it. The
lesson for anyone re-running this: a cancel benchmark measures the loops the
workload happens to run, so pick the workload for its loop shape, not its data
volume. An await-free LD or multi-sample-variant computation is the missing arm.

The SAB path also stays: ~40 lines, verified working, and cheaper than the probe
wherever isolation happens to exist.

Both mechanisms now have regression cover that does not depend on this bench —
`products/jbrowse-web/browser-tests/suites/fetch-cancellation.ts` asserts the
socket abort, the worker notification, and blob-token minting in a real browser,
and `stopToken.test.ts` asserts the probe seam is consulted inside an await-free
loop. The probe was deletable in the first place because nothing tested it: it is
inert under jsdom, so its removal passed all 6000+ unit tests.

Note `Cross-Origin-Embedder-Policy: credentialless` also produces
`crossOriginIsolated` (verified: same SAB counts, 686 ms settle) and, unlike
`require-corp`, does **not** require CORP headers on cross-origin subresources —
so it is the variant that could make this live without breaking fetching public
data from arbitrary hosts. [NETWORK_ABORT.md](NETWORK_ABORT.md) only considered
`require-corp` when it concluded isolation was unusable.

## Getting UI code out of the RPC workers

Nothing in a worker renders React, yet **2.2 MB of the 6.35 MB of module bytes
in the chunks a worker parses is UI code** (`@mui/material` 983 KB, `react-dom`
533 KB, `@floating-ui/react` 183 KB, `@mui/system` 125 KB, `@popperjs/core`
67 KB) — measured by bucketing `build/bundle-stats.json` (from
`node products/jbrowse-web/scripts/build.ts --stats`) over the chunks
`website/scripts/probe-startup.ts` reports the worker importing. Three workers
boot for a three-track load, so that is paid three times.

`node scripts/check-worker-imports.ts [--causes]` reports why: **258 static
import sites** across 23 packages, all reached through `corePlugins.ts` — every
product's worker entry statically imports every plugin's `index.ts`, and a
plugin index reaches its React components (menu icons via
`packages/core/src/ui/Icons.tsx`, tooltips via `tss-react`, SVG-export wrappers
via `renderToStaticMarkup`, `TrackOverlayPortal` via `react-dom`). The sites are
spread — 89 in `packages/core`, 57 in `linear-genome-view` — not concentrated in
a few hubs.

**This is all-or-nothing.** Webpack keeps a module if any reachable importer
needs it, so cutting one chain saves zero bytes; only cutting the last chain to
a package removes it. Two things follow:

- Don't bother with a partial pass, and don't reach for a `splitChunks`
  cacheGroup either — the import graph is the actual problem, and a manual chunk
  split would only paper over it.
- A measured non-fix for the record: pointing the four product worker entries at
  `@jbrowse/product-core/src/rpcWorker` instead of the package barrel (which
  re-exports the whole `ui/` tree) is *correct in direction* but removes exactly
  one module from the graph, because the plugin indexes pull the same modules
  anyway. It was tried and reverted.

The real fix is making plugin `index.ts` files stop statically reaching React —
lazy-importing the menu/UI registration at its natural `import()` boundary. That
is a campaign across ~23 packages, and `--causes` is its worklist; the site
count is the progress bar. Related: the same static `corePlugins.ts` import is
why the cold app shell eagerly loads a ~1 MB all-plugins chunk on the main
thread (`products/jbrowse-web/CLAUDE.md`), so the two problems share a fix.
