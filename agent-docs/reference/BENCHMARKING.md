---
name: benchmarking
description: How do I measure performance honestly here — the bench shape and trap catalogue, render-count and jank instrumentation, the whole-app jb2bench corpus and its publishable tables, and the track-selector result?
kind: operations
---

# Benchmarking, and the traps that fake it

A bad harness does not produce noise, it produces a confident wrong answer: a
clean ratio with a tidy standard deviation. Each trap below got as far as being
believed in this repo. [BGZF_WORKER_POOL.md](BGZF_WORKER_POOL.md) holds the traps
specific to benchmarking the inflate pool.

## The shape of a bench you can believe

- **Interleave the arms, round-robin, in one process.** Machine drift otherwise
  lands on whichever arm ran second.
- **Report the MIN across rounds.** Interference only slows things down. Absolute
  times drift between runs; the within-run ratio does not.
- **Run a control**: a third arm that is the same code as the baseline, extracted
  or declared twice. **A control far from 1.00 means the row measured nothing.**
- **Check identity before believing timing.** Compare every field both sides emit
  and fail unless the caller passes `--allow-diff`.

## The trap catalogue

### JIT and shape

- **One shared driver across arms.** A shared function calling both
  implementations goes polymorphic and every arm pays. Write one longhand driver
  per arm.
- **Identical driver source.** Three `new Function` calls with the same text hit
  V8's compilation cache and share a feedback vector. Use separate function
  literals.
- **Asymmetric warmup, direct call vs call-through-parameter, arms in blocks.**
  Warm every arm the same way, pass all arms the same way, interleave.
- **Arm declared in the bench vs imported from a module** compile differently
  enough to move a ratio by roughly 10%. When the candidate is imported production
  code, import the baseline and control too, as
  `packages/render-core/benches/twoLiteralBpMapper.ts` does.
- **Looping several DATASETS through the same arm function objects.** Fixture A
  contaminates B and every later fixture; swap the order and the loser swaps.
  Pre-warming and more rounds do not fix it. **One process per fixture** does: give
  the bench an `--only=<fixture>` flag, as
  `plugins/alignments/benches/readBaseCounts.bench.ts` does.

### Measuring the wrong thing

- **Setup inside the timed region.** Hoist anything the real caller does once per
  region.
- **Too few rounds against a warming cache.** Watch the spread of the raw rounds.
- **A window small enough to sit in cache** prices arithmetic and flatters the
  answer. Size the window from the working set.
- **A window LARGE enough that the arms' own garbage decides.** `pafLineParse.bench`
  stops resolving at a few thousand rows per arm and the control drifts well off
  1.00. More rounds do not help. Cut the fixture down.
- **A degenerate microbench.** Pure-allocation microbenches overstate by multiples.
  Use them to find a mechanism, never to size one.
- **A baseline silently doing less work.** The identity check exists for this.
- **A fixture that cannot produce the event under test.** The synthetic MAF in
  `mafOverlays.bench.ts` put a reference gap every 29 columns, so the overlay
  emitted zero markers while the walk was timed, and identity passed because zero
  equals zero. **Print the count of whatever the code under test emits on every
  row**, and treat zero as a broken fixture.
- **Rounds that vary the workload.** A round must be the whole sweep, or `min`
  picks the cheapest frame.
- **An unobserved MobX computed is not cached.** Reading `model.rows` in a bare
  loop recomputes the chain each time. Read inside an `autorun` and time the
  action that re-runs it synchronously.

### Tools that cannot see what you are asking

- **A jest probe is not a timing harness for typed-array code.** Jest inflates
  typed-array element access and global-builtin calls by one to two orders of
  magnitude, non-uniformly, and changes the profile ranking. Node and Chrome agree
  within about 30%, so `esbuild --bundle` the module and run it under `node`, or
  under Chrome via the puppeteer in `packages/browser-test-utils/` (Chrome clamps
  `performance.now()` to ~0.1ms).
