---
name: test-infrastructure
description: Browser and unit tests and WebGPU CI. Read when running or writing tests, or validating RPC.
audience: internal
---

# Test Infrastructure

Browser tests (Puppeteer) in `products/jbrowse-web/browser-tests/`; unit tests
(Jest) co-located as `*.test.ts`.

## Browser tests

Build first: `pnpm --filter @jbrowse/web build`.

```sh
node browser-tests/runner.ts                 # canvas2d (default)
node browser-tests/runner.ts --backend=webgl
node browser-tests/runner.ts --filter=alignments
node browser-tests/runner.ts --headed         # debug
node browser-tests/runner.ts --update-snapshots
```

~29 suites in `browser-tests/suites/` (alignments, variants, the synteny family,
dotplot, hic, gwas, methylation-modifications, svg-export, color-by-tag,
wiggle-color, main-thread-rpc, basic-lgv, …).

### Golden snapshots

Visual regression via pixelmatch (0.1% pixel-diff threshold), stored per backend
in `browser-tests/__snapshots__/{canvas2d,webgl,webgpu}/`. Cross-backend compare
(`compare-backends.ts`): identical / `<5%` similar / `≥5%` different. Intentional
change → `--update-snapshots`.

**Goldens never run in CI** — they encode one machine's rendering. The
*cross-backend gate* does, blocking, since 2026-08-04: `pnpm test:browser:gate:ci`
renders `CI_GATE_SUITES` (`crossBackendGate.ts`) with canvas2d and swiftshader
webgl in one run and diffs the two, so it needs no committed baseline. Scope and
its reasons live next to the list; `agent-docs/reference/CROSS_BACKEND_GATE.md`
is what to read before widening it.

**`pnpm test:browser:gate` renders webgpu as well and the CI one does not**, and
the difference is the runner rather than the pixels: webgpu is Firefox Nightly,
launched headed, and `ubuntu-latest` has neither the browser nor a display. So
CI's two backends are a coverage gap, not a verdict — `agent-docs/todo/`
carries what closing it needs.

**The 10-25% blank-capture flake was `fullPage: true`** (fixed 2026-07-26).
Puppeteer implements `fullPage` by resizing the viewport to the scroll size and
restoring it afterwards; that resize invalidates the page raster, and under load
the capture comes back before the content has re-rastered — live app chrome
around a white content area, which reads as a large "regression". `pageSnapshot`
now takes a plain viewport screenshot. No golden changed: the app fills the
window, so every full-page golden is exactly 1280x800. A view that needs more
room gets a bigger viewport (`page.setViewport`) — never `fullPage`.

Measured on the alignments suite at concurrency 4: **5/5 runs failed 2-3 tests
with `fullPage`, 4/4 runs clean without it**, same build, same goldens. The DOM
was fully populated at capture time (displays reporting `data-display-drawn`,
ruler text in `innerText`) and an immediate re-capture matched, which is what ruled out a
paint gate as the fix. A single test run alone with `--test=` almost never
reproduces it — the blanking needs the concurrent browser churn.

Two goldens froze that flake in (`canvas2d/fullpage_methylation.png`,
`fullpage_modifications.png` are blank pages), so **still look at
`__snapshots__/<backend>/<name>.diff.png` before believing a number, and before
running `-u`.**

Goldens also carry ordinary drift from unrelated commits: after ~10 days of
alignments work every test still passed while the BAM golden sat at ~2.7% RMSE
(mostly toolbar chrome). So a diff percentage alone attributes nothing — check
whether your change can even reach the pixels in question.

### WebGL / WebGPU

- **WebGL** — fully supported (Chrome headless / Firefox), CI default.
- **WebGPU local** (Firefox real GPU): `--backend=webgpu --headed`; set
  `FIREFOX_NIGHTLY_PATH` or pass `--firefox=/path/to/binary` to locate the binary.
- **WebGPU CI** (Linux + lavapipe): install `mesa-vulkan-drivers`, run under
  `xvfb-run` with `VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json
  --backend=webgpu`. Chrome flags already set in `runner.ts`.
- **macOS** — real GPU, ~10× cost.

**A webgpu run fails ~17 tests that have nothing to do with rendering, because
it is the Firefox run.** Read the names before chasing any of them:

- **SVG Export (11)**, all with an empty error. The export saves through a
  download behavior only CDP sets, so the file never lands and the assertion has
  nothing to say.
