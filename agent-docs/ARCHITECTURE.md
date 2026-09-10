---
name: architecture
description: How JBrowse renders a track — the pipeline, the display stacks, and every rule stated flat with a link to the reference doc that argues it. Read first when touching a display or its data flow.
---

# Architecture

The mental model, the composition tables, and the rules. Every rule is stated
flat in [What not to do](#what-not-to-do) and argued in a `reference/` doc or a
section below, so read the checklist for the task at hand and follow one link.
[reference/README.md](reference/README.md) is the generated index of every
reference doc.

## Overview

A **display** is the object that draws one track inside a view — the pileup in
an alignments track, the bars in a wiggle track, the matrix in a Hi-C track. A
worker fetches and parses off the UI thread, the main thread uploads the result
once and then redraws it every frame, and the frame goes through whichever of
three interchangeable backends the runtime picked.

worker: adapter → features (absolute uint32 bp) → RPC → main: `model.rpcDataMap`
(observable) → upload autorun on data change → GPU buffers (HAL: WebGPU → WebGL2
→ Canvas2D) → render autorun on any visible change → `<canvas>`. SVG export
reuses the same Canvas2D draw fn, never the shader.


Every canvas-drawing display **must** provide a Canvas2D draw function; the GPU
shader path is an optional accelerator layered on top. Drawing to a canvas is
itself a choice: the arc classes own a plain Canvas2D of their own and emit JSX
`<path>` elements on the export path, and circular view's `ChordVariantDisplay`
is SVG on both paths.

## Vocabulary

- **Display** — the subject of this doc. Composed from MST mixins that supply
  its behavior: fetch, render lifecycle, height.
- **Backend** — the per-display object that actually draws, GPU or Canvas2D,
  both built by `createMarkBackend` from the display's mark list; the ladder
  picks one at runtime.
- **Region / block** — the visible genome is split into regions
  (`view.displayedRegions`) and finer render blocks; a display fetches and draws
  per region. `displayedRegionIndex` is the join key between the model's data
  map and the GPU buffers.
- **HAL** — hardware abstraction layer; hides the WebGPU-vs-WebGL2 difference.
- **RPC / worker** — the off-thread context where adapters fetch and parse.
- **MST model / autorun** — a display is a `mobx-state-tree` node; `autorun` is
  the MobX primitive that re-runs a function whenever the observables it read
  change.

## What not to do

The index of this doc's rules, complete rather than meant to be: a rule stated
anywhere in this doc gets a line here. Nearly all of them fail *silently*, which
is what makes them worth listing rather than trusting to review. Every entry
links the section or reference doc that argues it —
`website/scripts/check-architecture-checklist.ts` fails one that links nothing
or links a heading a rename took away, and a section this index never points at
is declared in `STATES_NO_RULES`.

### State, config and composition

- Don't reach for a new MST property when a config slot would do — the slot is
  the default, and a user's edit persists through `trackConfigDeltas` either
  way. And don't write a slot name onto a *session* display node: that node is
  built by the state model, so the key is dropped in silence. See [where a
  display's state lives](#where-a-displays-state-lives).
- Don't rewrite the *value* of an existing constrained slot without
  `addDisplayConfigMigration`. The display `types.union` validates the raw
  snapshot before any schema `preProcessSnapshot` runs, so the union rejects the
  legacy value first and the hook never fires; adding, removing or renaming a
  slot needs none of this. See [where a display's state
  lives](#where-a-displays-state-lives).
- Don't canonicalize a refName worker-side. `renameRegionsIfNeeded` renamed
  `regions[]` before the call, so a second pass renames a name already in the
  adapter's namespace; main-thread text goes through `getCanonicalRefName`, and
  alignments layout looks worker-side and is not. See [coordinate
  system](#coordinate-system).
- Don't give a plugin a dependency on a product. A plugin is a library a third
  party installs and a product is a whole application, so a runtime edge there
  puts an app in the plugin's dependency closure — the one workspace rule with
  no exceptions. A test-only edge is allowed onto `@jbrowse/web` alone. See
  [workspace tiers](#workspace-tiers).
- Don't re-implement a cross-cutting mixin's policy in a display. `scrollTop`
  clamping, grow-mode height and the score axis each arrive by overriding one
  hook (see [Cross-cutting
  mixins](#cross-cutting-mixins-orthogonal-to-the-fetch-foundation)); a
  hand-rolled copy is how four displays came to hold four spellings of the same
  scroll clamp.
- Don't compose `HeightModeMixin()` before `TrackHeightMixin()`. It overrides
  that mixin's `height` and `resizeHeight`, and `types.compose` gives the
  collision to the later argument, so the wrong order silently drops grow mode —
  and the two `height` getters agree in fixed mode, so no value gives it away.
  `no-restricted-syntax` fails the wrong order written in one `types.compose`
  and says what it costs —
  [ordering is the contract](reference/ARCHITECTURAL_LIMITS.md#ordering-is-the-contract).
- Don't chain to `super` in a display's own `afterAttach`. Our MST fork
  auto-chains lifecycle hooks, so calling it installs every fetch autorun twice;
  `assertDisplayContract` reports it in dev, from whichever installer put the
  display's autoruns in. Regular actions still use super-capture. See [the
  pattern](#rpcprops--gpuprops-pattern).

### Fetch

- Don't put fetch-result derivatives (`cellData`, `sampleInfo`, etc.) into
  `rpcProps()`; it is an infinite fetch loop. See
  [the trap](reference/FETCH_KEYS.md#rpcprops-loop-trap-and-how-to-break-it).
- Don't declare `rpcProps`, `regionHasData` or `isCacheValid` in `.actions()`.
  MST runs an action `untracked`, so their reads register no dependency and
  callers silently keep a stale answer; `no-restricted-syntax` fails the
  declaration in source and says why. See [the
  pattern](#rpcprops--gpuprops-pattern).
- Don't let a per-frame viewport value reach `gpuProps()`. A change to it
  re-encodes **every cached region** on the main thread with no RPC, so a live
  `bpPerPx`, `offsetPx` or `visibleRegions` read there does that mid-gesture,
  silently — and the profile blames the encoder rather than the key. MAF's
  `binBp` is the one zoom-derived entry and is debounced and power-of-two
  quantized for exactly this reason. See [what each tier
  costs](reference/FETCH_KEYS.md#what-each-tier-costs-when-it-moves-and-who-is-zoom-sensitive).
- Don't put a pure "go again" signal under a fetch gate. `reloadCounter` and
  friends must be read unconditionally, above the bail-outs — a read inside the
  gate drops out of the dependency set on the run that declines, and nothing
  ever wakes the autorun again. Every fetch carries one; see [the
  trigger list](reference/FETCH_SKELETON.md#the-global-fetch-trigger-list-must-be-read-unconditionally).
- Don't override `fetchNeeded` to return early *without* fetching unless
  something `FetchVisibleRegions` already tracks will wake it. A fetch bumps
  `fetchGeneration`; an early return that skips the fetch breaks that chain and
  must supply its own wake path. See [the trigger
  list](reference/FETCH_SKELETON.md#the-global-fetch-trigger-list-must-be-read-unconditionally).
- Don't give a new fetch installer its first run at the install call. It owes
  that run to a microtask: a model is routinely built and then configured in the
  same synchronous block, and a fetch issued between those two lines is issued
  against un-configured state and reissued. Install order then stops mattering.
  See [the leading edge](reference/FETCH_SKELETON.md#every-fetch-autorun-runs-on-the-leading-edge).
- Don't leave something downstream of a fetch that is only correct because the
  fetch is slower than it. That is a coupling nobody has stated, and the
  empty-versus-stale distinction is where it bites — an empty block list is not
  a stale domain but the fallback one. `settledDynamicBlocks` is the in-tree
  fix. See [the leading edge](reference/FETCH_SKELETON.md#every-fetch-autorun-runs-on-the-leading-edge).
- Don't read something `untracked` because tracking it looks expensive. The
  test is whether the decision branches on it: if it does, it is tracked
  whatever the idle-run cost, and the only three grounds are a self-write, an
  effect input and a dev-only check. `no-restricted-syntax` fails a bare
  `untracked(` and each site names its ground. See [`untracked` names its
  ground](reference/FETCH_SKELETON.md#untracked-names-its-ground-and-a-perf-guard-is-not-one).
- Don't measure bytes anywhere but in the feature RPC. `gateEnabled` is the
  one opt-in and `byteLimit` in the call is the whole display-side contract;
  a separate estimate round trip is the pre-flight path no display issues
  (`CoreGetRegionByteEstimate` survives for track export alone). See
  [the gate summary](#the-region-too-large-gate-summary).
- Don't pass `sessionId` twice. `RpcManager.call` injects the first argument
  into the payload, and `AssertNoCallLevelFields` fails a registry entry that
  declares it. See [the pattern](#rpcprops--gpuprops-pattern).
- Don't ship a `rpcProps()` field whose distinct states serialize identically
  on a **global-family** display, where `JSON.stringify` *is* the comparison: a
  class without `toJSON` flattens to `{}` and an `undefined` drops its key — a
  silently dead cache axis that raises no error. The per-region family compares
  structurally and has neither blind spot. See [the cache key](reference/FETCH_KEYS.md#the-cache-key-is-the-return-value-not-the-reads).
- Don't build a config payload by subtracting from a whole-config snapshot. Pick
  the slots the worker reads, off a key list the compiler checks exhaustive
  against the interface it reads them through; a name nobody thought to exclude
  is a silent RPC cache key, and most of them are inherited from a schema in
  another package. A slot present only to invalidate gets its own named field.
  See [pick the payload](reference/FETCH_KEYS.md#pick-the-payload-out-of-the-snapshot-never-subtract-from-it).
- Don't pass `sequenceAdapter` from a display or a dialog. `renameRegionsIfNeeded`
  derives it from the assembly it already resolved, so a hand-written one is the
  same two lines every other caller deleted. See [the sequence adapter is
  derived](#the-sequence-adapter-is-derived-not-passed).
- Don't override `adapterConfig` to *annotate* it; only to change what the
  adapter is. The cache keys on the config object, so a key the adapter never
  reads still forks the cache into a second instance and a second parse of the
  same file. Pass a worker-side value as a sibling RPC arg instead. See
  [structural args](reference/FETCH_KEYS.md#structural-args-stay-out-of-rpcprops).
- Don't send row *order* to the worker. A fetch argument may name the row set —
  real work — but the order is a permutation the main thread applies for free,
  and sent unsorted it re-enters the cache key anyway. See [row
  order](reference/FETCH_KEYS.md#row-order-is-not-a-fetch-input).
- Don't write a `zoomFetchKey` or `zoomFetchArgs` that reads no observable. The hook is a getter,
  so MST makes it a computed, and a key over non-observable state is memoized
  for the display's life — the first fetch is cached forever and nothing
  refetches it. See [per-region zoom-staleness](reference/ZOOM_FETCH_KEYS.md#per-region-zoom-staleness).
- Don't spell a second tier as a `zoomFetchKey` value, or as a `regionHasData`
  answer over a second map stamped into `loadedRegions`. A coarse tier is its
  own store with its own span (`CoarseTierMixin`); a key naming it reads as
  stale the moment the display swaps tiers and refetches the tier it already
  holds, and a shared stamp narrows the coarse span to the detail's. See
  [per-region zoom-staleness](reference/ZOOM_FETCH_KEYS.md#per-region-zoom-staleness), and [the hook
  table](reference/DISPLAY_HOOKS.md#display-hooks-and-their-defaults) for what every other
  unoverridden hook leaves you with.
- Don't restate `zoomFetchKey`'s string vocabulary in a second derivation. The
  foundation compares the stamp against the key already, as `dataCurrent`'s
  `isCacheValid` term, so a supersession compare states only the live-vs-settled
  half and states it as a **value** compare; a second spelling reads `"16|fine"`
  against a live `"16"` the day the key grows an axis, latches true, and every
  export of that display waits out `awaitSvgReady`'s backstop instead of
  failing.
  `LinearAlignmentsDisplay`'s `dataSuperseded` is the worked example. See
  [per-region zoom-staleness](reference/ZOOM_FETCH_KEYS.md#per-region-zoom-staleness).

### Upload and render

- Don't put upload/render logic in React `useEffect`/`useLayoutEffect` — it
  belongs in the MST autorun pair spawned by `attachRenderingBackend`. See [GPU
  rendering](#gpu-rendering-architecture).
- Don't destructure model methods; call on the model
  ([GPU_RENDERING.md](reference/GPU_RENDERING.md)).
- Don't use `useMemo` for observable-dependent values; use a cached MST view
  ([GPU_RENDERING.md](reference/GPU_RENDERING.md)).
- Don't mutate per-region values in place; emit fresh objects. See [derived
  region maps](reference/FETCH_KEYS.md#gpuprops-and-derived-region-maps--re-upload-without-refetch).
- Don't build a per-region map with a bare `observable.map<number, …>()`. Use
  `regionDataMap()` from `@jbrowse/render-core/regionDataMap`, which is shallow: an entry
  nothing mutates has nothing for MobX's deep enhancer to observe, so the
  per-entry observable graph and the proxy hop on every field read buy no
  reactivity ([ADR-060](architecture-decision-records/adr-060-region-data-maps-are-shallow-observable.md)).
- Don't size an on-screen canvas from `view.trackWidthPx`, or from any of the
  other three plausible view getters. Read `MultiRegionDisplayMixin`'s
  `canvasWidthPx`; `no-restricted-syntax` bans the underlying read everywhere
  but that getter, because a second spelling agrees until it doesn't. SVG export
  is the documented exception — the shell has no outline, so `renderSvg`
  overrides `canvasWidth`. See [SVG export](#svg-export).
- Don't key a shared backend by a list index. Use `sharedBackendKey(self.id)` —
  an index renumbers the moment a sibling is hidden, aliasing one display's
  buffer onto another's slot
  ([SHARED_CANVAS_VIEWS.md](reference/SHARED_CANVAS_VIEWS.md)).
- Don't size a shared canvas from the displays drawing on it; the model that
  owns it lays it out. A band with no display is legal, and reserving 0px there
  while the canvas still paints overlaps the row below
  ([SHARED_CANVAS_VIEWS.md](reference/SHARED_CANVAS_VIEWS.md)).
- Don't skip a shared canvas's render tick when there is nothing to draw — an
  empty frame is what erases a hidden track. Those three, and the rest of the
  shared-canvas contract, are
  [reference/SHARED_CANVAS_VIEWS.md](reference/SHARED_CANVAS_VIEWS.md).
- Don't fold a scalar into a per-instance array. If a setting multiplies every
  element by the same number — plot-wide opacity is the case that bit — it
  belongs in the uniform or draw params, not re-packed across every instance.
  See [derived region
  maps](reference/FETCH_KEYS.md#gpuprops-and-derived-region-maps--re-upload-without-refetch).
- Don't fold cheap work into an expensive derived map. Split the tier so a
  recolor doesn't re-run row placement; see [derived region
  maps](reference/FETCH_KEYS.md#gpuprops-and-derived-region-maps--re-upload-without-refetch).
- Don't make a renderer class the *owner* of per-region data. The model's
  `rpcDataMap` / `laidOutDataMap` is the single source of truth, passed in per
  frame; a renderer-held map is legal only under the conditions in
  [GPU_RENDERING.md § Renderers stay
  stateless](reference/GPU_RENDERING.md#renderers-stay-stateless), which
  alignments alone meets.
- Don't add or redefine volatiles/actions owned by the slot mixin (`canvasDrawn`,
  `renderTick`, `currentRenderingBackend`, `renderError`, `markCanvasDrawn`,
  `resetCanvasDrawn`, `renderNow`, `setRenderError`, `stopRenderingBackend`, etc.).
  `renderError` in particular is the single source for the `renderError` terminal
  phase — don't fork it into a display-local volatile. See
  [GPU_RENDERING.md](reference/GPU_RENDERING.md).

### Chrome, readiness and export

- Don't leave a resting state that never fetches non-terminal. `awaitSvgReady`'s
  only bound is a half-hour backstop, so a user toggle, an unmet prerequisite, a
  standing user cancel or a static "zoom in" mode must reach `svgReady` through
  `error`,
  `regionTooLarge`, `fetchCanceled` or `fetchInert` — otherwise one track hangs
  the whole view's export with the dialog spinner up. Enumerate every way the
  prerequisite fails, not just the throw. See [SVG export](#svg-export).
- Don't ask readiness from a view's raw `bodyMounted`; ask
  `effectiveBodyMounted`, which folds in the answer of every view this one is
  nested inside. The raw flag reads `true` for a nested view that is out of the
  DOM, and every display in it then waits for a first paint nothing will make.
  See [VIEW_INIT.md § a nested view's
  `bodyMounted`](reference/VIEW_INIT.md#a-nested-views-bodymounted-reads-true-while-it-is-out-of-the-dom).
- Don't let a container unmount its own subtree while holding a pointer
  measurement. `mouseleave` cannot fire on an element unmounted under the
  cursor, so the tracker goes on publishing the position the pointer had when
  the banner went up, and the body reads it on its first render after Force load
  or Retry — a crosshair where the cursor is not. `DisplayChromeBaseInner` runs
  `handleMouseLeave()` on the transition. See [terminal
  states](reference/DISPLAYCHROME.md#terminal-states-early-return-their-own-root).
- Don't derive the export's terminal set separately from the loading overlay's.
  They are the same states, plus two readers outside the display
  (`displaysSettled`, the retry check), which is why `fetchInert` is one mixin
  hook rather than a getter each display invents
  ([ADR-082](architecture-decision-records/adr-082-one-hook-for-a-display-that-will-not-fetch.md)).
  See [SVG export](#svg-export).
- Don't stage theme-derived colors in a volatile that a React `useEffect`
  pushes in. The effect only runs on mount, so SVG export and RPC — neither of
  which has a component — render blank; derive them in a getter. And read
  `session.palette`, not `session.theme`: the palette is the serializable,
  toolkit-free one that crosses the RPC boundary. See [theme-derived render
  inputs](reference/FETCH_KEYS.md#theme-derived-render-inputs-are-session-getters-not-pushed-volatiles).
- Don't **store** a hover without clearing it on viewport change, and don't leave
  the clear to the pointer handlers — they cover only the case where the pointer
  is what moved. Either install
  `installClearHoverOnViewportChange` or derive the hit instead; see [a stored
  hover](#a-stored-hover-is-a-volatile-the-viewport-can-invalidate).
- Don't publish a hover under a name of your own. `hoveredFeature` is
  `BaseDisplay`'s hook and the view reads it across every display; a display that
  spells it differently drops out of `session.hovered` in silence. A stored hit
  goes in a differently-named volatile with a getter over it — MST refuses to
  instantiate a volatile over a base computed. See [a stored
  hover](#a-stored-hover-is-a-volatile-the-viewport-can-invalidate).
- Don't install the hover clear yourself *under `MultiRegionDisplayMixin`*, and
  don't skip overriding `clearHoveredFeature` if you store one — the mixin
  installs the reaction and that one action is all a storer owes it. Outside
  that family nothing installs it, so a display or view that stores a hover owes
  the whole reaction — `installClearHoverOnSurfaceMove`
  (`@jbrowse/core/util`), which the two comparative views and the breakpoint
  split view each call with their own transform key. See
  [reference/DISPLAY_HOVER.md](reference/DISPLAY_HOVER.md).

### Backends and generated code

- Don't hand-edit `*.generated.ts` or hand-maintain WGSL/GLSL/offset tables. Edit
  `.slang` and run `pnpm gen:shaders`; CI's `git diff --exit-code` catches stale
  outputs. Consume generated constants by name from TS — never copy a literal
  offset into a renderer. See
  [GPU_RENDERING.md](reference/GPU_RENDERING.md).
- Don't hand-edit a generated markdown block either. Both marker spellings are
  live — `<!-- NAME START -->` and `<!-- BEGIN GENERATED NAME -->` — and `pnpm
  autogen` overwrites the edit at the next run; change the source it scans. See
  [the marker table](CLAUDE.md#frontmatter-and-generated-tables).
- Don't leave a per-instance vertex budget without the input range it covers.
  Where one instance draws an unbounded number of marks, `verticesPerInstance`
  caps how many the shader can address and the Canvas2D path has no such cap, so
  past the budget the GPU silently drops marks the other backend still draws.
  State the range, measured, beside the number. See
  [GPU_RENDERING.md § Keeping the two backends in parity](reference/GPU_RENDERING.md#keeping-the-two-backends-in-parity).
- Don't diverge the two render backends. Import shader constants into TS rather
  than retyping them, put shared glyph geometry/color math in one draw helper, and
  keep multi-layer order/gating in one exhaustively-keyed registry. And don't go
  the other way: a Canvas2D sub-pixel *overdraw* (fudge factor / `f2`) or
  stroke-vs-fill swap is deliberate AA compensation with no shader equivalent —
  don't port it into a `.slang`. See
  [GPU_RENDERING.md § Keeping the two backends in parity](reference/GPU_RENDERING.md#keeping-the-two-backends-in-parity).

## Workspace tiers

The three workspace roots are a direction, not three places to put things:

`packages/*` (libraries: core, render-core, the `*-core` domain libraries, the
leaf utils, and the product-assembly libs) → `plugins/*` (+ `example-plugins/*`,
same tier) → `products/*` (web, desktop, cli, the embedded React components,
img, capture).


Dependencies run **down** this list. Three edges cross it upward on purpose, and
each is recorded with its reason in `scripts/workspaceLayering.test.ts`, which
pins them symmetrically — a new upward edge fails, and so does leaving a stale
entry behind after one is removed. The test exists because pnpm links every
workspace package into the root `node_modules`, so an undeclared import of any
of them typechecks and runs.

The load-bearing rule is the one with no exceptions — **no plugin ships a
dependency on a product.** Test-only edges are allowed onto `@jbrowse/web`
alone, which is where `createTestSession` lives.

## Coordinate system

JBrowse uses **0-based half-open intervals** `[start, end)` internally, matching
BED/BAM. Worker output is **absolute genomic uint32** — no regionStart-relative
arithmetic crosses the worker boundary. The precision machinery that makes this
work on a float32 GPU is in [reference/BP_PRECISION.md](reference/BP_PRECISION.md).

**Positions cross the worker boundary cleanly; names do not.** `refName` means
one thing on the main thread and another to an adapter, and which side is
allowed to canonicalize is a rule of its own —
[reference/REFNAME_NAMESPACES.md](reference/REFNAME_NAMESPACES.md), summarized
in the root `CLAUDE.md`.

## Where a display's state lives

A new setting has three possible homes, and picking wrong fails silently rather
than loudly. Each has its own JSDoc tag and its own generated doc page:

| home | tag | survives a reload? | read/written as |
| --- | --- | --- | --- |
| config slot | `#slot` | yes — in the track config | `getConf`, written with `setConf` |
| MST property | `#property` | yes — in the session snapshot, on the display node | `self.x`, written by an action |
| MST volatile | `#volatile` | no | `self.x`, written by an action |

**The slot is the default, and by a wide margin.** The census below is
**generated** — a display joins it by registering itself with `addDisplayType`,
and its three numbers are the tags its own directory declares. Read the shape
rather than any one row: on most displays the surviving properties are just
`type` and `configuration`, the structural minimum MST needs.

<!-- BEGIN GENERATED DISPLAY_STATE_CENSUS -->

_Generated by `pnpm autogen` — edit the source, not this block._


22 registered displays declare 232 config slots, 48 MST properties and 59 volatiles between them — counting what each display's own directory declares.

<!-- prettier-ignore -->
| Display | Plugin | `#slot` | `#property` | `#volatile` |
| --- | --- | --- | --- | --- |
| `LinearAlignmentsDisplay` | `plugins/alignments` | 46 | 2 | 14 |
| `LinearMarkDisplay` | `plugins/marks` | 45 | 2 | 0 |
| `LinearBasicDisplay` | `plugins/canvas` | 26 | 8 | 12 |
| `LinearMafDisplay` | `plugins/maf` | 20 | 2 | 4 |
| `LDDisplay` | `plugins/variants` | 11 | 0 | 2 |
| `LinearMultiRowFeatureDisplay` | `plugins/canvas` | 11 | 3 | 0 |
| `MultiWaySyntenyDisplay` | `plugins/linear-comparative-view` | 10 | 6 | 12 |
| `LinearHicDisplay` | `plugins/hic` | 8 | 2 | 3 |
| `LinearArcDisplay` | `plugins/arc` | 7 | 2 | 0 |
| `LinearManhattanDisplay` | `plugins/gwas` | 7 | 3 | 0 |
| `LGVSyntenyDisplay` | `plugins/linear-comparative-view` | 6 | 3 | 0 |
| `LinearWiggleDisplay` | `plugins/wiggle` | 6 | 2 | 0 |
| `LinearMultiSampleVariantDisplay` | `plugins/variants` | 5 | 0 | 2 |
| `ChordVariantDisplay` | `plugins/circular-view` | 4 | 3 | 3 |
| `LinearReferenceSequenceDisplay` | `plugins/sequence` | 4 | 2 | 0 |
| `ChordSyntenyDisplay` | `plugins/circular-view` | 3 | 3 | 3 |
| `LinearGCContentDisplay` | `plugins/gccontent` | 3 | 0 | 0 |
| `LinearPairedArcDisplay` | `plugins/arc` | 3 | 2 | 0 |
| `MultiLinearWiggleDisplay` | `plugins/wiggle` | 3 | 0 | 0 |
| `LinearMultiSampleVariantMatrixDisplay` | `plugins/variants` | 2 | 0 | 0 |
| `LinearSyntenyDisplay` | `plugins/linear-comparative-view` | 2 | 2 | 4 |
| `LinearVariantDisplay` | `plugins/variants` | 0 | 1 | 0 |
<!-- END GENERATED DISPLAY_STATE_CENSUS -->

A slot is not admin-only. A user's edit is diffed into `trackConfigDeltas` — a
frozen `trackId → partial config` map on the session — so a slot is
per-instance *and* persistent without the display model holding it
([ADR-032](architecture-decision-records/adr-032-track-config-nodes-are-throwaway-views.md),
which is also why the hydrated config node is a detached scratch root and
`getSession()` on it throws). Volatiles are for what genuinely dies with the
view: `BaseDisplay`'s own are `error`, `statusMessage`, `statusProgress`.

**"A display node" means two different things, and they take opposite keys.**
In **config** (`tracks[].displays[]`) the node is built by the display's config
schema, so slots are live and a state-model property is meaningless. In a
**session** (`views[].tracks[].displays[]`) the node is instantiated by the
state model, so properties are live and a slot name is dropped exactly like a
misspelling: `"height": 250` on a session display node silently does nothing.
`jbrowse validate`'s `checkSessionDisplay` reports them.

**Migrating one:** adding, removing or renaming a slot needs only a
config-schema `preProcessSnapshot`. Rewriting the **value** of an existing
constrained slot must go through `addDisplayConfigMigration`, because the
display `types.union` validates the raw snapshot before any schema hook runs. A
legacy display-instance key that a session migration lifts onto its replacing
slot goes in `migratedDisplayKeys`.

How a slot then reaches the renderer — snapshot, plain object, RPC payload, and
the JEXL callbacks along the way — is
[reference/CONFIG_PATTERN.md](reference/CONFIG_PATTERN.md).

### A stored hover is a volatile the viewport can invalidate

Four things move or remove content under a stationary cursor with no pointer
event to show for it — zoom, `offsetPx`, the display's own `scrollTop`, and the
`regionTooLarge` banner replacing the subtree — so a hit held in a volatile goes
on naming what used to be there. Both LGV foundations install the clear
(`installClearHoverOnViewportChange`) for their families, and a storer outside
them owes its own (`installClearHoverOnSurfaceMove`, `@jbrowse/core/util`).
Deriving the hit from the live pointer instead, as MAF does, needs none of it.
Whichever way, publish it as `hoveredFeature` — `BaseDisplay`'s hook, and what
`LinearGenomeViewContainer` reads to feed `session.hovered`. Which displays
store, which derive, and the axes each installer covers:
[reference/DISPLAY_HOVER.md](reference/DISPLAY_HOVER.md).

## Display stacks

Linear-genome-view displays are built from a small set of **foundation mixins**
on `BaseDisplay`, all sharing `baseLinearDisplayConfigSchema` as their config
base. Which mixins a display composes is the primary axis of code sharing;
*how* it renders (GPU vs Canvas2D) is a separate axis chosen per frame at the
backend factory
([GPU_RENDERING.md § RenderingBackend interfaces per plugin](reference/GPU_RENDERING.md#renderingbackend-interfaces-per-plugin)).

The table is **generated** — both columns. **Displays** comes from the
`#displayFoundation` tags and **Composes** is read off each foundation's own
`types.compose(...)` call. It lists **composers, not inheritors**: a display
that extends another plugin's whole model (`LGVSyntenyDisplay` extends
`LinearAlignmentsDisplay`; both GC-content models extend `LinearWiggleDisplay`;
`LinearBasicDisplay` and `LinearVariantDisplay` extend `LinearCanvasBaseDisplay`)
is covered by the model it extends.

<!-- DISPLAY_FOUNDATION_STACKS START -->

_Generated by `pnpm autogen` — edit the source, not this block._

<!-- prettier-ignore -->
| Foundation (composed on `BaseDisplay`) | Composes | Displays |
| --- | --- | --- |
| `MultiRegionDisplayMixin()` | `RegionTooLargeMixin`, `RenderLifecycleMixin`, `FetchMixin` | `LinearAlignmentsDisplay`, `LinearCanvasBaseDisplay`, `LinearMafDisplay`, `LinearManhattanDisplay`, `LinearMarkDisplay`, `LinearMultiRowFeatureDisplay`, `LinearReferenceSequenceDisplay`, `LinearScoreDisplay`, `LinearWiggleDisplay`, `MultiLinearWiggleDisplay`, `MultiSampleVariantBaseModel` |
| `GlobalFetchMixin()` | `RegionTooLargeMixin`, `RenderLifecycleMixin`, `KeyedFetchMixin` | `LinearArcDisplay`, `LinearHicDisplay`, `LinearPairedArcDisplay`, `MultiWaySyntenyDisplay`, `SharedLDModel` |
| `ComparativeFetchMixin()` | `KeyedFetchMixin` | `DotplotDisplay`, `LinearSyntenyDisplay` |

<!-- DISPLAY_FOUNDATION_STACKS END -->

Read the rows as: per-region fetch, one global dataset, and one dataset keyed
on two views and drawn onto a shared canvas. The LGV two bring the render
lifecycle; the comparative one leaves it to the model that owns the canvas. The
first installs its autoruns for every display that composes it — one
`installPerRegionFetchAutoruns(self)` from the mixin's `afterAttach` — while on
the other two each display installs its own via `installGlobalFetchAutorun` /
`installComparativeFetchAutorun`, both declarations over the same
`installFetch` skeleton ([reference/FETCH_SKELETON.md](reference/FETCH_SKELETON.md)).
The comparative shape — uploads keyed by `sharedBackendKey(self.id)`, an
unconditional repaint, readiness as a required prop — is
[reference/SHARED_CANVAS_VIEWS.md](reference/SHARED_CANVAS_VIEWS.md).

Circular view's `ChordVariantDisplay` is a fourth shape, off this axis: it
paints main-thread JSX SVG, composes none of the fetch foundations, and answers
freshness with its own `ready` getter. It still runs the shared
`computeSvgReady` / `awaitSvgReady` export gate and the shared `installFetch`
skeleton. The arc classes compose `RenderLifecycleMixin` and never install it
(`attachRenderingBackend` is what installs the pair), render
`DisplayStatusChrome` instead of `DisplayChrome`, and answer `painted` from
data arrival rather than a canvas.

### Cross-cutting mixins, orthogonal to the fetch foundation

Several concerns cut across the table above, and each is one mixin with one
overridable hook. Composing the mixin *is* the opt-in; a display that doesn't
override the hook pays nothing. The table is **generated** from the
`#crossCuttingMixin` tags, and **Composed by** is read off `types.compose(...)`
directly — a cross-cutting mixin is opt-in, so a display that should have one
and doesn't just quietly does less, and this column is the only place that
shows up. **Read a short row as a question, not a fact.**

<!-- CROSS_CUTTING_MIXINS START -->

_Generated by `pnpm autogen` — edit the source, not this block._

<!-- prettier-ignore -->
| Mixin | The display supplies | Composed by |
| --- | --- | --- |
| `TrackHeightMixin()` | Internal vertical scroll. `scrollableHeight` (default `Infinity` = doesn't scroll). Brings the clamped `setScrollTop` and the autorun that re-clamps when content shrinks | `LinearAlignmentsDisplay`, `LinearArcDisplay`, `LinearCanvasBaseDisplay`, `LinearHicDisplay`, `LinearMafDisplay`, `LinearManhattanDisplay`, `LinearMarkDisplay`, `LinearMultiRowFeatureDisplay`, `LinearPairedArcDisplay`, `LinearReferenceSequenceDisplay`, `LinearScoreDisplay`, `LinearWiggleDisplay`, `MultiLinearWiggleDisplay`, `MultiSampleVariantBaseModel`, `MultiWaySyntenyDisplay`, `SharedLDModel` |
| `LegendMixin()` | The legend, whole. A display declares the color scales it paints with (`colorScales`, a getter hook) and the mixin derives the key from them (`legendSpec`, through `legendSpecOf`), keeps the `showLegend` slot's getter and setter, dismisses sections one at a time (`dismissLegendSection`, undone by re-showing the legend), answers whether there is a key to offer (`hasLegendKey`) and whether the export parks it beside the plot (`svgLegendWidth`). `DisplayChrome` draws the on-screen key and `renderDisplaySvg` the exported one, so a display places neither | `LinearAlignmentsDisplay`, `LinearCanvasBaseDisplay`, `LinearHicDisplay`, `LinearMafDisplay`, `LinearManhattanDisplay`, `LinearMarkDisplay`, `LinearMultiRowFeatureDisplay`, `LinearWiggleDisplay`, `MultiLinearWiggleDisplay`, `MultiSampleVariantBaseModel`, `MultiWaySyntenyDisplay`, `SharedLDModel` |
| `ContextMenuMixin()` | The right-click state of a display whose menu acts on a | `LinearAlignmentsDisplay`, `LinearCanvasBaseDisplay`, `LinearMafDisplay`, `LinearManhattanDisplay`, `LinearMarkDisplay`, `LinearMultiRowFeatureDisplay`, `MultiLinearWiggleDisplay`, `MultiSampleVariantBaseModel` |
| `StoredHoverMixin()` | A stored hover. The hit type, as the type parameter. Brings the `hoveredFeature` getter `BaseDisplay` declares as a hook, `setHoveredFeature`, and the `clearHoveredFeature` the foundations' viewport-change reaction calls | `LinearManhattanDisplay`, `LinearMarkDisplay`, `LinearMultiRowFeatureDisplay`, `LinearScoreDisplay`, `LinearWiggleDisplay`, `MultiLinearWiggleDisplay`, `MultiSampleVariantBaseModel` |
| `TreeSidebarMixin()` | Row set with a dendrogram sidebar. `sources` (the display rows, named), the three `treeSidebarConfigSchemaFields` slots, plus the `run` callback naming its own clustering RPC and the `sortRows` callback naming what a row carries at a column. Brings `layout` / `clusterTree` / `clusterProvenance` / `treeAreaWidth` / `subtreeFilter`, the `showTree` / `showBranchLength` / `showRowLabels` getters and setters over those slots, the `runClustering` / `clusterRegion` and `sortRowsBy` declarative launch specs `setupTreeSidebarAutoruns` consumes, the `root`, `willClearTree` and `rowOrderIsCustom` getters, and the tree-hover and canvas-ref volatiles the shared sidebar draws through | `LinearMafDisplay`, `LinearMultiRowFeatureDisplay`, `MultiLinearWiggleDisplay`, `MultiSampleVariantBaseModel` |
| `RowHeightMixin()` | The two-valued row height every multi-row display has. A `rowHeightConfigSchemaFields` slot whose `0` means fit-to-display-height, and an `autoRowHeight` getter saying what that fit divides. Brings the raw `rowHeight` getter, `setRowHeight`, and the resolved `effectiveRowHeight` every consumer reads | `LinearMafDisplay`, `LinearMultiRowFeatureDisplay`, `MultiSampleVariantBaseModel` |
| `HeightModeMixin()` | Track-height strategy; the one row that must compose **after** `TrackHeightMixin()`, whose `height` and `resizeHeight` it overrides. `growTargetHeight` (default = the raw slot). Brings `heightMode`/`autoHeight`/`fitHeightToDisplay`, `grownHeight`, the reactive `height` override, `setHeightMode`, and the grow-aware `resizeHeight`, and the grow-exit bake reaction that writes the grown height into the slot when the mode leaves grow | `LinearAlignmentsDisplay`, `LinearCanvasBaseDisplay` |
| `ScoreScaleMixin()` | Score axis. Nothing — the config slots. Brings `scaleType` / `autoscaleType` / `minScore` / `maxScore` / `manual*` / `*Bound` / `hasManualScoreBounds` / `numStdDev` and their setters, i.e. the whole `ScoreScaleModel` interface the shared score menu and `SetMinMaxDialog` consume | `LinearAlignmentsDisplay`, `WiggleScoreConfigMixin` |

<!-- CROSS_CUTTING_MIXINS END -->

Each replaced a policy that had been written out per display, and **the
interface existed before the implementation every time** — a duck-typed
contract that several displays satisfy by hand is a mixin that hasn't been
written yet. Look for the contract, not for the duplication.

The third table — which displays override which of the 25 overridable hooks,
and what sitting on each default costs — is
[reference/DISPLAY_HOOKS.md](reference/DISPLAY_HOOKS.md). Read it before
adding a display: a wrong foundation breaks the display, while every hook has a
default that keeps working and does less.

## Data fetching pipeline

The public
[data fetching guide](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/data_fetching.md)
is the tutorial version of this section. `MultiRegionDisplayMixin`
(`packages/display-kit/src/`) drives the per-region family. Its `afterAttach`
is one call to `installPerRegionFetchAutoruns`, which installs these:

<!-- FETCH_AUTORUNS START -->

_Generated by `pnpm autogen` — edit the source, not this block._

`installPerRegionFetchAutoruns` installs four autoruns:

<!-- prettier-ignore -->
| Autorun | Fires on | Action |
| --- | --- | --- |
| `DisplayedRegionsChange` | `view.displayedRegions` changes | `clearAllRpcData()` |
| `SettingsInvalidate` | `settingsFetchInputs`, the `rpcProps()` return and the adapter config compared structurally | `invalidateSettings()`: supersede the in-flight fetch, clear a blocking error or cancel, drop settings-baked data. `loadedRegions` stays, so the held data draws under the `staleSettingsDrawn` scrim until the refetch lands |
| `ClearBlockingStateOnViewportChange` | `view.visibleRegions` | `clearAllRpcData()` when `error` or `fetchCanceled` is set, so the fetch autorun retries. Not `regionTooLarge`, which is derived and re-measured by the fetch autorun itself |
| `FetchVisibleRegions` | the viewport, `fetchGeneration` after a fetch ends, or `reloadCounter` on a user retry (immediate, then debounced 600 ms) | `fetchNeeded(needed)` for the visible blocks loaded data doesn't cover. While `regionTooLarge` holds it runs that same fetch once per settled viewport — the fetch stops at whichever gate rejected it, and there is no measurement-only path. Skipped while `error` / `fetchCanceled` is set, while a fetch is in flight, and while the track is minimized |

<!-- FETCH_AUTORUNS END -->

Every fetch in the tree — those four, the global and comparative installers,
and the prerequisite reads — runs on one latest-wins skeleton, `installFetch`
/ `runFetchOnce` (`@jbrowse/core/util/installFetch`). What the skeleton owns,
which of an autorun's reads are tracked, why every installer's first run is a
microtask, and why every fetch reads a pure "go again" signal above its gates:
[reference/FETCH_SKELETON.md](reference/FETCH_SKELETON.md). What stales a
region under zoom, and how a coarse tier is a second store rather than a key:
[reference/ZOOM_FETCH_KEYS.md](reference/ZOOM_FETCH_KEYS.md).

### The region-too-large gate (summary)

`regionTooLarge` raises the "region too large" banner and holds off the fetch.
It is a **derived** getter on `RegionTooLargeMixin` — a pure function of the
last byte measurement — and a blocked display keeps fetching once per settled
viewport with the fetch stopping at the measurement, so the banner releases on
a fresh index read with no imperative clear. There is one measurement path:
the feature RPC itself measures, so a display opts in with `gateEnabled` and by
passing `byteLimit` in its call, plus `byteGateAdapterPath` / `densityTooLarge`
where a tier or a density axis applies. Canvas adds the density axis via
`CanvasFeatureGateMixin`, which `no-restricted-syntax` requires after
`MultiRegionDisplayMixin()`. Full detail:
[reference/REGION_TOO_LARGE.md](reference/REGION_TOO_LARGE.md).

### The sequence adapter is derived, not passed

BAM/CRAM decode against the reference, but a track's adapter config doesn't
carry it — the assembly does. The config rides **alongside** `adapterConfig` as
a sibling RPC arg, and **no caller passes it**: `renameRegionsIfNeeded` already
resolved the assembly, so it supplies one to every renaming RPC for free.
`CoreGetRefNames` is the one exception, because it is what renaming calls.
[reference/REFNAME_NAMESPACES.md](reference/REFNAME_NAMESPACES.md#the-rename-also-carries-the-sequence-adapter-and-that-is-why-it-is-derived).

## `rpcProps()` / `gpuProps()` pattern

Domain-named methods that enumerate **what affects rendering output**. Both are
MST view methods (not getters), so subclasses extend them via super-capture:

```ts
.views(self => {
  const { rpcProps: superRpcProps } = self
  return {
    rpcProps() {
      return {
        ...superRpcProps(),
        showOnlyGenes: self.showOnlyGenes,
      }
    },
  }
})
```

| Method | Consumer | Invalidation route |
| --- | --- | --- |
| `rpcProps()` | `rpcManager.call(..., { ...self.rpcProps(), ... })` — RPC payload | The payload as a **value**, never the call — per-region: `settingsFetchInputs` moves and `SettingsInvalidate` supersedes the fetch; global: `installGlobalFetchAutorun` reads the serialized `rpcPropsCacheKey` |
| `gpuProps()` | `buildSourceRenderData(data, self.gpuProps())` — encoder input | Upload callback reads it — re-encodes every cached region, main thread, no RPC |
| Derived region map | Upload callback iterates it in place of raw `rpcDataMap` | Upload autorun reads it — re-uploads without an RPC roundtrip |
| `renderState` | `backend.render(state)` per frame | Render callback reads it — repaint |

`rpcProps()` returns **user-controlled settings only**. Structural args
(`adapterConfig`, `sequenceAdapter`, `region(s)`, `bpPerPx`, `stopToken`) are
spread in at the RPC call site, and `sessionId` belongs in the **first**
argument only — `RpcManager.call` injects it into the payload, and
`AssertNoCallLevelFields` fails a registry entry that declares it in its args.

```ts
rpcManager.call(sessionId, 'RenderXxxData', {
  adapterConfig: self.adapterConfig,  // inherited from BaseDisplayModel
  regions, bpPerPx,                    // per-call values
  ...self.rpcProps(),                  // user settings (cache keys)
  stopToken, statusCallback,
})
```

**The method-shaped fetch hooks must live in `.views()`, never `.actions()`.**
MobX runs an action inside `untracked`, so declaring `rpcProps`,
`regionHasData` or `isCacheValid` as an action makes its reads register no
dependency and every caller silently keeps a stale answer. **A declaration
inside an `.actions()` block is a `no-restricted-syntax` error** in source.

**`assertDisplayContract` is what remains a runtime check**: a display that
wrongly chains to `super` in its own `afterAttach` re-enters the fetch
foundation's hook and installs every autorun twice, and so does composing two
fetch foundations. Dev-only, and `console.error` rather than `throw`. Every
installer calls it once per display; a **secondary** fetch on a display whose
foundation already installed the checks passes no `contract` and skips both.
It lives in `@jbrowse/core`, the lowest tier that can hold it, which is what
lets the comparative installer in `@jbrowse/synteny-core` reach it.

What each tier costs when it moves, why the cache key is the returned value
and not the reads, why a payload is picked from a snapshot and never
subtracted, derived region maps, theme inputs, and the `rpcProps()` loop trap:
[reference/FETCH_KEYS.md](reference/FETCH_KEYS.md).

## GPU rendering architecture

A GPU display composes `RenderLifecycleMixin` and calls
`self.attachRenderingBackend(backend, { upload, render })` in its
`startRenderingBackend(backend)` action. The mixin spawns two autoruns tied to
the model's lifetime: `upload(backend)` pushes bytes to the GPU when the data
changes, `render(backend)` draws a frame when anything visible changes. MobX
auto-tracks every observable read inside each callback. React components are
thin bridges — create a canvas, hand the backend to the model via
`useRenderingBackend` (called inside `DisplayChrome`), render JSX.

The rendering primitives live in **`@jbrowse/render-core`**: the HAL,
`RenderLifecycleMixin`, the backend base classes, the React backend hooks, and
the clip/canvas/hp-math utilities. It is a leaf package (**no**
`@jbrowse/core`), so a third-party display can depend on it directly, and the
GPU API is **static-import-only** — never exposed via the runtime `ReExports`
registry
([ADR-030](architecture-decision-records/adr-030-render-core-package-static-import-only.md)).

Full detail is [reference/GPU_RENDERING.md](reference/GPU_RENDERING.md):

| Section | Read when |
| --- | --- |
| The core contract / The API / What the mixin owns | Wiring a new display's render lifecycle |
| Life of a frame | Debugging "why didn't it redraw", context loss, tab visibility |
| RenderingBackend interfaces per plugin | Declaring a mark list; going Canvas2D-only |
| Keeping the two backends in parity | Touching either a `.slang` or a Canvas2D draw fn |
| Upload patterns / `installUpload` | Choosing what a display keys its payloads by; O(N²) upload bugs |
| HAL / Renderers stay stateless | Touching `packages/render-core/src/hal/` or renderer state |
| Shaders (Slang codegen) | Editing a `.slang` or a generated module |
| Canvas scaling & hi-DPI / `displayedRegionIndex` | Blurry canvases; region↔buffer join keys |
| What this architecture deliberately does not have | Before proposing a render graph, indirect draws, GPU culling, or SSBOs |
| Adding a new GPU display type | The end-to-end checklist |

The chrome around the canvas — phase precedence, the retry contract, why a
terminal state early-returns its own root — is
[reference/DISPLAYCHROME.md](reference/DISPLAYCHROME.md).

## SVG export

SVG export and on-screen rendering share the same pure Canvas2D draw functions,
so a shader-only tweak can't silently diverge the export. Every LGV display's
`renderSvg.tsx` is one call — `renderDisplaySvg(model, opts, XxxSvgBody)` —
which awaits `svgReady` (failing the whole export if that track's data wouldn't
load), resolves the export geometry, and mounts `SvgChrome` around the display's
body component. The body paints via `paintLayer` at the `canvasWidth` the shell
hands it, **not** the on-screen width: that is `MultiRegionDisplayMixin`'s
`canvasWidthPx` (`= lgv.trackWidthPx`), and `no-restricted-syntax` bans the
underlying read everywhere but the getter because four plausible view getters
agree until they don't.

**`awaitSvgReady`'s only bound is a half-hour backstop, so every resting state
that never fetches must be terminal.** A correct `dataCurrent` says whether
held data is current; it cannot say whether data will ever arrive. Each such
state has to reach `svgReady` through `error`, `regionTooLarge`,
`fetchCanceled` or `fetchInert`, and the loading overlay is terminal on the
same set — `fetchInert` is an overridable hook on `FetchMixin` (default
`false`, the strict answer) because a cross-display reader like
`displaysSettled` can only read a name the mixin declares. The full contract —
the freshness gates, the one permitted TypeScript narrow, `paintLayer`'s
raster-vs-vector dispatch, the JSX-SVG exception classes, model-scoped clip
ids, and the resting-state traps worked one by one — is
[reference/SVG_EXPORT.md](reference/SVG_EXPORT.md).
