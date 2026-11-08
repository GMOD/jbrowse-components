---
name: test-infrastructure
description: Browser and unit tests and WebGPU CI, which suites a change selects and which it misses, running jest by hand, and the jsdom, MST and fixture shapes that pass while testing nothing. Read when running or writing tests.
audience: internal
kind: operations
---

# Test Infrastructure

Browser tests (Puppeteer) in `products/jbrowse-web/browser-tests/` (suites in
`suites/`, run with `node browser-tests/runner.ts`, flags `--backend`,
`--filter`, `--headed`, `--update-snapshots`; build first with
`pnpm --filter @jbrowse/web build`); unit tests (Jest) co-located as
`*.test.ts`.

## Browser tests

### Golden snapshots

Visual regression via pixelmatch, stored per backend in
`browser-tests/__snapshots__/{canvas2d,webgl,webgpu}/`. The directory is
untracked: git holds `browser-tests/snapshots.lock`, and the bytes live in the
`jb2-snapshots/` store. **Look at `__snapshots__/<backend>/<name>.diff.png`
before believing a number and before running `-u`.** Goldens carry ordinary
drift from unrelated commits, so a diff percentage alone attributes nothing;
check whether your change can reach those pixels. Two goldens
(`canvas2d/fullpage_methylation.png`, `fullpage_modifications.png`) are blank
pages that `fullPage: true` froze in. `pageSnapshot` captures the viewport
instead; a view that needs more room gets a bigger viewport, never `fullPage`.