- **FetchCancellation (3)**, same empty error — `fetch-cancellation.ts` calls
  `page.createCDPSession()` directly, which is Chrome-only.
- **TransferListDiagnostics (1)**, which reads the *wording* of Chrome's
  `DataCloneError` back out of a postMessage failure. Firefox words it
  differently and the regex says so in the failure message.
- **Two DOM/text assertions** — a canvas label-squeeze check and a dotplot
  tooltip — that are genuinely unexplained rather than known-benign. Neither
  touches the GPU path.

None of these are goldens: a failed test writes none, so `--update-snapshots`
leaves them alone. **The first run after a cold start also fails a test or two
to Firefox profile creation** (`Alignments Read Identity` was the case seen);
they pass on the second. Judge a webgpu run by whether the failures are on that
list, not by the tally.

**The webgpu window has to stay in the FOREGROUND, and a run that loses it
produces failures that look like bugs.** It is a headed Firefox, so another
window taking focus throttles its animation frames — and the failure mode is
nastier than "slow", because `page.waitForFunction` polls on **rAF by default**.
An rAF-polled wait in a backgrounded window stops evaluating entirely and burns
its whole timeout while the page underneath is fine, so the symptom is a clean
`Waiting failed: Nms exceeded` on a test that is not broken. Two defences, and
prefer the first: pass `polling: 'mutation'` (React schedules through
MessageChannel, not rAF, so the DOM still changes — only the observer stalls),
and give a wait an explicit failure dump rather than letting a bare timeout
stand as the diagnosis. The same throttling makes wall-clock numbers from a
probe untrustworthy; a run whose timings are wildly out of line with its
neighbours was probably backgrounded rather than slow.

## Unit tests

Jest, co-located (`*.test.ts`), run with `pnpm test-ci`. Node-based and fast —
use for logic, config, RPC, and buffer packing; use browser tests for rendering
and UI.

### Where a warm `pnpm test` spends its time

Measured 2026-08-30 over all 1978 suites, warm cache, on an otherwise quiet
16-core box. **Read the whole suite, not a directory of it** — the measurement
this replaced was taken over `packages/core/src/util`, whose suites are ~0.1s
each, so it was reading jest's own startup and concluded that worker count did
not matter.

<!-- BEGIN GENERATED MEASUREMENT jest-worker-scaling -->

_Generated by `pnpm autogen` — edit the source, not this block._

| workers | wall clock | Σ per-suite | worker occupancy | peak RSS |
| ------: | ---------: | ----------: | ---------------: | -------: |
|       4 |       322s |       1243s |            3.86x |   6.7 GB |
|       8 |   **216s** |       1656s |            7.67x |  12.2 GB |
|      12 |       197s |       2264s |           11.49x |  18.1 GB |
|      16 |       199s |       3035s |           15.25x |  25.3 GB |

<!-- END GENERATED MEASUREMENT jest-worker-scaling -->

Workers are ~97% occupied at every count, so the suite parallelises; what does
not scale is the **per-suite cost under contention**, which is why the last
doubling is worth nothing and the 12 that buys 9% holds half again the memory.
Split by where the time goes, at 4 workers before any of the fixes below: 951s
inside test bodies, 489s outside them (environment, setup files, module import,
hooks), of a 1440s total against today's 1243s.

Two structural facts behind those numbers:

- **The graph is the shape of the cost.** 1.18M module executions per run.
  260 suites — jbrowse-web's own 164 plus the 70 plugin suites that import
  `@jbrowse/web` — carry ~2,900 modules each and 54% of the clock;
  `products/jbrowse-web` alone is 43%. The other 1,718 suites together are 660s.
  A least-squares fit over the per-suite overheads is
  `0.167s + 0.419ms x modules`.
- **Module import is memoized per worker PROCESS, not per suite.** A worker that
  ran 40 jbrowse-web suites called the transformer's `getCacheKey` ~2,000 times
  in total, not 2,000 per suite, and `workerIdleMemoryLimit` recycled nothing
  across the run (verified by counting the PIDs that transformed anything: 5 for
  164 suites at 4 workers). So a lever that looks per-suite in a one-suite
  measurement is usually per-worker in a real run, and worth an eighth of what
  it looked like.

Four things were paying for nothing and no longer do (2026-08-30):

