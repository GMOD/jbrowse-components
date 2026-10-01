---
name: test-infrastructure
description: Browser and unit tests and WebGPU CI. Read when running or writing tests, or validating RPC.
audience: internal
kind: operations
---

# Test Infrastructure

Browser tests (Puppeteer) in `products/jbrowse-web/browser-tests/`; unit tests (Jest)
co-located as `*.test.ts`.

## Browser tests

Build first: `pnpm --filter @jbrowse/web build`.

```sh
node browser-tests/runner.ts                 # canvas2d (default)
node browser-tests/runner.ts --backend=webgl
node browser-tests/runner.ts --filter=alignments
node browser-tests/runner.ts --headed         # debug
node browser-tests/runner.ts --update-snapshots
```

Suites live in `browser-tests/suites/`.

### Golden snapshots

Visual regression via pixelmatch, stored per backend in
`browser-tests/__snapshots__/{canvas2d,webgl,webgpu}/`. `compare-backends.ts` compares
across backends. `--update-snapshots` rewrites a golden only when the new capture differs by
more than 0.5%. **Look at `__snapshots__/<backend>/<name>.diff.png` before believing a number
and before running `-u`.** Goldens carry ordinary drift from unrelated commits, so a diff
percentage alone attributes nothing; check whether your change can reach those pixels. Two
goldens (`canvas2d/fullpage_methylation.png`, `fullpage_modifications.png`) are blank pages
frozen in from the flake below.

**Goldens never run in CI** (they encode one machine's rendering). The *cross-backend gate*
does, blocking: `pnpm --filter @jbrowse/web test:browser:gate:ci` renders `CI_GATE_SUITES`
(`crossBackendGate.ts`) with canvas2d and swiftshader webgl and diffs the two, needing no
baseline ([CROSS_BACKEND_GATE.md](CROSS_BACKEND_GATE.md) before widening it). The local
`test:browser:gate` adds webgpu, which is Firefox Nightly launched headed, so CI's two
backends are a coverage gap, not a verdict
(`ideas/waiting-on-someone-else/render-webgpu-in-the-blocking-cross-backend-gate-job.md`).

**`fullPage: true` caused a 10-25% blank-capture flake.** Puppeteer implements it by
resizing the viewport, which invalidates the page raster, and under load the capture returns
before re-raster (live chrome around a white content area). `pageSnapshot` takes a plain
viewport screenshot; a view needing more room gets a bigger viewport (`page.setViewport`),
never `fullPage`. A single `--test=` run almost never reproduces it; the blanking needs
concurrent browser churn.

### WebGL / WebGPU

- **WebGL**: fully supported (Chrome headless / Firefox), CI default.
- **WebGPU local** (Firefox real GPU): `--backend=webgpu --headed`; `FIREFOX_NIGHTLY_PATH` or
  `--firefox=/path/to/binary` locates the binary.
- **WebGPU CI** (Linux + lavapipe): `mesa-vulkan-drivers`, `xvfb-run`,
  `VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json --backend=webgpu`.

**A webgpu run fails ~17 tests unrelated to rendering, because it is the Firefox run.** Read
the names before chasing any: SVG Export (the download behavior only CDP sets), FetchCancellation
(`page.createCDPSession()` is Chrome-only), TransferListDiagnostics (reads the wording of
Chrome's `DataCloneError`), and two unexplained DOM/text assertions (a canvas label-squeeze
check and a dotplot tooltip). None are goldens, so `--update-snapshots` leaves them alone. The
first run after a cold start also fails a test or two to Firefox profile creation. Judge a run by
whether failures are on that list, not the tally.

**The webgpu window has to stay in the FOREGROUND.** A backgrounded headed Firefox throttles
rAF, and `page.waitForFunction` polls on **rAF by default**, so the wait burns its whole timeout
(`Waiting failed: Nms exceeded`) on a test that is not broken. Pass `polling: 'mutation'` (React
schedules through MessageChannel, so the DOM still changes) and give a wait an explicit failure
dump. Wall-clock numbers from a backgrounded run are untrustworthy.

## Unit tests

Jest, co-located, `pnpm test-ci`. Node-based and fast: use for logic, config, RPC and buffer
packing; browser tests for rendering and UI.

### Which suites a change runs

`pnpm test-related` selects by **footprint**: every jest run records, per suite, the repo files
it loaded through jest's module system (`config/jest/footprintRuntime.cjs`, `runtime` on every
project), and a suite runs when its footprint holds a changed file. A changed file whose
`@babel/preset-typescript` output is unchanged (comment, type, reflow) selects nothing.
`jest.config.js`, `babel.config.cjs`, `pnpm-lock.yaml` and the `.cjs` files under `config/jest/`
are in no footprint, so a change to one reports a pointer to `pnpm test`. The static graph
(`--findRelatedTests`) is the fallback for a suite with no footprint yet and cannot discriminate
(every jbrowse-web suite imports `corePlugins`). Footprints live under
`<cacheDirectory>/footprints/<hash of checkout root>/`; a worktree reads its own and the
primary checkout's, so a branch that drops an import cannot narrow what another checkout reads.

