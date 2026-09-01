---
name: historical
description: Bugs that shaped the current design and corrections to old writeups. Read to understand why something is not done the obvious way, or to avoid a known-bad fix.
audience: internal
---

# Historical notes

Bugs that shaped the current design, and corrections to earlier writeups. None
of this is current behavior — it's kept so a future reader doesn't re-derive a
wrong story or "fix" something back into a known-bad shape. The live docs state
only the current truth; the *why-it-isn't-otherwise* lives here.

## The old block-based (server-side) rendering system

Before the GPU pipeline, JBrowse rendered on the **worker** and shipped rasterized
output to the main thread. This whole path was ripped out of `webgl-poc` on
2026-06-13 (commits `4b89af33ec` / `8b1dacf9ff` / `d2e75b53c1`). Summary of how it
worked, for anyone reading old code, old plugins, or the released 2.x line:

**The unit of work was a block.** The view tiled the visible genome into
region-blocks (`view.dynamicBlocks` / `staticBlocks` → `blockDefinitions.contentBlocks`).
`BaseLinearDisplay`'s state model held a `blockState: types.map(BlockState)`, and a
`blockDefinitionsAutorun` reconciled that map against the view's current content
blocks — adding a `BlockState` for each new block key, deleting stale ones as the
user panned. Each block was an independent render.

**Each block rendered server-side to an image.** A `BlockState`
(`serverSideRenderedBlock.ts`) assembled render args via `renderBlockData` (assembly
check, `display.renderProps()`, config, `rendererTypeName`) and ran
`renderBlockEffect`, which called `rendererType.renderInClient(rpcManager, {...})`.
That dispatched the `CoreRender` RPC to the renderer type in the worker
(`SvgFeatureRenderer`, `DivSequenceRenderer`, wiggle/pileup renderers, etc.), which
laid features out and painted them via `renderToAbstractCanvas` into an SVG string
(or PNG data-url). The result — markup + feature layout data (`maxHeightReached`,
feature-position maps for mouseover) — came back and was stored on the block
(`filled = true`, cached `renderArgs`).

**The main thread only positioned images.** `<LinearBlocks>` / `RenderedBlocks`
laid the returned per-block markup out horizontally at each block's pixel offset;
`ServerSideRenderedBlockContent` was the per-block React component that mounted it.
The main thread did no drawing — pan/zoom re-tiled blocks and re-issued RPCs;
`reload()` cleared `blockState` and re-rendered everything.

**Extension points (still public in core).** Renderers registered via
`addRendererType` and subclassed `ServerSideRendererType` / `BoxRendererType` /
`FeatureRendererType`. `jbrowse-plugin-gdc`, `-icgc`, and the legacy `-mafviewer`
composed `BaseLinearDisplay` and shipped their own renderer types. These core
classes plus `renderToAbstractCanvas` and the `CoreRender` RPC are still exported
from `ReExports`, so the block path can be rebuilt as an external compat plugin.

