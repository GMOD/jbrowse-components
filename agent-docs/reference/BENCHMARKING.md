---
name: benchmarking
description: How do I measure performance honestly here — the bench shape and trap catalogue, the instrumentation for render and scroll jank, the whole-app jb2bench corpus and its publishable tables, and the track-selector result?
kind: operations
---

# Benchmarking, and the traps that fake it

A bad harness does not produce noise, it produces a confident wrong answer: a
clean ratio with a tidy standard deviation. Each trap below got as far as being
believed in this repo. This doc covers the shape of a bench you can believe, the
trap catalogue, the instrumentation for diagnosing a slow frame, the whole-app
benchmarks that compare against released JBrowse, and the track selector as a
worked case. [BGZF_WORKER_POOL.md](BGZF_WORKER_POOL.md) holds the traps specific
to benchmarking the inflate pool.

## The shape of a bench you can believe

- **Interleave the arms, round-robin, in one process.** Machine drift (another
  agent's typecheck, a laptop leaving AC) otherwise lands on whichever arm ran
  second. Never run all of A then all of B.
- **Report the MIN across rounds.** Interference only slows things down, so the
  minimum is the closest sample to uncontended. Absolute times drift between
  runs; the within-run ratio does not.
- **Run a control.** A third arm that is the same code as the baseline,
  extracted or declared twice. Any claimed ratio has to clear what the control
  scores. **A control far from 1.00 means the row measured nothing.** A control
  coming back wrong caught most of the traps below.
- **Check identity before believing timing.** Compare every field both sides
  emit, describe the first difference, and fail unless the caller passes
  `--allow-diff`.

## The trap catalogue

### JIT and shape

- **One shared driver across arms.** A shared function calling both
  implementations goes polymorphic and every arm pays. Write one longhand driver
  per arm.
- **Identical driver source.** Three `new Function` calls with the same text hit
  V8's compilation cache and share a feedback vector, restoring the
  megamorphism. Use separate function literals.
- **Asymmetric warmup.** An identity pass over only some arms leaves the others
  monomorphic. Warm every arm the same way.
- **Direct call vs call-through-parameter.** A directly imported function can
  inline; one reached through a parameter often cannot. Pass all arms the same
  way.
- **Arm declared in the bench vs imported from a module.** The two compile
  differently enough to move a ratio by roughly 10%. When the candidate is
  imported production code, import the baseline and control too, as
  `packages/render-core/benches/twoLiteralBpMapper.ts` does.
- **Arms in blocks.** The second block inherits the first's warmup. Interleave.
- **Looping several DATASETS through the same arm function objects.** Fixture A
  contaminates B and every later fixture. The reversal follows position, not
  data: swap the order and the loser swaps. It invites the plausible wrong
  conclusion "this does not help small inputs". Pre-warming, releasing other
  fixtures and more rounds do not fix it. **One process per fixture** does: give
  the bench an `--only=<fixture>` flag, as
  `plugins/alignments/benches/readBaseCounts.bench.ts` and `tagAndSeq.probe.ts`
  do. Arms that raw-access records are exposed; arms that call library methods
  are not.

### Measuring the wrong thing

- **Setup inside the timed region.** Hoist anything the real caller does once
  per region.
- **Too few rounds against a warming cache.** A min over a series that has not
  plateaued is not a min of anything. Watch the spread of the raw rounds.
- **A window small enough to sit in cache.** It prices arithmetic and moves the
  answer, in the flattering direction. Size the window from the working set.
- **A window LARGE enough that the arms' own garbage decides.** `pafLineParse.bench`
  stops resolving at a few thousand rows per arm and the control drifts well
  off 1.00. Row count matters, not bytes, and more rounds do not help. Cut the
  fixture down.
- **A degenerate microbench.** Pure-allocation microbenches overstate by
  multiples. Use them to find a mechanism, never to size one.
- **A baseline silently doing less work.** A suspiciously fast arm may have
  skipped the computation (an undefined `ref` skipped mismatch detection). The
  identity check exists for this.
- **A fixture that cannot produce the event under test.** The synthetic MAF in
  `mafOverlays.bench.ts` put a reference gap every 29 columns, so no deletion
  reached label width and the overlay emitted zero markers while the walk was
  timed. Identity passes because zero equals zero. **Print the count of whatever
  the code under test emits on every row**, and treat zero as a broken fixture.
- **Rounds that vary the workload.** If a bench sweeps positions or inputs, a
  round must be the whole sweep, or `min` picks the cheapest frame.
- **An unobserved MobX computed is not cached.** Reading `model.rows` in a bare
  loop recomputes the chain each time, so such a benchmark never sees a caching
  win. Read inside an `autorun`, as the observer components do, and time the
  action that re-runs it synchronously.

### Tools that cannot see what you are asking

- **A jest probe is not a timing harness for typed-array code.** Jest inflates
  typed-array element access and global-builtin calls (`Number(s)`,
  `Number.isFinite`) by one to two orders of magnitude, non-uniformly, because
  arrays and builtins are realm-local to jest's vm context. Both jest
  environments do it. The profile ranking changes too: a handoff once named
  `buildSyntenyGeometry` the largest item from jest numbers, and it was not.
  Node and Chrome agree within about 30%, so node is a fine proxy for
  worker-side questions. `esbuild --bundle` the module and run it under `node`,
  or under Chrome via the puppeteer in `packages/browser-test-utils/`. Chrome
  clamps `performance.now()` to ~0.1ms, so use node for finer resolution.
- **Every `*.bench.ts` runs under node**, naming its own `node <path>` command in
  its header. A bench that grows a `test()` for a runner is a different and
  wrong measurement.
- **Node cannot measure anything worker-shaped**, the BGZF pool included: no
  global `Worker` or Blob URLs, so the in-process path runs and every node bench
  reports parity. [BGZF_WORKER_POOL.md](BGZF_WORKER_POOL.md) owns the detail.
- **V8's sampling heap profiler reports only survivors.** Dead nursery objects
  never appear. `HeapProfiler.startTrackingHeapObjects` with `trackAllocations`
  answers "how much transient garbage".
- **Don't infer bundle weight from a test run.** Measure with esbuild
  `--splitting --minify` and compare the entry chunk.

## Measuring on a contended box

Other agents run `tsc` concurrently, so load average often sits at 60-80 on 16
cores. That invents or erases results: a sequential before/after reported a
babel change as a 2.2x win that an interleaved A/B put at zero.

- Check `uptime` before believing anything, and again after.
- Warm both variants before timing an in-process benchmark.
- `website/scripts/ab-compare.ts` interleaves two prebuilt `build/` trees.
- For a source A/B, `git worktree add --detach <dir> <sha>` with symlinked
  `node_modules` runs jest in both trees.

Contention can also compress a ratio: the GTF scanner measured 1.65-1.78x at
load ~30 and 1.71-2.12x at load ~4, because the allocation-heavy arm is already
GC-bound. Read a ratio measured under load as a floor, and take the median of
per-round paired ratios rather than a ratio of medians, which lets drift between
two long runs into the answer.

## Instrumenting render and scroll jank

Probes are temporary: gate each on a `?gpu-perf=1` URL flag, and strip them
before landing while keeping the fixes.

### Render counts need no browser

`mobx-react-lite` names every observer's reaction `observer<ComponentName>`, and
`Reaction.track` wraps the render itself, so `mobx.spy()` filtered to
`type: 'reaction'` is a per-component render count in jsdom.
`products/jbrowse-web/src/tests/renderCensus.ts` is the helper and
`ZoomRenderCensus.test.tsx` drives it (`ZOOM_CENSUS=1` prints per-component
tables). Use it before a CPU profile whenever the question is counts rather than
wall time. [INTERACTION_PERF.md](INTERACTION_PERF.md) carries its two limits (a
count is a floor, and only the view-geometry half is deterministic) and the
rules that came out of it.

### Layers to time, one at a time

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

### Findings worth knowing

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

### Decoding a Firefox profile export offline

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

### Startup profiling harnesses

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

### Cancellation and worker UI code

Cancellation is an `AbortSignal`; ADR-056 and ADR-122 record why the
`SharedArrayBuffer` and revoked-blob-XHR mechanisms went.
`website/scripts/cancel-mechanism-bench.ts` is the bench to re-run before
touching `createAbortBreakpoint`.

RPC workers parse UI code they never run, because every worker entry statically
imports every plugin index. ADR-043 records the measurement, why a
`splitChunks` cacheGroup or a partial pass does not help, and the campaign.
`node scripts/check-worker-imports.ts --causes` is its worklist.

## Whole-app benchmarks against released JBrowse

[jb2bench](https://github.com/cmdcolin/jb2bench), a sibling checkout, compares
the whole application against released versions of itself. Its corpus of
simulated alignments (roughly 750 MB) cannot live in this repo or CI.

A table here is therefore imported: `website/scripts/import-jb2bench.ts` reads
that checkout's result JSON and writes `agent-docs/measurements/<id>.json`, and
the committed record is what CI gates. Refresh with `make interaction` in
jb2bench, then `pnpm import-jb2bench`. `--check` reports an unimported re-run
on a machine with the checkout and exits clean where it is absent.

### Zoom in: the current renderer does not refetch

The zoomed view is a strict subset of reads already on the GPU, so the renderer
re-projects them and never touches the network; the old block renderer
refetches. The two per-base colour modes refetch once per octave crossed, counted in
[PER_BASE_SUBPIXEL_BIN.md](PER_BASE_SUBPIXEL_BIN.md).

<!-- BEGIN GENERATED MEASUREMENT zoom-in-refetch -->

_Generated by `pnpm autogen` — edit the source, not this block._

| case            | current | release-4.3.0 | longest redraw frame |
| --------------- | ------: | ------------: | -------------------: |
| 20x-shortread   |     0ms |        1059ms |                 17ms |
| 200x-shortread  |     0ms |        1085ms |                 17ms |
| 1000x-shortread |     0ms |        1717ms |                 17ms |
| 20x-longread    |     0ms |        1178ms |                 17ms |
| 200x-longread   |     0ms |        2984ms |                 17ms |
| 1000x-longread  |     0ms |       15321ms |                 50ms |

<!-- END GENERATED MEASUREMENT zoom-in-refetch -->

`0ms` is the time a loading indicator was shown. Zoom in is the one gesture
where the architecture skips work entirely, so quoting this as the general
speedup overstates it.

### Tables in jb2bench that are not imported

- **Zoom out** is not a measurement: past a byte threshold JBrowse paints
  "Requested too much data" instead of reads, which is fast and draws nothing.
  The importer refuses any cell whose steps bailed or hit `MAX_WAIT`.
- **Pan** is the honest hard case, since both builds refetch. Import it only
  with prose on read-depth taper at contig ends, which thins long-read data in
  some windows and reads as a speedup in both arms.
- **Cold load** was taken under heavy external load and reports `unusable`.
  Re-run on an idle machine, judged from `uptime` before and after.

### Before quoting

- A comparison within a section is same-run; across sections it may not be.
  jb2bench records a `measured` date per section.
- A magnitude measured on a loaded box belongs to the box. See
  [INTERACTION_PERF.md](INTERACTION_PERF.md).
- Only the zoom-in comparison is published, in
  `website/docs/developer_guides/optimizations.md`. Adding another is an
  editorial decision.

## Worked case: the track selector's cost is per-row rendering

The hierarchical track selector rebuilds on every filter keystroke, but that
model work costs well under a millisecond over 2000 tracks. Mounting a row costs
about 1.4 ms. A change that makes a row lighter pays; a change that makes the
rebuild smarter does not.

Dropping `FormControlLabel` from the row, so a track renders a plain `<label>`,
removed one DOM node per row and cut mount and toggle time. The two columns per
arm are two alternating A/B rounds, each the minimum of its batches:

<!-- BEGIN GENERATED MEASUREMENT track-selector-row-cost -->

_Generated by `pnpm autogen` — edit the source, not this block._

| n=1000 tracks               | before, round 1 | before, round 2 | after, round 1 | after, round 2 |
| --------------------------- | --------------: | --------------: | -------------: | -------------: |
| mount, min of 9             |          1656ms |          1631ms |         1460ms |         1401ms |
| toggle re-render, min of 18 |          80.6ms |          73.6ms |         63.3ms |         66.1ms |
| DOM nodes                   |          21,506 |               — |         20,505 |              — |

<!-- END GENERATED MEASUREMENT track-selector-row-cost -->

Measured null, so don't retry without new evidence:

- **Caching the unfiltered hierarchy and pruning it per keystroke.** Tree
  construction is not the cost; the `buildRows` walk dominates and runs either
  way. Preserving track-node identity so memoized `TreeItem`s bail out did not
  help either, since reconciling ~1000 elements costs about what re-rendering
  them does.
- **Resolving each track's name/description/categories once.** `TrackNodeSource`
  stays as a simplification, but reading a slot off an un-hydrated frozen
  `jbrowse.tracks` entry is nearly a property access, so the cache buys little.
- **Debouncing `filterText`.** It belongs in the view if anywhere.
  `ClearableSearchField` already holds the input in local state and wraps the
  model update in `startTransition`.

`buildRows` (one `TreeRow` allocation per visible node plus a three-way
partition per level) is where to look if a much larger config ever makes typing
slow. The benchmark times `setFilterText` inside an `autorun`, per the
unobserved-computed trap above, with the two trees alternating in one session.

## Worked examples

- `plugins/alignments/benches/mismatchWalk.bench.ts` — A/Bs a library against
  the implementation it replaced, extracted from a git ref twice (baseline and
  control).
- `plugins/alignments/benches/recordShape.bench.ts` — A/Bs two object designs
  with a separately declared control class.
- `plugins/maf/benches/mafCoverage.bench.ts` — A/Bs the working tree against a
  git ref over synthetic input whose shape is swept.
- `plugins/maf/benches/mafOverlays.bench.ts` — code that runs on every frame of
  a pan; reports a cold call and a whole pan sweep, since up-front cost that
  buys cheap frames needs both.

Related: [bgzf-worker-pool](BGZF_WORKER_POOL.md);
[adr-049](../architecture-decision-records/adr-049-region-bound-wrapper-stays.md)
separates retained from transient cost.