**Goldens never run in CI** (they encode one machine's rendering). The
blocking cross-backend gate does run: `pnpm --filter @jbrowse/web
test:browser:gate:ci` diffs canvas2d against swiftshader webgl and needs no
baseline ([CROSS_BACKEND_GATE.md](CROSS_BACKEND_GATE.md) before widening it).

### WebGPU

**A webgpu run fails ~17 tests unrelated to rendering, because it is the Firefox
run.** Read the names before chasing any: SVG Export (the download behavior only
CDP sets), FetchCancellation (`page.createCDPSession()` is Chrome-only),
TransferListDiagnostics (reads Chrome's `DataCloneError` wording), and two
unexplained DOM/text assertions (a canvas label-squeeze check and a dotplot
tooltip). None are goldens, so `--update-snapshots` leaves them alone. Judge a
run by whether failures are on that list, not the tally.

**The webgpu window has to stay in the FOREGROUND.** A backgrounded headed
Firefox throttles rAF, and `page.waitForFunction` polls on **rAF by default**, so
the wait burns its whole timeout on a test that is not broken. Pass `polling:
'mutation'` and give a wait an explicit failure dump. Wall-clock numbers from a
backgrounded run are untrustworthy.

### A fractional dpr needs Chrome's real device scale

**Puppeteer's `deviceScaleFactor` emulation misrenders a fractional dpr.** It
lays the page out on whole CSS px and scales the result. At dpr 1.5 a canvas on
an odd CSS px lands half a device px off, so its cells blur and the overlays
over it smear: SVG lines across three device rows, HTML boxes as one full row
and a half.

- **A screen shows none of it.** With `--force-device-scale-factor`, Chrome
  snaps the canvas and the HTML or SVG over it from the same page offset, as
  Firefox does at `layout.css.devPixelsPerPx`. Both stay crisp at dpr 1 to 2
  and at every page offset `probe-overlay-device-origin.ts --nudge` tried at
  1.25 and 1.5. With the canvas box on whole device px (GPU_SHADERS.md
  §"Canvas scaling & hi-DPI"), its Canvas2D readback finds the store on
  screen 1:1.
- **Element screenshots smear too.** Puppeteer rounds the clip to whole CSS
  px, and Firefox re-renders it a fraction of a device px off. Cut the
  element's device px from a viewport screenshot (`probe-variant-device-grid.ts`'s
  `cropToElement`).
- **`chromeAtDpr`** (`@jbrowse/browser-test-utils`) gives the launch args and
  viewport for a real scale. `probe-overlay-device-origin.ts --emulate-dpr` is
  the control that reproduces the smear.
- **`@jbrowse/capture`'s `dpr` is still emulated**, so a figure takes an
  integer dpr; emulation at dpr 2 draws crisp too.

## Unit tests

Jest, co-located, `pnpm test-ci`. Node-based and fast: use for logic, config, RPC
and buffer packing; browser tests for rendering and UI.

**A jbrowse-web suite that boots no app goes in
`products/jbrowse-web/src/schemaTests`.** `pnpm test` leaves the `jbrowse-web`
jest project to remote CI, since its suites boot the app and took 47% of the
suite clock. The six under `schemaTests` only build a `PluginManager` over
`corePlugins` and read the schemas it registers (slot defaults and enum
vocabularies, the plot examples, `displayDefaults` routing), 3 seconds
together, so they run in the default project and `pnpm test-related` selects
them like any other suite. A suite that creates a session or a view stays in
`src/tests`. `schemaTests/PlotExamples.test.ts` requires a top-level display
key to be one kind (slot, object, list) and one `plot` flag on every display
declaring it, so match the kind (`git grep -n "^\s*<key>: "` over the schemas)
before naming or reshaping one, and run it on the first reshaping commit.

**A `*.ci.test.*` suite is remote-only too.** It is for a suite whose cost buys
nothing at a desk: one that needs a tool a dev box may lack
(`rScriptRun.ci.test.ts`, which its own `R export` workflow runs with R
required), or the exhaustive tier of something a fast suite already samples.
`config/jest/remoteSuites.cjs` names the remote set for `jest.config.js` and
`scripts/test-related.ts` both. `pnpm test` sets `JEST_SCOPE=local`, which drops
the remote projects in the config; `npx jest <path>` still runs one, as
does `pnpm test-related --with-remote`.

### Which suites a change runs

`pnpm test-related` selects by **footprint**: every jest run records, per suite,
the repo files it loaded through jest's module system or read through `fs`
(`config/jest/footprintRuntime.cjs`), and a suite runs when its footprint holds a
changed file. The `fs` reads select a suite that scans the repo, such as a
public-API snapshot reading `package.json`. A directory the suite listed
selects it when a file there is added or removed. A file a suite reads in a
subprocess stays in no footprint. A changed file whose `@babel/preset-typescript` output is
unchanged (comment, type, reflow) selects nothing. `jest.config.js`,
`babel.config.cjs`, `pnpm-lock.yaml` and the `.cjs` files under `config/jest/`
are in no footprint, so a change to one reports a pointer to `pnpm test`. The
static graph (`--findRelatedTests`) is the fallback for a suite with no footprint
yet and cannot discriminate (every jbrowse-web suite imports `corePlugins`).

**A suite that judges your change against files it did not touch is never
selected**, by `test-related` or `jb-test`. Run these by name:

- **A new or removed package export**: that package's `publicApi.test.ts`, and
  the `packages/core/src/ReExports` tests when the ReExports list moved.
- **A `TreeSidebarMixin` member a display now overrides**:
  `packages/tree-sidebar/src/declaredHooks.test.ts`, which refuses an override
  not documented "Overridable hook".
- **An import moved through a barrel**: `scripts/moduleClosure.test.ts`, which
  `pnpm verify` does not run either.
- **A color object, preset, mark rule or key**: the whole plugin directory and
  `products/jbrowse-cli/src/commands/validate`
  (`jb-test -- <plugin dir> products/jbrowse-cli/src/commands/validate`).
  `pnpm autogen` copies the rule modules into the CLI's `markRules/`, where
  `markDisplays.test.ts` wants a case reaching every rule, and a sibling suite
  often pins the old behaviour (MAF's `colorObject.test.ts` beside
  `legendKeys.test.ts`).
- **An SVG export path**: jbrowse-web's export snapshots are a remote project,
  so grep `products/jbrowse-web/src/tests/__snapshots__/` for the markup you
  changed.

The pre-push hook runs the four package.json readers (`declaredDependencies`
and its siblings) itself when a push touches a manifest or an import.

### Running jest by hand

- **From the repo root only.** From a package directory jest misses the root
  `babel.config.cjs`, so an ordinary `foo()!.bar` fails to parse and reads as a
  defect in the file.
- **A variadic flag eats the paths after it.** `--reporters`,
  `--selectProjects` and `--ignoreProjects` written space-separated take every
  later positional as a value: the run dies naming a path, or runs the whole
  project, and with `-u` rewrites its snapshots. Use the `=` form or put the
  paths first. "Ran all test suites in N projects" is the tell. A `schemaTests`
  suite needs no project flag.
- **An agent's run prints only the summary** on a passing suite, and jest drops
  per-test lines whenever more than one file runs. A script counting `✕` passes
  `--verbose` or reads the `Tests:` line; `--reporters=default` shows console
  output.
- **A pasted jbrowse-cli failure may need a TTY to reproduce.** Piped output
  and jest's workers hide TTY-only stderr (a progress bar once landed in
  `error`): `script -qec "npx jest <path> --runInBand" /dev/null 2>&1`.
