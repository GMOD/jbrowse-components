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

## Layers worth measuring

The synteny render pipeline goes:

```
wheel/drag event
  → flushHorizontalScroll() → rAF
    → transaction(() => v.horizontalScroll(...))
      → offsetPx changes (MobX observable mutation)
        → autorun deps fire (renderState getter, etc.)
          → render autorun callback runs
            → GpuSyntenyRenderer.render(state)
              → hal.beginFrame / writeUniforms / drawPass / endFrame
        → mobx-react flushes observer() re-renders (React commit)
```

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

Track how often each autorun in `installGpuDisplay` fires:

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