- **babel-jest's cache key cost more than the transform it guards.** It calls
  `loadPartialConfigSync` — a full babel config resolution, with the
  `rootMode: 'upward'` walk — for every module it is asked about. On one warm
  jbrowse-web suite that was 2028 calls, 897ms of a 12.2s run, and zero actual
  transforms. `config/jest/babelTransform.cjs` now computes its own key: same
  calls, 60ms. Nothing absolute is in it, which is the second reason for it —
  entries are valid in any checkout, so a worktree reads the cache the primary
  filled instead of transpiling the graph cold.
- **jest crawled the whole rootDir**, ~42,000 files, `1000g_cnv_build` and the
  429MB website corpus included. `roots` now names the four directories
  `testMatch` already anchors on: **3.6s → 0.83s of startup on every
  invocation**, which is most of what a single-file run or `pnpm test-related`
  costs.
- **The worker ceiling was a flat 4, and 1 for agent sessions.** It is now a
  ceiling (8 interactive, 4 for an agent) that `MemAvailable` and the load
  average pull down, so a session alone on the box gets the box and fourteen
  concurrent ones still collapse to 1 without hard-coding it.
- **Four suites spent their time on work nobody reads**: `makeTicks` walked 100M
  iterations to read two ticks (29.7s → 1.4s); a layout property test asserted
  per node on a growing tree, ~1.4M assertions (29.3s → 2.4s); a shader sweep
  sampled 400 rows per segment where 100 catches the same sabotage (51.8s →
  11.9s); `testFileReload` booted the full 123-track config for a reload that
  names its one track (12.9s → 10.6s for its suite).

Together: **372s → 216s** for the whole suite, same 20,504 tests green.

### The test files, 2026-08-30

The second pass, after the harness one above. Measured the same way and A/B'd
against itself on the same box within the hour: **Σ per-suite 1305s → 1120s,
wall clock at four workers 346s → 291s**, 1977 suites green either way. Both
sides sit ~7% above the table, which was taken on an idle box — the delta is
what to read, not the totals.

Three levers, and the first two generalise past the files they were used on.

**A debounce is a `setTimeout`, so a suite that only waits for one belongs on a
fake clock.** `installPerRegionFetchAutoruns` was 50.4s of which 48.6s was
`(idle)`: 44 calls to a quiescence poller that has to outlast the 600ms
`FetchVisibleRegions` debounce, holding a worker without using one.
`jest.useFakeTimers()` plus `jest.advanceTimersByTimeAsync(POLL_MS)` inside the
poller took it to **2.3s**, and Manhattan's `retryContract`, the same shape,
**15.9s → 1.9s**. It works because everything those suites wait on is a timer —
`leadingEdgeAutorun` arms one for its debounce, the harness's `fetchDelayMs` is
another, and the RPC between them is a resolved promise that
`advanceTimersByTimeAsync` flushes on the way. Neither poller changed otherwise
and neither lost its sabotage: dropping the fetch autorun's `fetchGeneration`
read fails the same three dependency-set cases, dropping its `reloadCounter`
read the same two.

**A settle has a positive signal, and the signal is nearly always cheaper than
the guess.** The four synteny-follow suites slept through 63s of their 72s on
constants picked off the 500ms coarse-blocks debounce. `followSettled`
(`products/jbrowse-web/src/tests/syntenyFollowSettle.ts`) waits for no row's
`coarseDynamicBlocks` to be behind its live ones — which is exactly "the
debounced autorun has run for the viewport as it stands", since
`setCoarseDynamicBlocks` assigns only on a difference — and then for the
`SyntenyFollow` autorun to stop running. **85.3s → 26.9s** over the four, and it
says the pass ran, which a sleep never did. Where the assertion is itself
something the follow changes, the sleep became a plain `waitFor` on it.
`waitForRepaintedCanvas` is the same move for a change that repaints without
moving anything on the model (`BigWigColor`, 6.2s → 3.6s of bodies), which is
the gap `findSettledDisplay`'s docstring names.

**The `volvoxConfigWithTracks` trim is paid twice, and the second payment is the
larger one.** Per `createView` it is 0.34s (the A/B is in
`BookmarkWidget`, below) — but the document it leaves behind is also what every
later `findByText` / `findByRole` / `findByLabelText` scans, so a suite that
searches is charged again per query. The two text-search suites went **38.1s →
13.8s of bodies** on a trim justified by reading `trix/volvox_meta.json`: the
sixteen tracks the aggregate index names are the only ones a search here can
land on. Twelve suites took it; the boundary is real and `SyntenyImportForm`
found it — its manual import form scans the whole track list for the assembly
pair it launches, and the local-file tests draw a canvas 74% different without
the rest of the list, so only `three level` takes the trim there.