- **A microtask-only loop hangs jest past its own `testTimeout`**, whose timer
  never gets a turn: a MobX reaction that renavigates the view, or a mocked
  endless `ReadableStream` whose `pull` enqueues synchronously. Wrap a
  suspected hang in `timeout N` with output redirected to a file. Give a mocked
  `pull` a macrotask (`await new Promise(r => setImmediate(r))`). Attribute a
  reaction loop by gating each autorun on an env var and running each way, and
  trace it with `process.stderr.write` and a counter that throws, since
  `console.log` never flushes from a starved loop.

<!-- BEGIN GENERATED MEASUREMENT test-selection-strategies -->

_Generated by `pnpm autogen` — edit the source, not this block._

| selection                                       | median suite-seconds | mean suite-seconds | p90 suite-seconds | all 264 commits |
| ----------------------------------------------- | -------------------: | -----------------: | ----------------: | --------------: |
| static, no web (test-related before footprints) |                 138s |               215s |              599s |         944 min |
| footprint, no web (test-related)                |              **16s** |           **138s** |              420s |         606 min |
| static                                          |                 603s |               486s |              874s |        2137 min |
| footprint (test-related --with-web)             |                  19s |               297s |              766s |        1309 min |


<!-- END GENERATED MEASUREMENT test-selection-strategies -->

### Where a warm `pnpm test` spends its time

**Read the whole suite, not a directory of it**: a measurement over
`packages/core/src/util` (~0.1s suites) read jest's own startup and concluded
worker count did not matter.

<!-- BEGIN GENERATED MEASUREMENT jest-worker-scaling -->

_Generated by `pnpm autogen` — edit the source, not this block._

| workers | wall clock | Σ per-suite | worker occupancy | peak RSS |
| ------: | ---------: | ----------: | ---------------: | -------: |
|       4 |       322s |       1243s |            3.86x |   6.7 GB |
|       8 |   **216s** |       1656s |            7.67x |  12.2 GB |
|      12 |       197s |       2264s |           11.49x |  18.1 GB |
|      16 |       199s |       3035s |           15.25x |  25.3 GB |


<!-- END GENERATED MEASUREMENT jest-worker-scaling -->

- **Everything above the per-suite floor is the import graph re-executed per test
  FILE**: jest builds a fresh module registry per file, so a warm transform cache
  saves the *transpile* and not the *run*. `doBeforeEach`'s cache clears
  (`clearCache()`, `clearAdapterCache()`) are free isolation; don't remove them
  for speed.
- **A suite's cost is the number of files it loads**, each compiled and resolved
  again per file; executing them is the small part (a CPU profile of a suite
  loading `@jbrowse/core/ui`: ~5% in MUI and repo code combined). An empty
  suite costs ~35ms. So the lever is what a suite's graph reaches: an eager
  component in a barrel a model imports (tree-sidebar's dialog took
  `@mui/x-data-grid` and ~550 modules into every row-display model suite)
  costs every suite downstream of it. `scripts/importTrace.ts` names the
  import that brought a module in: run the suites with
  `JEST_IMPORT_TRACE=<file>`, then `--why <regex>` for one module's chain, or
  no flag for the imports bringing the most.