**The `jbrowse-web` jest project runs on remote CI only** (its suites each boot the app and take
about half the suite clock). `pnpm test` passes `--ignoreProjects jbrowse-web`, `pnpm test-ci`
runs every project, and `test-related` selects a web suite only when the change edits that test
file, or with `--with-web`. A config-slot removal, menu regrouping or caption change goes red
there (`ConfigSlotDefaults`, `AlignmentsFilters`, `ReversedRegionLabels` execute the module
involved), so that class can land green locally and red on push, and gets fixed forward.

<!-- BEGIN GENERATED MEASUREMENT test-selection-strategies -->

_Generated by `pnpm autogen` — edit the source, not this block._

| selection                                       | median suite-seconds | mean suite-seconds | p90 suite-seconds | all 264 commits |
| ----------------------------------------------- | -------------------: | -----------------: | ----------------: | --------------: |
| static, no web (test-related before footprints) |                 138s |               215s |              599s |         944 min |
| footprint, no web (test-related)                |              **16s** |           **138s** |              420s |         606 min |
| static                                          |                 603s |               486s |              874s |        2137 min |
| footprint (test-related --with-web)             |                  19s |               297s |              766s |        1309 min |

<!-- END GENERATED MEASUREMENT test-selection-strategies -->

Footprint selection selected no more than static selection on any measured commit. The
with-web mean stays high because many commits touch a module every app-level suite executes at
import (a config schema, a plugin's `index.ts`, render-core's marks), and function-level
selection off V8 coverage added ~27% to every run for ~6% off the mean, since most changed lines
in those modules are top-level.

### The selection is not what makes a run long

`test-related` prints `N suite(s), ~Xs of suite time`, priced from jest's sequencer cache
(`perf-cache-*`) at the **minimum** each suite has recorded: a duration is what the box allowed
that day (one suite sits at 6.1s in one cache and 3979s in another), and the floor describes the
work. Read that figure before the clock, since on a laptop with a dozen agent sessions the two
barely relate.

What separates a gated from an ungated run is worker count. `resolveMaxWorkers` in
`jest.config.js` subtracts the load average for an agent session, so on a box driven to 30+
every ungated run collapses to one worker (the same 229 suites took ~4× longer ungated). So
`pnpm test`, `pnpm test-related` and `pnpm test-ci-no-react-compiler` take one of the three
machine-wide slots `scripts/heavy-run-slot.sh` hands out (shared with the typechecks); a run
that holds one skips the load haircut and uses its ceiling, and the rest sleep in `flock`.
`test-related` takes its slot around the jest spawn only, so a change selecting nothing never
queues. **A bare `npx jest` stays ungated on purpose** (the one-file run); `npx jest <dir>` goes
around the gate, so name files.

### Where a warm `pnpm test` spends its time

**Read the whole suite, not a directory of it**: a measurement over `packages/core/src/util`
(~0.1s suites) read jest's own startup and concluded worker count did not matter.

<!-- BEGIN GENERATED MEASUREMENT jest-worker-scaling -->

_Generated by `pnpm autogen` — edit the source, not this block._

| workers | wall clock | Σ per-suite | worker occupancy | peak RSS |
| ------: | ---------: | ----------: | ---------------: | -------: |
|       4 |       322s |       1243s |            3.86x |   6.7 GB |
|       8 |   **216s** |       1656s |            7.67x |  12.2 GB |
|      12 |       197s |       2264s |           11.49x |  18.1 GB |
|      16 |       199s |       3035s |           15.25x |  25.3 GB |

<!-- END GENERATED MEASUREMENT jest-worker-scaling -->

Workers are ~97% occupied at every count; what does not scale is **per-suite cost under
contention**, so the last doubling is worth nothing and memory keeps growing.

- **The graph is the shape of the cost.** ~260 suites (jbrowse-web's own plus the plugin suites
  importing `@jbrowse/web`) carry ~2,900 modules each and over half the clock. Per-suite overhead
  fits `0.167s + 0.419ms × modules`.
- **Module import is memoized per worker PROCESS, not per suite.** A lever that looks per-suite in
  a one-suite measurement is usually per-worker in a real run and worth a fraction of it.