What is left, in order of size, is flat: nothing above 18s and the top twenty
are all real React rendering and painting. `plugins/blat/src/liveIsPcr.test.ts`
is 18.5s of live UCSC round-trip on any box where `UCSC_API_KEY` is set, 16s of
it the rate limit the file waits out on purpose. The one structural lever left
is merging sibling suites that differ by an argument — `AlignmentArcs` /
`AlignmentLinked` / `AlignmentStack`, the six `Launch*View`, the eight
`*ViewInit` — which returns the ~0.55s median per-suite overhead per file
removed and costs scheduling flexibility and `pnpm test-related` granularity.

### A display harness is `createDisplayTestEnvironment`

One builder in `@jbrowse/display-test-utils`, over `displayTestSessionModel` and
`testAssembly` / `testAssemblyManager`. A plugin's `testEnv.ts` names its track
type, its display type and the two factories, and wraps the result when its own
tests want a different `createDisplay` signature:

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

The caller supplies `plugins` and `viewModel` because this package sits above
`plugins/` in the workspace layering and cannot import one.

**Don't hand-roll one.** Ten did, and every failure the arrangement produced was
invisible from inside any one file: nine copied `console.error = jest.fn()` and
muted every display-contract check; twenty-one of twenty-eight session fakes in
the repo lacked `getDisplayTypeDefault`; `palette` was in two harnesses of ten
while every model-side color getter reads it; and half of them left `displays[0]`
un-annotated, so those suites asserted against `any` (folding the last two in
turned up five assertions that had been doing exactly that).

Three options exist because a display genuinely needs them, and each is a
question the copies answered by being read rather than by being asked:

- **`rpcCall`** — the body `mockRpcCall` wraps. Bare by default, which resolves
  `undefined` for every method; a byte-gated display (arc) needs one that answers
  `CoreGetRegionByteEstimate`, or its fetch never commits and the suite reads as
  a broken display.
- **`displayConfig`** — display config **slots**. The builder writes them into
  the track config's own `displays` entry and references it by id, because a slot
  name on a display's *session* snapshot is dropped in silence (ARCHITECTURE.md,
  "where a display's state lives"). `displaySnapshot`, on `createDisplay`, is the
  other half: MST properties.
- **`adapter.config`** — omitted it is `{ type: name }`; present-but-`undefined`
  registers the type and puts **no** adapter on the track, which is how a test
  asserts what a display falls back to when the adapter declares nothing.

The half not yet delivered: the shim is still not annotated as
`AbstractSessionModel`, so a member added to that interface is a runtime
`TypeError` rather than a compile error. It is one shim to annotate now instead
of ten, which is the point of the move.

Silence `console.warn` if a harness must, never `console.error` — that is the
channel the contract checks report through, and `config/jest/contractGate.js`
fails the test that collected one.

### An autorun's dependency set is assertable

Every autorun installer (`leadingEdgeAutorun`, `autorunOnReadyView`,
`RenderLifecycleMixin.attachRenderingBackend`) builds its reaction through
`namedAutorun`, which records it by name on the node as well as disposing it
with one, and `reactionDependencies(node, name)` from
`@jbrowse/render-core/namedReactions` returns the leaf observables it subscribed
to on its last run, sorted, as `Model.prop` names (computeds flattened to what
they read). Use it when the
property under test is *which reads are tracked* — a trigger that must stay
above a gate, a guard that must stay `untracked` — and state the list per state
rather than probing one observable per test. `installPerRegionFetchAutoruns.test.ts`
and `RenderLifecycleMixin.test.ts` have the shape. Name an ad-hoc observable in
such a test (`observable.map(undefined, { name: 'data' })`); the default
`ObservableMap@N` carries a per-process counter.

## Wait signals

Two completion signals. **Do not** wait on `LoadingOverlay` text — it keeps the
literal `"Loading"` in the DOM at `opacity:0`, so a `textContent` check is always
true (this silently burned full snapshot timeouts).

- `data-testid="loading-overlay"` **absent** → data finished **fetching**
  (generic; used by `waitForLoadingToComplete` / `waitForDataLoaded` and the
  snapshot waits).