- **A test of a settle runs on a fake clock, drained to the answer**
  (`drained()` in `jbApi.test.ts`, `handleMcpRequest.test.ts`,
  `readyChain.test.ts`): `waitReady` and the capture chain poll and hold for a
  real second, and over a fake app that never goes ready they wait out the
  whole deadline. On the real clock those three suites spent ~65s waiting. A
  not-settled assertion needs a deadline past the 1s hold, or it passes
  whatever the code does; on the fake clock a long one is free.
  `useFakeTimers({ advanceTimers: N })` is no speedup: it moves the clock N ms
  per N ms of real time. Judge a fake-clock change by wall time
  (`/usr/bin/time`), since jest reports durations on the faked clock.
- **`@mui/material`'s root import is rewritten to path imports, in jest only**
  (`config/jest/muiPathImports.cjs`): jest cannot tree-shake, so one root import
  loaded ~500 MUI files. The same rewrite for in-repo barrels
  (`@jbrowse/core/ui`) was measured and declined: ~5% fewer files loaded,
  since most of what it names arrives by other edges, for a test-only import
  order and a rule against mocking a barrel. Taking the components out of
  tree-sidebar's barrel, so a display model reaches only its mixin and menu
  items, was measured the same way: ~30 of ~2000 modules per model suite,
  since each model imports its own display's components.

### A display harness is `createDisplayTestEnvironment`

One builder in `@jbrowse/display-test-utils`; a plugin's `testEnv.ts` names its
track type, display type and the two factories. **Don't hand-roll one**:
hand-rolled copies muted every display-contract check with a copied
`console.error = jest.fn()`, left `palette` out of two harnesses while every
model color getter reads it, and left `displays[0]` un-annotated so suites
asserted against `any`.

- **`displayConfig`** carries display config **slots**. The builder writes them
  into the track config's own `displays` entry and references it by id, because
  a slot name on a display's *session* snapshot is dropped silently
  (ARCHITECTURE.md, "where a display's state lives"). `displaySnapshot` on
  `createDisplay` is the MST-property half.
- **A slot passed to `createDisplay({...})` is dropped**: its argument is the
  state snapshot, so MST discards the undeclared key and a test expecting the
  slot unset passes with nothing exercised. Write it with `setConf`.
- **`baseLinearDisplayConfigSchema` is a default export.** A named import hands
  `ConfigurationSchema` an undefined base, so slots read `undefined` (the byte
  gate's budget is `NaN`) and the lost `displayId` identifier surfaces as
  "Failed to resolve reference". When a slot reads wrong, print
  `getSnapshot(display.configuration)` first.
- **A counter for `isCacheValid`** lives in a closure the model factory
  captures, since a view may not write a volatile (`PerRegionTestControl` in
  `perRegionTestEnv.ts`).

### An export parity suite runs the real display beside its tables export

`packages/tables/src/parity/` checks that a display's `tables.ts` export
decides what the view does, over a matrix of configs. `standUpDisplay`
(`testEnv.ts`) is the one place that does not use
`createDisplayTestEnvironment`, because a parity check needs what that
harness stubs: the real plugins' track type (so a `MultiQuantitativeTrack`'s
display defaults apply), the real adapter, and every RPC run in-process by
its registered method type, so the display fetches with its own args from
the files the export reads. The view shows the export's region end to end at
the export's `bpPerPx`, and it throws if its settled block is not that
region.

To add a display, write one `*.parity.test.ts` holding a `ParityAdapter`
(`testUtils.ts`):

- `decisionNames`: the decisions compared, such as `rows`, `domain`,
  `ticks`, `legend`. `parityCases` runs one test per decision per case.
- `buildModel(config)`: `standUpDisplay` with the plugin, track type,
  display type, an `isDisplay` guard and a `settled` predicate.
- `buildExport(config)`: the `createTablesEngine()` call over the same
  fixture.
- `modelDecisions` and `exportDecisions`: each side's value for every
  decision, normalized only in spelling (hex colors, `''` for unset).