- **The floor is ~31ms per suite** (jsdom, `setupFiles`, `setupFilesAfterEnv`, teardown), which is
  why a jsdom-to-`node` sweep buys nothing. **Everything above it is the import graph re-executed
  per test FILE**: jest builds a fresh module registry per file, so a warm transform cache saves
  the *transpile* and not the *run*. `doBeforeEach` is ~0.04ms a call and its cache clears
  (`clearCache()`, `clearAdapterCache()`) are free isolation; don't remove them for speed.
- **`config/jest/babelTransform.cjs` computes its own cache key**, because babel-jest's
  `loadPartialConfigSync` per module cost more than the transform it guards. The key contains
  nothing absolute, so a worktree reads the cache the primary filled.
- **`roots` names the four directories `testMatch` anchors on**; jest otherwise crawled ~42,000
  files (including the website corpus).
- **The worker ceiling is a ceiling** (8 interactive, 4 for an agent) that `MemAvailable` and load
  average pull down.

**Levers that generalise** (each measured with an interleaved A/B on the affected suites):

- **A debounce is a `setTimeout`, so a suite that only waits for one belongs on a fake clock.**
  `jest.useFakeTimers()` plus `jest.advanceTimersByTimeAsync(POLL_MS)` inside the quiescence
  poller took `installPerRegionFetchAutoruns` from 50s (48s idle) to ~2s, and Manhattan's
  `retryContract` from 16s to 2s, without losing sabotage coverage. It works because everything
  waited on is a timer (`leadingEdgeAutorun`'s debounce, the harness's `fetchDelayMs`) or a
  resolved promise `advanceTimersByTimeAsync` flushes.
- **A settle has a positive signal, and it is nearly always cheaper than the guess.**
  `followSettled` (`products/jbrowse-web/src/tests/syntenyFollowSettle.ts`) waits for no row's
  `coarseDynamicBlocks` to be behind its live ones and for the `SyntenyFollow` autorun to stop,
  replacing sleeps picked off the 500ms debounce (85s → 27s over four suites) and saying the pass
  ran. Where the assertion is what the follow changes, use a plain `waitFor`.
  `waitForRepaintedCanvas` is the same move for a repaint that moves nothing on the model.
- **The `volvoxConfigWithTracks` trim is paid twice**: per `createView` (see below), and again on
  every later `findByText` / `findByRole` / `findByLabelText` scan of the document it leaves. The
  boundary is real: `SyntenyImportForm` scans the whole track list for its assembly pair, so only
  its `three level` test takes the trim.
- **Work nobody reads**: a loop walking 100M iterations to read two ticks, per-node assertions on
  a growing tree (~1.4M), a shader sweep at 400 rows per segment where 100 catches the same
  sabotage. Profile a slow suite before assuming the harness is at fault.
- **Merging sibling suites that differ by an argument** returns ~0.55s median overhead per file
  removed at the cost of scheduling flexibility and `test-related` granularity.
  `plugins/blat/src/liveIsPcr.test.ts` is 18.5s of live UCSC round-trip wherever `UCSC_API_KEY`
  is set.

### A display harness is `createDisplayTestEnvironment`

One builder in `@jbrowse/display-test-utils`, over `displayTestSessionModel` and `testAssembly` /
`testAssemblyManager`. A plugin's `testEnv.ts` names its track type, display type and the two
factories:

```ts
export function createTestEnvironment() {
  return createDisplayTestEnvironment<LinearHicDisplayModel>({
    trackType: 'HicTrack',
    displayName: 'LinearHicDisplay',
    configSchema: () => configSchemaF(),
    stateModel: (_pm, schema) => stateModelFactory(schema),
    viewModel: linearGenomeViewStateModelFactory,
  })
}
```

The caller supplies `plugins` and `viewModel` because the package sits above `plugins/` in the
workspace layering. **Don't hand-roll one**: hand-rolled copies muted every display-contract check
with a copied `console.error = jest.fn()`, left `palette` out of two harnesses while every model
color getter reads it, and left `displays[0]` un-annotated so suites asserted against `any`.

- **`rpcCall`**: the body `mockRpcCall` wraps. Bare by default (resolves `undefined` for every
  method); a byte-gated display needs one answering `CoreGetRegionByteEstimate`, or its fetch never
  commits and the suite reads as a broken display.
- **`displayConfig`**: display config **slots**, written into the track config's own `displays`
  entry and referenced by id, because a slot name on a display's *session* snapshot is dropped
  silently (ARCHITECTURE.md, "where a display's state lives"). `displaySnapshot` on `createDisplay`
  is the MST-property half.