- `data-display-drawn="true"` → canvas finished **painting** (gated on
  `painted`, published by `DisplayChrome` from its **required** `testid` base
  prop, and by `RenderCanvas` for the two chrome-less views). The testid names
  the display TYPE and is **stable** — it used to gain a `-done` suffix on first
  paint, and ADR-065 removed that, so nothing composes readiness into an id any
  more.

  Don't hand-write the conjunction. `displayPainted(base)` /
  `displaySettled(base)` / `displayById(id)` come from `@jbrowse/capture`
  (re-exported by `@jbrowse/browser-test-utils`) for selector strings, and
  `findDisplayPainted` / `findAnyDisplayPainted` are the jest waits
  (`products/jbrowse-web/src/tests/util.tsx`) — the jest ones report *which*
  half failed, which "no element found" never could. See DISPLAYCHROME.md, "One
  element per display".

  For tests that pixel-match or screenshot the canvas element, the inner
  `<canvas>` carries a **static** selector (`hic_canvas`, `ld_canvas`,
  `variant_canvas`, `variant_matrix_canvas`): wait with `findDisplayPainted`,
  then read the static canvas selector. `canvasSnapshot` takes the exact
  selector — canvas captures are the most reliable.

## What a `createView()` actually costs

Most of it is the **track selector**, not the view. `defaultSession` leaves the
hierarchical selector open, and `useMeasure` is mocked to `height: 100000`
(`packages/__mocks__/@jbrowse/core/util/useMeasure.ts`) so
`HierarchicalTree`'s virtualization never engages — every test mounts a row per
track, all 123 of them, before it has done anything. Measured in isolation:
**~1.5s and a 2094-element document with the stock volvox config, ~0.4s and
~300 elements with one track.** A CPU profile of the init path is
`TrackLabel` / `TreeItem` / `CheckboxLite` / `CascadingMenuButton` /
`MoreHorizGlyph` and the React and emotion work they drive, with no single
hotspot to fix — it is 115 rows of ordinary rendering.

It is paid twice, because the document it leaves behind is what every later
`findBy*` scans. On a 2094-element document `getByTestId` measured ~10ms per
call and **`getByLabelText` 4-17 seconds** — `getAllByRole` is the same shape.
Those two walk every element and ask jsdom for its labels/role, which is
quadratic here, and jsdom's nwsapi result cache only hides it until the next DOM
mutation. Prefer `findByTestId` / `findByPlaceholderText` / `findByText` in
full-app tests; a `ByLabelText` that looks instant in a component test is not.

**The 4-17s is unsettled**: timed at the jsdom level across seven suites on
2026-08-30 it came back at 0.2-0.5s a call, against one documented measurement,
on a box whose own docs say a single timing is noise. It matters only as a
*don't* — the whole `ByLabelText` / `ByRole` category across `products/jbrowse-web`
is ~4s either way, so the sweep is not worth running and nobody should edit the
paragraph above until someone re-times `getByLabelText` deliberately.

`volvoxConfigWithTracks(['...'])` in `products/jbrowse-web/src/tests/util.tsx`
is the lever: a suite names the tracks it opens and stops paying for the rest,
while keeping the coverage it has (the track is still switched on by clicking
its row in the real selector). It throws on an unknown trackId — but not on an
assembly's own sequence track, which is not in `tracks` at all and survives any
trim.

**The in-run figure is 0.34s per `createView`, not the ~1.1s the 1.5s → 0.4s
above implies**, because that pair is a cold isolated measurement. The A/B is
`BookmarkWidget` at eleven calls: 11.1s of test bodies → 7.4s. Then add the
second payment — the searches after it — which is the larger half for a suite
that does any (see "The test files, 2026-08-30").

**Don't trim a suite that reads the track list itself** — categories, filter
text, counts, picking a track out of a listbox by name, or asserting on what is
*not* shown. `LGVSynteny` is the worked example of one that cannot be trimmed;
`SVInspector`'s "Open from track", `CopyAndDelete`'s delete path,
`BasicLinearGenomeView`'s selector and reorder tests and `SyntenyImportForm`'s
three import-form tests are the rest of the list. A suite can take the trim per
call rather than per file, which is how those four keep both.

### `fireEvent`, not `userEvent`