**Why it was replaced.** Every pan/zoom round-tripped rasterization through the
worker and reconciled a per-block React subtree, so interaction latency scaled with
block count and re-render cost. The GPU pipeline inverts the split: the worker
returns **absolute-uint32 feature data** (not pixels), the main thread uploads it
once to the GPU, and an autorun redraws every frame from the same buffers — so
pan/zoom is a cheap redraw, not a refetch+re-rasterize. The per-block `blockState`
map, per-block RPC, and per-block React components collapsed into a single
`rpcDataMap` + the upload/render autorun pair (`ARCHITECTURE.md` §"Data fetching
pipeline"). Recovery plan for the external compat plugin, and the vetting of which
external plugins survive, is tracked outside these docs (pre-rip anchor
`d673d7e390`).

## regionTooLarge banner: no oscillation (correction)

Earlier writeups (and commit `614465dd51`) described a `regionTooLarge`
oscillation — a "flag thrash / invalidate→refetch loop." **That story was
wrong.** Instrumentation shows `setRegionTooLarge` reaches `true` once and
holds; `clearAllRpcData` and `fetchRegions` do not ping-pong, and the fetch
state machine settles. The real failure that motivated the current terminal-state
handling was React reconciliation, not the fetch machinery. The
`FetchVisibleRegions` gate and `ClearBlockingStateOnViewportChange` clear are
real and correct — they just don't loop during a steady too-large state.

## The byte estimate was a rate, and the rate was fiction (closed 2026-08)

For most of its life the byte gate stored one measurement and scaled it —
`estimatedBytesForVisibleSpan = bytes × visibleBp / measuredSpanBp` — which made
the verdict a pure function of the viewport and let the banner self-release on
zoom-in. That release was the *only* release: `FetchVisibleRegions` skipped while
`regionTooLarge` held, so nothing else could re-measure, which is why reading the
raw measured-span number instead deadlocked (the 50kb→5mb→50kb stuck banner).
Everything downstream was built on the rate — the `AUTO_FORCE_LOAD_BP` floor's
"a small span is a small fetch", the `gateBelowForceLoadFloor` opt-in MAF and
alignments each took, the flooring of both spans at 20kb that made the estimate
flat where the index was.

**Bytes do not follow span.** An index quotes whole blocks, so the estimate is a
step function, and *where* the steps fall is a property of the file rather than
of the index's bin width. Measured on files in this repo: `volvox.maf.bed.gz`
reports an identical 306,719 bytes from 25kb up to 100kb; the whole-genome
`hs37d5.HG002…sv.vcf.gz` is flat at 15,408 from 7.8 Mb of span all the way down,
where the model extrapolated from chr1 predicts 22. A 700x under-report, in the
direction that releases a banner it should hold — so every gated track above the
floor spent a release, an aborted fetch and a re-banner on each zoom step, and
the floor's 20kb was never "roughly the index's resolution" for anything but the
densest files.

The fix was to notice that the skip and the staleness were the same thing. The
fetch autoruns now skip on `regionTooLarge && !gateMeasurementStale`, so a
blocked display runs one fetch per settled viewport; that fetch stops at the gate
that rejected it (an index read and no features, on the byte axis) because every
gated display measures before it fetches. Which retires the rate, the floor on the byte axis, and the
opt-in — see REGION_TOO_LARGE.md § "Measurement follows the viewport".

Two proposals that were costed and did not survive it. **A curve instead of a
ratio** — the adapter sampling its index at a ladder of sub-spans so the main
thread interpolates — measured at 18x the cost of the one call on a whole-genome
region set (2.4s against 133ms, 22 chromosomes), to answer a question only a
blocked track asks, and it would still have been a model. **A separate
measurement-only RPC** issued while blocked would have given canvas the two-call
coordination it is built to avoid, for a measurement its own fetch already takes.

## Derived regionTooLarge replaced an imperative clear-and-reset cycle

The imperative `RegionTooLargeMixin` path flipped a volatile flag inside
`fetchRegions` and cleared it on viewport change. That clear-and-reset caused the
banner to flicker off and back on during small zoom/pan moves that didn't
actually cross the threshold. The derived canvas approach (a pure function of
cached stats × current `bpPerPx`) recomputes the same value before and after, so
`ClearBlockingStateOnViewportChange` is a no-op for it and there's no flicker.

## The region-too-large gate: drifts closed in 2026-08

Each of these is a rule REGION_TOO_LARGE.md now states flatly; this is what the
code looked like before the rule, kept so the rule reads as a decision.

### Two measurement paths, two opt-ins

Five displays ran a
`CoreGetRegionByteEstimate` round trip ahead of their feature fetch — resolve
the adapter, ask the index, return, and leave the feature RPC to resolve the
same adapter again — while canvas measured inside its fetch. The opt-in was the
OR of `measuresBytesPreFlight` and `measuresBytesInFetch`, and the OR existed so
a contributed opt-in could not race the base on compose order; a
`no-restricted-syntax` rule forbade a second `get gateEnabled()`. Folding the
pre-flight into every fetch (`measureRegionBytes` as the first await) retired
the second path, the OR, the pair of names and the lint rule; the compose-order
hazard survives and is caught by a different selector. Two of the three
consumers of the budget also wrote `gateActive ? gateByteLimit : undefined` out
themselves and were kept equal by hand, which is why `resolvedByteLimit()` is
now the only spelling.

### Names that claimed an axis

The shared "may the gate act?" question was
`byteGateActive` and the exemption `byteGateExempt`, while `densityGateActive`
was literally `byteGateActive && …` and `byteGateExempt`'s own docstring said
"on either axis". Two names claiming an axis they had no term from is how a
reader comes to believe force-load only lifts the byte gate — which the mixin's
predecessor actually did, one of the four bugs ADR-074's boolean replaced.
`densityGateEnabled` also defaulted to `true` on the base, putting the five
byte-only displays permanently in `densityGateActive === true` — inert, because
their `densityTooLarge` was the base `false`, and the opposite of what was true.

### The budget slots as RPC cache keys (settled 2026-08-21)

`LinearBasicDisplay`
sent the raw `fetchSizeLimit` / `maxFeatureScreenDensity` slots in a `gateSlots`
field so a budget edit stayed a refetch, while the multi-row display carried
none, and which was right stayed open on the worry that a track would strand at
a budget the user just raised. It does not strand — the verdict is derived from
tracked `getConf` reads and a refused region is never marked loaded — and the
only behaviour the field added was a full refetch of loaded, in-budget regions.
The resolved values had already shipped the same bug once: `maxFeatureDensity`
in `rpcProps()` made crossing the 20 kb floor a `SettingsInvalidate` blank.

### `fetchRegions` marked what it asked for (closed 2026-08-20)

The loaded-region
mark was written from the request list once the work callback returned, while
the display stored from the response — two writers, one fact, disagreeing
exactly when a fetch stores less than it asked for. A refused region then read
as covered: invisible on a first fetch, permanent on a region the reader already
had data for, which is every region they zoomed out from. `ctx.commitRegion`
moved the mark to whoever writes the data.

### A refusal used to refuse the set

Alignments refused every region in a
multi-region view on its largest region's bytes; the per-region helpers stopped
storing the refused region and kept its neighbours' payloads. What survives of
that today is the "kept": since the batch short circuit, the first refusal ends
the fan-out, so only the neighbours that already landed are kept — the point was
always that a refusal never wrongly claims or blanks a sibling, never that the
siblings go on downloading behind a banner that hides them.

### The density comparison was not shared

`featuresPerPx` was, so the worker's
two short-circuits and the banner agreed on the number, but each wrote its own
`>` — a mutation sweep swapped the main thread's for `>=` and no test went red.
`overDensityBudget` is the shared comparison.

### Four wires for one clear (closed 2026-08-25)

The chromosome-nav
`clearByteEstimate()` was spelled in the per-region family's
`DisplayedRegionsChange` autorun and again in LD's, arc's and MultiWaySynteny's
`afterAttach`, with HiC — ungated, so harmless — the one `GlobalFetchMixin`
composer that had none. `RegionTooLargeMixin`'s own `afterAttach` now reads
`view.displayedRegions` beside `byteGateAdapterKey` in one autorun. The same
pass folded `commitByteMeasurement` (one caller) into `commitFetchBytes`,
dropped the test-only `setGateMeasuredViewport`, and folded `measureRegionsBytes`
into `measureRegionBytes`.

### Three budget gaps

All three came from an adapter inheriting whichever display it landed under:
`SplitVcfTabixAdapter` gated five times tighter than the single-file VCF beside
it until it declared its own 5 Mb; `LinearMultiRowFeatureDisplay` and
`LinearMafDisplay` sat on the base 1 Mb while `LinearBasicDisplay` read the same
files at 5 Mb — MAF bannering an ordinary hg38 100-way at a gene-sized window,
found by hand. The budget table was also hand-transcribed and said CRAM 3 Mb for
as long as it took someone to notice, in two docs at once. `scripts/check-gated-adapter-budgets.ts`
and the generated table are the answer to both.

## ADR-025 "GPU canvas stays mounted" is superseded

ADR-025's headline was that the GPU canvas must stay mounted. That's superseded:
unmounting is safe *so long as* the transition runs a full dispose→re-init cycle.
`DisplayChrome`'s terminal-state early-`return` unmounts the canvas subtree, which
fires `canvasRef(null)` → effect cleanup → `backend.dispose()` +
`stopRenderingBackend()`; force-load remounts and re-inits via the callback ref.
The detached-context bug ADR-025 warns of only happens when the canvas unmounts
*without* disposing. Invariant: mount-lifetime is not required; clean
dispose-on-unmount is.

## In-place-refetch staleness (closed everywhere)

Several displays' `svgReady`/`settled` gates used to resolve on the *first datum*
and stay true through an in-place refetch, so a pan/zoom export captured stale
data. This is closed everywhere now: each path carries a freshness signal — the
per-region spatial check (`viewportWithinLoadedData`), the global
`viewportMatchesLastDrawn`, and the signature compare (`isDataCurrent`) all close
the debounce+RPC window. See `reference/SVG_EXPORT.md`. (Older writeups described
this gap as open; if you find one that still does, it's stale.)

## The former ~68.7 Gbp synteny/dotplot ceiling

Synteny + dotplot used to split cumBp into a 4096-bp-aligned Float32 hi/lo pair
(the shape ADR-018 documents), exact only while `cumBp < 2³⁶`, degrading past
that — a ~68.7 Gbp whole-assembly ceiling. The current window-relative Float32
base (`cumBp − fetch-time base`) cancels the genome-scale magnitude, so the cap
is gone and 100+ Gbp genomes render correctly. See `reference/BP_PRECISION.md`
§"Synteny + dotplot". The old shared helper `hpCornerScreenX` was removed from
`hpmath.slang` once both views dropped it; the LGV in-shader
`hpSplitUint`/`hpToClipX` path was untouched.

## The composite LD kernel looped per sample, and lost the answer (closed 2026-08)

`ldCompute.slang` took genotype dosages as bytes, four samples to a u32, and
looped over every sample to accumulate six float moments, where
`ldPhasedCompute.slang` already popcounted haplotype bit planes.
`ARCHITECTURAL_LIMITS.md` carried the ~6x gap that costs as a live limit and the
port as deliberately not queued, on the ground that it would save ~430ms
off-thread behind the 500ms fetch debounce (`ldFetchPhases`).

That reasoning was about latency, and the byte loop was not only a latency cost.
Measured on a Radeon Pro 5300M over 50,000 variants x 2,504 samples, against its
own CPU twin `calculateLDStatsDosageBits`: max |gpu - cpu| was 2.8e-8 at a
200-variant window, 1.2e-2 at 500, then 1.0 at 1,000 and 2,000, a zero where the
exact answer is r² = 1. The 2,000 row also came back in 411 ms against the
1,000 row's 17 s, non-monotonic in the work, which is the tell. The dispatch was
returning incomplete and the buffer read back as a plausible all-zero matrix;
WebGPU raises no validation error for that, so the `pushErrorScope` around the
dispatch never fired and the display had no way to know.

The fix was the port. The kernel now reads the same three planes `packDosages`
builds (het, homAlt, valid) and `getLDMatrixGPU` packs with `packDosages`
itself, so the GPU and CPU paths cannot encode one genotype two ways. The six
moments come out of nine popcounts per 32-sample word exactly, not
approximately, because a dosage is 0, 1 or 2: a het contributes 1 to a sum and 1
to a sum of squares, a hom-alt 2 and 4. Every window now passes parity at f32
noise (2.8e-8 to 6.0e-7), and the composite kernel is the cheaper of the two,
reading three planes per variant against phased's four.

Two things not to re-derive from the old entry. A slow kernel here was not
"correct but late": on this hardware it changed the answer, silently. And
"phasing a cohort changes what the matrix costs" is no longer true, since the
two kernels are the same shape now, so phasing changes which estimator runs and
nothing else.

## React Compiler × ternary sensitivity (now a style choice)

The terminal branches in `DisplayChrome` were once sensitive to
early-`return`-vs-ternary because `babel-plugin-react-compiler` could memoize a
MobX read on `model`'s stable identity and silently drop an update.
`DisplayChromeInner` now carries `'use no memo'`, so the compiler doesn't compile
it and the early-`return`-vs-ternary choice is purely stylistic. Full analysis +
minimal repro + codebase audit (DisplayChrome was the only compiled observer):
`COMPILER_TERNARY_FINDING.md` (this directory).

## SVG-only `renderToCtx` drift (removed pattern)

Displays used to keep a separate SVG-only `renderToCtx` that drifted out of sync
with the on-screen renderer — different bicolor handling, different Y-axis
offsets, different bezier curves, different palettes, each plugin its own flavor.
That pattern is gone: SVG export now runs the same Canvas2D draw functions the
on-screen path uses, through `paintLayer`. See `reference/SVG_EXPORT.md`.

## Each display asserted its own "did we paint?" (closed)

`PerRegionRenderingBackend.renderBlocks` and both its bases used to return
`void`, so every per-region display hand-wrote a predicate ahead of an
unconditional `return true` — and they disagreed. `LinearBasicDisplay`, Manhattan
and wiggle gated on `rpcDataMap.size === 0`; `LinearMultiRowFeatureDisplay` and
`LinearMultiSampleVariantDisplay` gated on nothing, so they flipped `canvasDrawn`
on a tick that drew nothing. On screen that was masked (`isReady` also requires
`!isLoading`), but the `-done` testid fired early — which is the root cause the
per-display workarounds in `FIGURE_CAPTURE.md` were built to
dodge, each new display having to reinvent a data-derived readiness selector.

`renderBlocks` now returns the boolean and the callbacks forward it. The two
bases answer at deliberately different precision: GPU knows exactly ("a
`drawRegion` ran", after the region-absent and offscreen-clip guards), Canvas2D
answers "some block had region data" because it delegates clipping to the
plugin's `drawXxxBlocks`. `perRegionRenderingBackend.test.ts` pins both, including
a case asserting the two agree everywhere Canvas2D can see.

Two callbacks keep a guard, for reasons the backend cannot see — don't "simplify"
either into a bare forward:

- **`LinearAlignmentsDisplay`** keeps `rpcDataMap.size === 0`. Its backend answers
  off a group's laid-out map, and a grouped fetch over a region with no reads
  partitions to zero groups, so the map is empty even though the fetch finished.
- **`LinearMafDisplay`** returns `true` after deliberately rendering zero blocks:
  zoomed out, the identity plot owns the visible rows on a sibling canvas, so the
  cleared GPU frame is still a real paint.

## A config snapshot was a legal input to `readConfObject` (closed)

`readConfObject` used to accept a plain config snapshot as its first argument, so
one nested read had two spellings that silently disagreed:

```ts
readConfObject(readConfObject(track, 'adapter'), 'fetchSizeLimit') // undefined at the default
readConfObject(track, ['adapter', 'fetchSizeLimit']) //             5_000_000
```

Every slot is `types.stripDefault`, so a sub-config slot read hands back an object
with every defaulted slot omitted. Reading a defaulted slot back off it answered
`undefined`, which reads as "the adapter declares no limit" rather than "ask the
node" — that is how the byte gate came to ignore a BAM's declared 5 Mb and gate at
the display's 1 Mb (`810c7fb8fd`). The left spelling is what a display's
`adapterConfig` invites, since that getter *is* `getConf(parentTrack, 'adapter')`.

Both halves of the fix are load-bearing; each was verified to fail the guards in
`configTypeNarrowing.test.ts` on its own. Narrowing the overload alone does
nothing, because the sub-config read returned `any` and `any` satisfies any
parameter — so `SlotValueRawFromDef` had to type sub-schema entries as
`AnyConfigurationSnapshot` first.

The type half was expected to be expensive and was not:

- **The compiler enumerated no snapshot callers.** Rejecting snapshots cost zero
  errors repo-wide, because every value that holds an un-hydrated snapshot at
  runtime is already *typed* as `AnyConfigurationModel` (`session.tracks` is
  `AnyConfigurationModel[]`). The plan of record called for moving "the two
  legitimate snapshot callers" to a `readSnapshotConf` entry point; there were
  none, so that function was never written. `readConfSlot` (product-core) already
  covers the genuine plain-object case by branching before it reaches
  `readConfObject`.

**A runtime check was attempted twice and abandoned. Don't re-add one.** The
temptation is obvious — a type error only helps code that typechecks, so why not
also throw when a plain object shows up with an undefined slot? Because that read
is a load-bearing pattern, not a mistake: `generateHierarchy` reads slots straight
off the un-hydrated frozen entries of `jbrowse.tracks`, since hydrating 10k tracks
to populate the track selector is exactly what `types.frozen` exists to avoid
(ADR-031). At runtime that is indistinguishable from the broken spelling — both
are a plain object missing a defaulted key. A throw failed 65 suites. Narrowing it
to `Object.isFrozen`, on the theory that MST freezes only the snapshots it hands
out, doesn't separate them either: the frozen track configs are frozen too. The
type layer is the only place this is expressible, which is what the original plan
concluded.

Two measurement traps on the way, both worth remembering:

- **A zero from instrumentation has to be verified as reachable.** A
  `console.error` probe in `readConfObject` plus a full-suite run appeared to give
  0 hits across 9096 tests, which is what made a blunt throw look safe. The number
  was an artifact: jest's reporter is non-TTY under a pipe and prints almost
  nothing for passing suites, so the captured log held 373 lines for a 992-suite
  run. Assert a known-positive hit before trusting a zero.
- **Don't pipe a full-suite run through `tail`.** The failure output that would
  have attributed the damage was truncated to the last 30 lines, which turned one
  visible failure into a guess about 65. Redirect the whole log, then grep it.

Don't "fix" the stripping itself, and don't make slot reads resolve defaults all
the way down. `fullConfSnapshot` (the defaults-included converter) drops arrays and
maps of sub-schemas, so `getConf(track, 'displays')` would start returning less;
it refuses promotable slots below the top level, and a display config nested in a
track config has them; and promotables resolve against the *session*, which a pure config read
cannot reach — there is no single correct defaults-included plain object for a
nested display config. `readSlot` also returns the cached `getSnapshot`
deliberately: a per-read built object was a measured perf and
spurious-recomputation regression.

## Refresh after a fatal error restored the session that caused it (closed 2026-08)

`FatalErrorDialog` offered **Refresh** and **Reset Session**, and neither was a
recovery. `JBrowse.tsx` keeps `session=local-<id>` in the URL and
`fetchLocalSession` restores that id out of sessionStorage, which the autosave
rewrote at most 400ms before the crash — so Refresh re-entered the crash, leaving
`factoryReset` (which drops the whole query string) as the only exit, at the cost
of the user's session. The ladder now has a middle rung: the app-level
`ErrorBoundary`'s `onError` records the crashed session id (`crashedSession.ts`),
`fetchLocalSession` offers that session instead of restoring it, and the offer's
"start a new session" drops only the `session=` param.

Three shapes that look simpler and are worse, so don't fix it back into one:

- **Have the boundary drop `session=` itself, or make Refresh do it.** That is
  the choice the offer exists to give the user, made silently and always the same
  way — and a transient cause (a lazy chunk that 404'd, a GPU context lost, a
  plugin that has since loaded) then costs the session for no reason.
- **Delete the crashed session.** It is the user's work, and the single most
  useful thing to have when they report the crash. `startFreshSession` goes the
  other way and *writes* it into the autosave database, because the sessionStorage
  copy it is holding is the fresher of the two and the fresh session's autosave is
  about to overwrite it — a crash inside that first 400ms is exactly when
  IndexedDB does not have it yet.
- **Keep the marker in localStorage.** It is per-tab state about one attempt at
  one session. In localStorage a crash in one tab holds the same session at an
  offer in every other tab that has it open, and outlives the browsing session
  that produced it.