- **`adapter.config`**: omitted it is `{ type: name }`; present-but-`undefined` registers the type
  and puts **no** adapter on the track (how a test asserts the fallback).

The session shim is not annotated as `AbstractSessionModel`, so a member added to that interface
is a runtime `TypeError`, not a compile error. Silence `console.warn` if a harness must, never
`console.error`: it is the channel the contract checks report through, and
`config/jest/contractGate.js` fails the test that collected one.

### An autorun's dependency set is assertable

Every autorun installer (`leadingEdgeAutorun`, `autorunOnReadyView`,
`RenderLifecycleMixin.attachRenderingBackend`) builds its reaction through `namedAutorun`.
`reactionDependencies(node, name)` from `@jbrowse/render-core/namedReactions` returns the leaf
observables it subscribed to on its last run, sorted, as `Model.prop` names. Use it when the
property under test is *which reads are tracked* (a trigger above a gate, a guard that must stay
`untracked`), stating the list per state. `installPerRegionFetchAutoruns.test.ts` and
`RenderLifecycleMixin.test.ts` have the shape. Name an ad-hoc observable
(`observable.map(undefined, { name: 'data' })`); the default `ObservableMap@N` carries a
per-process counter.

## Wait signals

**Do not** wait on `LoadingOverlay` text: it keeps the literal `"Loading"` in the DOM at
`opacity:0`, so a `textContent` check is always true.

- `data-testid="loading-overlay"` **absent** → data finished **fetching** (`waitForLoadingToComplete`
  / `waitForDataLoaded`, the snapshot waits).
- `data-display-drawn="true"` → canvas finished **painting** (gated on `painted`, published by
  `DisplayChrome` from its required `testid` base, and by `RenderCanvas` for the two chrome-less
  views). The testid names the display TYPE and is stable (ADR-065 removed the `-done` suffix).
  Don't hand-write the conjunction: `displayPainted(base)` / `displaySettled(base)` come from
  `@jbrowse/capture` (re-exported by `@jbrowse/browser-test-utils`) for selectors, and
  `findDisplayPainted` / `findAnyDisplayPainted` are the jest waits
  (`products/jbrowse-web/src/tests/util.tsx`), which report *which* half failed
  ([DISPLAYCHROME.md](DISPLAYCHROME.md), "One element per display"). Tests that pixel-match the
  canvas wait with `findDisplayPainted`, then read the inner `<canvas>`'s static selector
  (`hic_canvas`, `ld_canvas`, `variant_canvas`, `variant_matrix_canvas`); `canvasSnapshot` takes
  the exact selector.

## What a `createView()` costs

Most of it is the **track selector**. `defaultSession` leaves the hierarchical selector open and
`useMeasure` is mocked to `height: 100000` (`packages/__mocks__/@jbrowse/core/util/useMeasure.ts`)
so `HierarchicalTree`'s virtualization never engages: every test mounts a row per track before it
does anything. There is no single hotspot (ordinary rendering of ~115 rows).

The document it leaves is also what every later `findBy*` scans. `getByLabelText` and `getAllByRole`
walk every element and ask jsdom for labels/role, which is quadratic on a large document. Prefer
`findByTestId` / `findByPlaceholderText` / `findByText` in full-app tests. The absolute cost is
unsettled (timings ranged from 0.2s to 17s a call on a noisy box), so don't sweep the whole
`ByLabelText` category on this account.

`volvoxConfigWithTracks(['...'])` (`products/jbrowse-web/src/tests/util.tsx`) is the lever: a suite
names the tracks it opens and stops paying for the rest, while the track is still switched on
through the real selector. It throws on an unknown trackId but not on an assembly's own sequence
track. **Don't trim a suite that reads the track list itself** (categories, filter text, counts,
picking a track by name, asserting what is *not* shown): `LGVSynteny`, `SVInspector`'s "Open from
track", `CopyAndDelete`'s delete path, `BasicLinearGenomeView`'s selector and reorder tests. A suite
can take the trim per call rather than per file. The mock's height is the bigger lever (500 cut init
to ~1.0s) but then only 37 rows render and any test naming a track further down fails.

### `fireEvent`, not `userEvent`

`userEvent.click` replays a whole pointer sequence, each step in `act()` against a mounted app:
~260ms a click against ~6ms for `fireEvent.click`. Converting ~100 sites cut affected suites'
test-body time ~22%. Three cases need `userEvent`, and the full-suite run finds them (expect a
failure, not a slow test, if you convert one back):

- **A focus guard.** `GridBookmarkWidget`'s hotkeys fire only when the view has focus, and only a
  real pointer sequence focuses `tracksContainer`.