`userEvent.click` replays a whole pointer sequence — pointerover, pointerdown,
mousedown, focus, pointerup, mouseup, click — each wrapped in `act()` against a
mounted JBrowse app. On that DOM it measured **~260ms a click against ~6ms for
`fireEvent.click`**. Converting ~100 sites across this directory cut the
affected suites' test-body time **22.6%** (two interleaved A/B rounds, 22.1% and
23.1%, 90 tests green in both arms). Ticking a track checkbox or walking a menu
does not need the difference, and most of the directory already used `fireEvent`
for exactly those.

Four sites do need it, and each carries a comment saying so — the full-suite run
is what found them, so expect a failure rather than a slow test if you convert
one of these back:

- **A focus guard.** `GridBookmarkWidget`'s hotkeys only fire when the view has
  focus, and only a real pointer sequence focuses `tracksContainer`;
  `fireEvent.click` leaves `activeElement` on `<body>` and the keydown is
  dropped.
- **A non-input target.** Its bookmark-label cell is a `<div>`, so
  `fireEvent.change` fails outright with "element does not have a value setter".
- **MUI Autocomplete.** It opens its listbox off the focus/pointer sequence, so
  a bare click leaves it closed and the following `findByRole('listbox')` burns
  its timeout (`BasicLinearGenomeView`'s refName dropdown).

`user.type` on a plain text field is one `fireEvent.change`, which replaces the
whole value — so a preceding `user.clear` becomes redundant rather than lost.

The mock's height is the bigger, unclaimed lever: dropping it to 500 cut init to
~1.0s across the board, but only 37 rows then render, so every test naming a
track further down the list fails. Trimming per suite gets the same win without
that.

### Benchmarking on this box is unreliable

The dev box runs several agents' test suites at once (load average ~35 on 16
cores was normal while the above was measured). Per-suite wall time moved ±30s
between runs **on suites that were not touched**, and a full-suite before/after
disagreed in sign with an in-band A/B of the same change. Judge a perf change by
an interleaved A/B of the affected suites, or by `--runInBand` on both arms, and
treat a single full-suite wall time as noise. Load also produces spurious
failures: a suite that times out under load and passes alone (`AuthenticationHTTPBasic`
did) is not a regression.

## Image snapshots go stale invisibly

`jest-image-snapshot` writes `__image_snapshots__/*-snap.png` as plain files
beside the suite, **outside** jest's own obsolete-snapshot tracking. So a
snapshot whose test was renamed, deleted, or simply stopped calling
`expectCanvasMatch` is never reported by anything — verified by dropping a
fabricated `…-zzz-fake-orphan-probe-1-snap.png` into a snapshot dir and watching
a full run of that suite pass without a word. Two such orphans were found by
hand in `BigWig.test.tsx` alone, one of them ~30 commits old.

**The library ships a reporter for this and it must not be enabled here.**
`jest-image-snapshot/src/outdated-snapshot-reporter` (gated on
`JEST_IMAGE_SNAPSHOT_TRACK_OBSOLETE`) deletes every `-snap.png` in any directory
the run touched that the run did not itself write. Two properties make that
destructive in this repo:

- `__image_snapshots__` is shared per test *directory*, so one running test
  marks the whole directory live — and every `test.skip` in that directory then
  looks obsolete. There are several (`Alignments`, `ConfigurationEditor`,
  `JBrowse`, …), and regenerating a deleted golden means re-rendering it, which
  this repo only does after a *visually verified* change.
- It deletes on any run, including a filtered one, so `jest BigWig.test.tsx`
  with the flag set wipes every other jbrowse-web golden.

The **instrumentation** is safe on its own: setting the env var without
registering the reporter appends each compared file to
`.jest-image-snapshot-touched-files`, which can be diffed against what is on
disk. That needs a fully green `jest` run over the whole repo — a failing or
filtered run under-reports the touched set and every unreached snapshot reads
as an orphan.

## Troubleshooting

- **Stale build / `ChunkLoadError: Loading chunk N failed`** — rebuild:
  `rm -rf build && pnpm --filter @jbrowse/web build`.
- **Startup crash / `ERR_INSUFFICIENT_RESOURCES` / "HistoryService::Init() failed"**
  — corrupted Puppeteer cache: `rm -rf /tmp/puppeteer_* /tmp/org.chromium.*`.
- **"libpxbackend-1.0.so not found"** — system snap Chrome is broken; use
  Puppeteer's cached binary (`~/.cache/puppeteer/`).