- **Every `*.bench.ts` runs under node**, naming its own `node <path>` command in
  its header. A bench that grows a `test()` for a runner is a different and wrong
  measurement.
- **Node cannot measure anything worker-shaped**, the BGZF pool included: with no
  global `Worker`, the in-process path runs and every bench reports parity.
- **V8's sampling heap profiler reports only survivors.**
  `HeapProfiler.startTrackingHeapObjects` with `trackAllocations` answers "how much
  transient garbage".
- **Don't infer bundle weight from a test run.** Measure with esbuild
  `--splitting --minify` and compare the entry chunk.

## Measuring on a contended box

Other agents run `tsc` concurrently, so load average often sits far above core
count. That invents or erases results: a sequential before/after reported a babel
change as a 2.2x win that an interleaved A/B put at zero.

- Check `uptime` before believing anything, and again after.
- `website/scripts/ab-compare.ts` interleaves two prebuilt `build/` trees. For a
  source A/B, `git worktree add --detach <dir> <sha>` with symlinked `node_modules`
  runs jest in both trees.
- Contention can compress a ratio, so read one measured under load as a floor and
  take the median of per-round paired ratios rather than a ratio of medians.

## Instrumenting render and scroll jank

Gate probes on a `?gpu-perf=1` URL flag and strip them before landing.

**Render counts need no browser.** `mobx-react-lite` names every observer's
reaction `observer<ComponentName>`, so `mobx.spy()` filtered to `type: 'reaction'`
is a per-component render count in jsdom
(`products/jbrowse-web/src/tests/renderCensus.ts`, driven by
`ZoomRenderCensus.test.tsx`; `ZOOM_CENSUS=1` prints tables). Use it before a CPU
profile whenever the question is counts rather than wall time.
[INTERACTION_PERF.md](INTERACTION_PERF.md) carries its limits and the rules that
came out of it.

**Time the layers one at a time**: HAL ops (`writeUniforms`, `drawPass`), the gap
between `render()` calls, autorun fire counts in `attachRenderingBackend`, main-thread
blocks (a `setTimeout` poll, since `longtask` is Chrome-only), and `instanceData`
reference equality in `setRpcData`. The slow layer is the bottleneck.

- **The synteny drag path has no rAF, deliberately.** `panStack` runs on every
  mousemove, and the action is what coalesces the views a stack drives.
- **A fetch autorun that tracks `offsetPx`/`bpPerPx` is the top GPU-path footgun.**
  `installComparativeFetchAutorun` (`LinearSyntenyDisplay/afterAttach.ts`) reads
  them through `untracked()`.
- **Uniform writes, VAO setup and React reconciliation are cheap.** Measure before
  suspecting a React commit.
- **`console.warn` in a hot getter costs real time** when an observable cascade
  trips it.
- **Rank Firefox-profile targets by self time in our own code**, not inclusive
  component time; dev builds carry React-only work production lacks. In a
  `preprocessedProfileVersion: 66` export the tables live under `d['shared']`,
  `stackTable` has `prefixOffset` rather than `prefix`, and the JBrowse content
  process is not thread 0.

### Startup profiling harnesses

`website/scripts/` runs all of these against the built bundle: `profile-app.ts`
(CDP CPU profile of the main thread and workers; `profile-resolve.ts` maps self time
through sourcemaps), `probe-startup.ts` (programs linked, GL contexts, workers, blob
URLs, sync XHRs) and `ab-compare.ts`.

**Shader compilation dominated first paint, and laziness fixed it.** `webgl2Hal`
compiles a pass on its first draw (`getPass`). Deferring the link-status check is
not the fix, since the first `useProgram` forces the driver to finish, and
`KHR_parallel_shader_compile` buys little for a program used at once.

**Shrinking the RPC worker pool is not a win; don't retry it.** Forcing
`rpc.workerCount: 1` was a wash, because worker boots overlap off the critical path.