A decision known to disagree goes in the case's `drifts` as `{ owner,
exported }`: the area that owns it and the export's value today. Its test
asserts the export still decides `exported` and the view something else, so
a fix fails with "drift fixed: … delete this entry" and a different wrong
value with "drift changed: …", which prints the new value to re-pin. A case
whose setup throws fails every test in it, drifts included.

The synteny and dotplot suites stand up through `comparative/testEnv.ts`
instead: a real web session (`createTestSession`, RPC on the main thread)
holding two FASTA assemblies and one `SyntenyTrack`, a `LinearSyntenyView`
whose rows open on the export's regions end to end (`windowWidthBp`, not
`bpPerPx`), or a `DotplotView` whose axes hold them at the export's bp per px.
It waits for the display to fetch (`!fetchInert && svgReady`: an inert display
is `svgReady` while its assemblies load) and throws if a row or axis moved.
These suites need `jest.mock('@jbrowse/web/makeWorkerInstance', …)`. Their
decisions (`comparative/testUtils.ts`) are each alignment's drawn marks in
color and alpha, the admitted alignments, the key with its chips composited as
a host does (`legendChipColor` at the export's `alpha`), the opacity level,
and for synteny the contigs the off-screen strips name. The marks' alpha holds
the thin-ribbon fade, but not the auto fade's latch: a fresh view's latch is
the export's unlatched answer, and none of the fixtures holds enough
alignments to reach it.

## Wait signals

**Do not** wait on `LoadingOverlay` text: it keeps the literal `"Loading"` in the
DOM at `opacity:0`, so a `textContent` check is always true.

- `data-testid="loading-overlay"` **absent** → data finished **fetching**
  (`waitForLoadingToComplete` / `waitForDataLoaded`).
- `data-display-drawn="true"` → canvas finished **painting** (gated on `painted`,
  published by `DisplayChrome` from its required `testid` base, and by
  `RenderCanvas` for the two chrome-less views). Don't hand-write the
  conjunction: `displayPainted(base)` / `displaySettled(base)` come from
  `@jbrowse/capture` for selectors, and `findDisplayPainted` /
  `findAnyDisplayPainted` are the jest waits
  (`products/jbrowse-web/src/tests/util.tsx`), which report *which* half failed
  ([DISPLAYCHROME.md](DISPLAYCHROME.md), "One element per display"). Tests that
  pixel-match the canvas wait with `findDisplayPainted`, then read the inner
  `<canvas>`'s static selector; `canvasSnapshot` takes the exact selector.

## What a `createView()` costs

`volvoxConfigWithTracks(['...'])` (`products/jbrowse-web/src/tests/util.tsx`) is
the lever: a suite names the tracks it opens and stops paying for the rest. It
throws on an unknown trackId but not on an assembly's own sequence track.
**Don't trim a suite that reads the track list itself** (categories, filter text,
counts, picking a track by name, asserting what is *not* shown): `LGVSynteny`,
`SVInspector`'s "Open from track", `CopyAndDelete`'s delete path,
`BasicLinearGenomeView`'s selector and reorder tests.

### `fireEvent`, not `userEvent`

`userEvent.click` replays a whole pointer sequence, each step in `act()` against
a mounted app, far slower than `fireEvent.click`. Three cases need `userEvent`,
and the full-suite run finds them (expect a failure, not a slow test, if you
convert one back):

- **A focus guard.** `GridBookmarkWidget`'s hotkeys fire only when the view has
  focus, and only a real pointer sequence focuses `tracksContainer`.
- **A non-input target.** A `<div>` highlight-label cell has no value setter for
  `fireEvent.change`.
- **MUI Autocomplete.** It opens its listbox off the focus/pointer sequence.

## Image snapshots go stale invisibly

`jest-image-snapshot` writes `__image_snapshots__/*-snap.png` beside the suite,
**outside** jest's obsolete-snapshot tracking, so a snapshot whose test was
renamed, deleted or stopped calling `expectCanvasMatch` is never reported.
**Don't enable the library's reporter**
(`JEST_IMAGE_SNAPSHOT_TRACK_OBSOLETE`): it deletes every `-snap.png` in any
touched directory that the run did not write. `__image_snapshots__` is shared per
test *directory*, so every `test.skip` there looks obsolete, and it deletes on
filtered runs too. The env var without the reporter is safe: it appends each
compared file to `.jest-image-snapshot-touched-files` for diffing against disk,
but needs a fully green whole-repo run.

## Tests that pass while testing nothing

jsdom and React Testing Library:

- **Zero rects disarm pointer handlers.** jsdom runs no layout, so a handler
  that measures before it arms returns early and every "nothing happened"
  assertion passes. Assert the plain gesture works in the same file first;
  stub rects as `dragIntegration.test.tsx`'s `stubGeometry` does
  (`config/jest/pointerEvents.js` shims `PointerEvent` and capture).
- **`fireEvent.mouseOver` enters every ancestor**, across portals too, where a
  real pointer stops at the lowest common ancestor. Fire the realistic pair,
  `mouseOut` with a `relatedTarget` (`CascadingMenu.test.tsx`, "cancels it on
  the event a pointer crossing portals really sends").
- **The first `rerender()` after `render()` replaces the DOM node**, and a
  plain `useState` can come back at its initial value. Drive the change through
  an observable (`poster.test.tsx`); assert `isConnected` at the moment of use
  plus a call count (`canvasIdentity.test.tsx`), not `not.toBe(before)`.
- **`renderHook` cannot see commit ordering**: it batches into one render.
  Mount a real component for a ref-callback or effect-ordering bug.
- **`el.value = 'x'` never reaches `onChange`**: React's value tracker ignores
  it. Call `HTMLInputElement.prototype`'s `value` setter, then dispatch a
  bubbling `input` event.
- **An open MUI popover sets `aria-hidden` on the rest of the dialog**, so
  `getByRole` finds nothing after a `PopoverPicker` swatch pick while `getByText`
  still works.

MST and MobX:

- **A `.create()`d root fires `afterCreate` only**, never `afterAttach`, so a
  session mixin's autoruns are missing in a test that creates the composed
  model as the root. Hang it off a parent model and read it back, as every
  product does.
- **A snapshot key no prop declares vanishes at `create`**, with no warning.
  Declare a prop (`types.frozen<T>()` for opaque data) and test the round-trip;
  `packages/product-core/src/heldNodesSurviveTheSession.test.ts` is the canary.
- **An autorun created inside an action first runs when the batch ends**, so
  code later in that action cannot see what it builds.
- **`{ ...mstNode }` keeps props and volatiles, never view getters**, while a
  plain-object fixture's getters do spread. A helper typed over a duck model
  needs one test on a real display (`createDisplay` in
  `model.coupling.test.ts`).
- **`view.setNewView` is a jump**: it settles the coarse blocks on every call,
  so a pan driven by it re-fires anything keyed on `settledDynamicBlocks` each
  frame. Drive pan frames with `view.scrollTo`.

Fixtures:

- **`'ACGT'[lcgState % 4]` writes near poly-A**: a raw LCG's low bits cycle in
  a few steps (3 kb held 16 distinct 15-mers). Take high bits or use
  mulberry32, and count a generated sequence's distinct k-mers before trusting
  a red k-mer test.
- **A probe over a real hosted BAM** cannot use a `UriLocation` (the jsdom fetch
  is mocked), so download the slice and use `LocalPathLocation`; reads without
  MD tags need `getSubAdapter: async () => ({ dataAdapter: {} })` plus any
  sequence config.

## Troubleshooting

- **A test counting an adapter's reads passes or fails by test order.**
  `dataAdapterCache` keys an adapter by its config and only adds a new
  `sessionId` to the entry, so two tests in a file building one config share an
  instance and whatever the first left in its private caches. Call
  `clearAdapterCache()` first in a test that counts reads or asserts a cold
  cache.
- **`nanoid()` returns the same ids in every test of a file**:
  `config/jest/deterministicIds.js` resets its PRNG before each test, so
  module-global state keyed on one collides across tests. In
  `ExportSession.test.tsx`, which mocks `nanoid` with a counter, a snapshot diff
  of nothing but sliding `test-id-N` ordinals means a `nanoid()` call was added
  or removed upstream.
- **A `waitFor` burning its full 30s, blamed on a line that never ran.** In
  `products/jbrowse-web/src/tests`, `view.tracks[0].displays[0]` is **`any`**, so
  a getter that does not exist typechecks and fails at runtime, and jest prints
  the *last* error with source, pointing several lines from the real one. When a
  test touches more than a member or two off a display, annotate it with the real
  model type (`AlignmentGroupBy.test.tsx` is the example). A plausible member that
  resolves nowhere is probably a pre-migration shape (see `sessionMigrations`).