- **A non-input target.** A `<div>` highlight-label cell has no value setter for
  `fireEvent.change`.
- **MUI Autocomplete.** It opens its listbox off the focus/pointer sequence
  (`BasicLinearGenomeView`'s refName dropdown).

`user.type` on a plain text field is one `fireEvent.change`, which replaces the whole value, so a
preceding `user.clear` is redundant.

### Benchmarking on a shared box is unreliable

With several agents running suites, per-suite wall time moves ±30s between runs on untouched suites,
and a full-suite before/after disagreed in sign with an in-band A/B. Judge a perf change by an
interleaved A/B of the affected suites, or `--runInBand` on both arms; treat a single full-suite wall
time as noise. A suite that times out under load and passes alone (`AuthenticationHTTPBasic`) is not
a regression.

## Image snapshots go stale invisibly

`jest-image-snapshot` writes `__image_snapshots__/*-snap.png` beside the suite, **outside** jest's
obsolete-snapshot tracking, so a snapshot whose test was renamed, deleted or stopped calling
`expectCanvasMatch` is never reported. **Don't enable the library's reporter**
(`jest-image-snapshot/src/outdated-snapshot-reporter`, gated on
`JEST_IMAGE_SNAPSHOT_TRACK_OBSOLETE`): it deletes every `-snap.png` in any touched directory that the
run did not write. `__image_snapshots__` is shared per test *directory*, so every `test.skip`
there looks obsolete, and it deletes on filtered runs too (`jest BigWig.test.tsx` would wipe every
other jbrowse-web golden). The **instrumentation** is safe alone: the env var without the reporter
appends each compared file to `.jest-image-snapshot-touched-files` for diffing against disk, but
needs a fully green whole-repo run, since a failing or filtered run under-reports the touched set.

## Troubleshooting

- **Stale build / `ChunkLoadError: Loading chunk N failed`**: `rm -rf build && pnpm --filter
  @jbrowse/web build`.
- **Startup crash / `ERR_INSUFFICIENT_RESOURCES` / "HistoryService::Init() failed"**: corrupted
  Puppeteer cache: `rm -rf /tmp/puppeteer_* /tmp/org.chromium.*`.
- **"libpxbackend-1.0.so not found"**: system snap Chrome is broken; use Puppeteer's cached binary
  (`~/.cache/puppeteer/`).
- **Port 3333 in use / stray processes**: `fuser -k 3333/tcp`. Never `pkill chrome`: other agents run
  browsers on this machine. `runner.ts` reaps only orphaned automation browsers at startup
  (`browser-tests/staleBrowsers.ts`, Linux-only) and force-kills its own on exit.
- **`Attempted to use detached Frame` then `Session closed`, with no `pageerror`, crash event or
  navigation**: something outside the page SIGKILLed the browser's main process (a renderer kill
  reports `Page crashed!`). Look for a runner or `pkill` that started elsewhere at that second.
- **Console errors**: the runner forwards `[alignments]` / `[webgl-wiggle]` logs; add patterns in
  `runner.ts`.
- **A `waitFor` burning its full 30s, blamed on a line that never ran.** In
  `products/jbrowse-web/src/tests`, `view.tracks[0].displays[0]` is **`any`**, so a getter that does
  not exist typechecks and fails at runtime, and jest prints the *last* error with source, pointing
  several lines from the real one (`display.sashimiSections` never existed). When a test touches more
  than a member or two off a display, annotate it with the real model type
  (`LinearAlignmentsDisplayModel`; `AlignmentGroupBy.test.tsx` is the example) and expect
  `noUncheckedIndexedAccess` errors `any` was hiding. A plausible member that resolves nowhere is
  probably a pre-migration shape (the `PileupDisplay`/`SNPCoverageDisplay` sub-nodes were flattened
  into `LinearAlignmentsDisplay`, see `sessionMigrations`).

### Cross-test memory growth is SwiftShader, not a JBrowse leak

JBrowse disposes GL contexts 1:1 (`useRenderingBackend` unmount + `pagehide`;
`webgl2Hal.dispose()`) and the main JS heap stays flat. The unbounded growth is Chrome's
**GPU-process RSS under SwiftShader**, which never returns per-context memory to the OS. Headless
always falls back to SwiftShader, so it is not a CI fix. `runner.ts` recycles the browser per test
(`adr-024-per-backend-snapshots-real-gpu.md`). Repro: `?webgl2-debug=1` telemetry and watch
`--type=gpu-process` RSS via `ps -o rss=,args=`. A separate lower-severity **product** leak: closing
a track retains its detached `TrackContainer` subtree, GC-rooted via a leaked listener or the
HAL-held canvas.