### Cancellation and worker UI code

Cancellation is an `AbortSignal`; ADR-056 and ADR-122 record why the
`SharedArrayBuffer` and revoked-blob-XHR mechanisms went.
`website/scripts/cancel-mechanism-bench.ts` is the bench to re-run before touching
`createAbortBreakpoint`. RPC workers parse UI code they never run (ADR-043);
`node scripts/check-worker-imports.ts --causes` is its worklist.

## Whole-app benchmarks against released JBrowse

[jb2bench](https://github.com/cmdcolin/jb2bench), a sibling checkout, compares the
whole application against released versions of itself; its corpus cannot live in
this repo or CI. `website/scripts/import-jb2bench.ts` reads that checkout's result
JSON and writes `agent-docs/measurements/<id>.json`, and the committed record is
what CI gates. Refresh with `make interaction` in jb2bench, then
`pnpm import-jb2bench`.

### Zoom in: the current renderer does not refetch

The zoomed view is a strict subset of reads already on the GPU, so the renderer
re-projects them and never touches the network; the old block renderer refetches.
The two per-base colour modes refetch once per octave crossed
([PER_BASE_SUBPIXEL_BIN.md](PER_BASE_SUBPIXEL_BIN.md)).

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

`0ms` is the time a loading indicator was shown. Zoom in is the one gesture where
the architecture skips work entirely, so quoting this as the general speedup
overstates it.

### Tables in jb2bench that are not imported

- **Zoom out** is not a measurement: past a byte threshold JBrowse paints
  "Requested too much data", which is fast and draws nothing. The importer refuses
  any cell whose steps bailed or hit `MAX_WAIT`.
- **Pan** is the honest hard case, since both builds refetch. Import it only with
  prose on read-depth taper at contig ends, which reads as a speedup in both arms.
- **Cold load** was taken under heavy external load and reports `unusable`.

### Before quoting

- A comparison within a section is same-run; across sections it may not be.
- A magnitude measured on a loaded box belongs to the box
  ([INTERACTION_PERF.md](INTERACTION_PERF.md)).
- Only the zoom-in comparison is published, in
  `website/docs/developer_guides/optimizations.md`.

## Worked case: the track selector's cost is per-row rendering

The track selector's rebuild on a filter keystroke costs well under a millisecond
over 2000 tracks; mounting a row costs about 1.4 ms. A change that makes a row
lighter pays; a change that makes the rebuild smarter does not. Dropping
`FormControlLabel` from the row removed one DOM node per row:

<!-- BEGIN GENERATED MEASUREMENT track-selector-row-cost -->

_Generated by `pnpm autogen` — edit the source, not this block._

| n=1000 tracks               | before, round 1 | before, round 2 | after, round 1 | after, round 2 |
| --------------------------- | --------------: | --------------: | -------------: | -------------: |
| mount, min of 9             |          1656ms |          1631ms |         1460ms |         1401ms |
| toggle re-render, min of 18 |          80.6ms |          73.6ms |         63.3ms |         66.1ms |
| DOM nodes                   |          21,506 |               — |         20,505 |              — |

<!-- END GENERATED MEASUREMENT track-selector-row-cost -->

Measured null, so don't retry without new evidence:

- **Caching the unfiltered hierarchy and pruning it per keystroke**, and
  **preserving track-node identity** so memoized `TreeItem`s bail out: the
  `buildRows` walk dominates, and reconciling ~1000 elements costs about what
  re-rendering them does.
- **Resolving each track's name/description/categories once**: reading a slot off
  an un-hydrated frozen `jbrowse.tracks` entry is nearly a property access.
- **Debouncing `filterText`**: `ClearableSearchField` already holds the input in
  local state and wraps the model update in `startTransition`.

Related: [adr-049](../architecture-decision-records/adr-049-region-bound-wrapper-stays.md)
separates retained from transient cost.