- **Port 3333 in use (`EADDRINUSE`) / stray processes** — `fuser -k 3333/tcp`.
  Never `pkill chrome`: other agents run browsers on this machine. `runner.ts`
  reaps only orphaned automation browsers at startup — those whose launching
  `node` is gone, told by the parent's `/proc/<pid>/exe`
  (`browser-tests/staleBrowsers.ts`, Linux-only) — and force-kills its own on
  exit.
- **`Attempted to use detached Frame` then `Session closed` some seconds into
  a page, with no `pageerror`, no `error` crash event and no navigation** —
  something outside the page SIGKILLed the browser's main process. A renderer
  kill reports as `Page crashed!`; a GPU or utility kill is invisible. Look for
  a runner or a `pkill` that started elsewhere on the machine at that second
  (this was the reaper itself, reading Node 24's `MainThread` as not-`node`,
  2026-08-25).
- **Console errors** — runner forwards `[alignments]` / `[webgl-wiggle]` logs;
  add patterns in `runner.ts`.
- **A `waitFor` that burns its full 30s, blamed on a line that never ran.** In
  `products/jbrowse-web/src/tests`, `view` is typed but
  `view.tracks[0].displays[0]` is **`any`** — so a getter that does not exist on
  the display model typechecks fine and fails only at runtime. Jest then prints
  the *last* error with surrounding source, pointing several lines below the
  real one. This cost a long debug once: `display.sashimiSections` never existed
  (it is `sashimiArcSections`), but the reported error named `data.sashimiX1` on
  an unreached line. When a test touches more than a member or two off a
  display, annotate it with the real exported model type — e.g.
  `LinearAlignmentsDisplayModel` from `@jbrowse/plugin-alignments`, which
  jbrowse-web already depends on. `AlignmentGroupBy.test.tsx` is the worked
  example. Expect a batch of `noUncheckedIndexedAccess` errors that `any` was
  hiding. If a member looks plausible but resolves nowhere, suspect a
  pre-migration shape: the nested `PileupDisplay`/`SNPCoverageDisplay` sub-nodes
  were flattened into `LinearAlignmentsDisplay` (see `sessionMigrations`), and
  dead `xtest`s referenced them for years afterward.

### Cross-test memory growth is SwiftShader, not a JBrowse leak

(Measured 2026-05-29.) JBrowse disposes GL contexts 1:1 (`useRenderingBackend` unmount +
`pagehide`; `webgl2Hal.dispose()` frees every GL object) and the main JS heap
stays flat. The unbounded `~29 MB/cycle` is Chrome's **GPU-process RSS under
SwiftShader**, which never returns per-context memory to the OS — unfixable from
JS. Headless always falls back to SwiftShader (even with `--ignore-gpu-blocklist`);
only headed-on-a-real-GPU avoids it, so it is **not** a CI fix. Mitigation:
`runner.ts` recycles the browser per test (see
`adr-024-per-backend-snapshots-real-gpu.md`). Repro: enable `?webgl2-debug=1`
(or `window.DEBUG.webgl2=true`) telemetry and watch `--type=gpu-process` RSS via
`ps -o rss=,args=`.

A separate, lower-severity **product** leak (not a test-cleanliness problem,
since the browser recycles per test): closing a track retains its entire
detached `TrackContainer` subtree (~55 nodes, ~6 listeners/cycle), GC-rooted via
a leaked listener or the HAL-held canvas.

## Open follow-ups

- **Refresh the drifted goldens on a quiet worktree.** Last full run: the two
  blank methylation/modifications full-page goldens plus ~15 targeted ones
  (bigwig, hic, long-reads/inversions, multi-region, demo-inventory) fail
  deterministically against a clean build — real rendering drift since the
  Jul 16 refresh (`452396ab97`). Regenerating needs a worktree nobody else is
  rebuilding in, or the goldens capture another agent's uncommitted work.
- **`HiC mirrors on a reversed region` fails an assertion, not a snapshot**
  (`err vs mirrored-forward 577` should be well under `err vs forward 728`), and
  both `Variant Force Load` tests time out waiting for the Force-load button —
  the too-large gate never trips. Both reproduce run to run; neither is flake.
- **Profile the ~32s full-page synteny capture.** Now that `pageSnapshot` skips
  the viewport resize, re-measure before optimizing; canvas-only captures of the
  same view were the fast path.
