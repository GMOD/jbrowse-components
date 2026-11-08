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

- **A latency fix that removes one serial round trip can A/B as zero at one
  RTT** when a parallel chain is as long: moving the BAM header read beside its
  index (CRAM's beside `.crai`) measured nothing at 80 ms and 195–200 ms at 200
  ms, because the main thread's chain (the `.2bit` fetch plus ~117 ms CPU) met
  the shortened worker chain. Read `--waterfall` for what the critical request
  waited on, and rerun `measure-load-latency.ts --latency=200` before calling it
  worthless; on the laptop a 100 ms difference flipped sign with run order, so
  A/B on ada and swap the order once.

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
- **Plain `node <file>.ts` strips types and transforms nothing**, so a
  parameter property (`constructor(private readonly x: T)`), an enum or a
  namespace in ANY module a bench imports throws
  `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`, while typecheck, `build:esm` and jest
  pass the file. In a module a bench can reach, declare the field and assign it
  in the constructor body.

## Measuring on a contended box

Other agents run `tsc` concurrently, so load average often sits far above core
count. That invents or erases results: a sequential before/after reported a babel
change as a 2.2x win that an interleaved A/B put at zero.

- Check `uptime` before believing anything, and again after.
- `website/scripts/ab-compare.ts` interleaves two prebuilt `build/` trees. For a
  source A/B, `git worktree add --detach <dir> <sha>` with symlinked `node_modules`
  runs jest in both trees.
- **Production functions at two commits, no second install**: `git archive`
  the base's `plugins/<plugin>/src` into a scratch dir, write one entry per arm
  re-exporting the functions under test, and esbuild-bundle `base`, `control`
  (base again with a distinct banner, so it is its own module) and `branch`
  with `platform: 'node'` and `nodePaths` at the worktree's plugin and root
  `node_modules`. Each arm builds its fixture with its own test helpers, so a
  field rename between commits costs nothing. A 1.33 outlier the control does
  not share happens on a loaded laptop; rerun three times before believing one.
- **Load latency**: `products/jbrowse-web/browser-tests/measure-load-latency.ts`
  serves HTTP/2 over a trusted cert (`--http1` opts out). Interleave the arms
  per rep; one arm moved 2x between batches as the load rose. Once the network
  chain is short a load is bound by main-thread ordering, so read the ordering
  columns (does the view container land in the first commit, does a request go
  out before or after a commit) before the ready-time medians, and take those
  only below load ~45.
- An HTML-level change (preload links) A/Bs from one build through variant
  pages `build/p0.html`: load `/p0?query`, never `/p0.html?query`, which the
  test server redirects without the query, so the app never reaches ready.

## Instrumenting render and scroll jank

Gate probes on a `?gpu-perf=1` URL flag and strip them before landing.

**Shrinking the RPC worker pool is not a win; don't retry it.** Forcing
`rpc.workerCount: 1` was a wash, because worker boots overlap off the critical path.

- **An in-page polling sampler times itself.** A `setTimeout(tick, 5)` loop
  reading every display's `displayPhase` reported 1.3-2.0 s gaps and a 200-650
  ms model-to-DOM lag; a MutationObserver on the marker measured 4-19 ms. Each
  tick pays the getters on the main thread it is timing. Time app state with a
  MutationObserver (one rAF loop at most), read the model once at the change,
  and cross-check a gap against `waitForAppSettled`'s own outcome.
- **A page that reads idle on every in-page instrument can be inside one
  multi-minute layout-and-paint task.** The SV inspector's circle for 66,709
  records took ~4 minutes painting 55,782 SVG `<path>` nodes while long tasks,
  the worker profile and the network all said idle: a long-task entry arrives
  after the task, a CDP `Profiler.start` queues behind it, and native raster
  shows as `(program)`. Time it from Node with a `page.evaluate` poll, which
  cannot return mid-task, wrap `jb.session.rpcManager.call` to log each RPC's
  duration, then count DOM nodes.
- **A/B a canvas packer change** with a temporary flag read in `packRef.ts`,
  forcing the repack with `view.zoomTo(bpPerPx * 1.5)` and back in both arms.
  `d.setHeight()` repacks nothing, since height is not one of the layout's
  `LAYOUT_CACHE_KEYS`. Read `maxY`, names shown and hidden isoforms: at the
  default height the fit ladder turns extra rows into dropped names.

## Bytes over the wire

- **Count in the server.** A `node:http` server honouring `Range`, the
  adapter's config pointed at it with a `UriLocation`, response lengths summed
  in the handler: what the socket carried, no adapter internals, no browser
  (the `pif-tier-wire-bytes` record's repro). Keep index bytes apart, since
  every arm refetches the `.tbi`/`.csi` identically, and `clearCache()`
  between arms, since the chunk cache is module-global. Bytes repeat exactly
  across runs where loopback wall-clock moved 27%, so publish bytes.
- **In a browser**, `collectWireRequests` (`browser-tests/cdpNetwork.ts`) sums
  `encodedDataLength`; attach it to each `page.on('workercreated')` worker too,
  with the cache disabled.
- **A change already live on main** A/Bs against the last release: push.yml
  deploys every tag to `jbrowse.org/code/jb2/<ref>/`, so swap `code/jb2/main/`
  for `code/jb2/v5.0.0-beta.N/` in the same launch link (the genomes portal
  builds its links client-side; read one with puppeteer).

## GPU and render cost

- **Measure render cost headed.** Headless Chrome here is SwiftShader: 66,994
  chord ribbon paths filled in 1.8 s headless, 4.8-5.9 s headed on the GPU.
  Report the rung beside every number (`getContext('webgl2')` on the canvas is
  non-null only for a WebGL2 canvas) and `getContextAttributes().antialias`,
  and time the synchronous action apart from the frame.
- **One generated WGSL shader, A/B on the GPU with no app**: run it under Deno
  (`deno run -A --unstable-webgpu`). Pull `WGSL_SOURCE` from
  `<shader>.wgsl.generated.ts`, build the pipeline by hand from
  `<shader>.iface.generated.ts` (`VERTEX_ATTRIBUTES`, `BINDINGS`,
  `UNIFORM_OFFSET_F32`, `VERTS_PER_INSTANCE`), render to `rgba8unorm` and read
  alpha back (at draw alpha 0.5, above 130 is blended twice; under 120 with
  every neighbour at or above 120 is a hole). For cost, time ten frames from
  `submit` to `onSubmittedWorkDone` on a 64 px canvas, min over interleaved
  rounds. Judge an MSAA render against an exact supersampled reference. This
  found a 445-pixel band/cap seam and a 13 ms vertex cost in `ribbon.slang`
  that a JS model of the `.slang` could not.

## Whole-app benchmarks against released JBrowse

[jb2bench](https://github.com/cmdcolin/jb2bench), a sibling checkout, compares the
whole application against released versions of itself; its corpus cannot live in
this repo or CI. `website/scripts/import-jb2bench.ts` reads that checkout's result
JSON and writes `agent-docs/measurements/<id>.json`, and the committed record is
what CI gates. Refresh with `make interaction` in jb2bench, then
`pnpm import-jb2bench`.

### Zoom in: the current renderer does not refetch

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

## Worked case: the track selector's cost is per-row rendering

Mounting a track selector row costs about 1.4 ms.

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