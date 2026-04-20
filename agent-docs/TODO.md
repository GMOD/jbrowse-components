# Active Work Items

**Updated:** 2026-04-19 (housekeeping pass) | Move completed items to
`agent-docs/completed/COMPLETED.md`. Top priorities (P1–P5) live in `PRD.md`;
this file is the categorized backlog.

---

## Architecture follow-ups

**Generalize ADR-006 (preserve stale data across refetch) where safe.**
Only viewport-agnostic display types should adopt it; viewport-baked
types keep clearing (the flash is correctness, not UX). Per ADR-006:

- Preserve: alignments arcs, probably synteny.
- Clear (keep current): wiggle tiles (bin widths), alignments pileup
  compact zoom (pixel-baked glyphs).
- Audit: `MultiSampleVariantDisplay` (different fetch model).

**Canvas label relayout without refetch.** `showLabels` / `showDescriptions`
flow through `rpcProps` so changing them refetches, but the worker output
doesn't depend on label placement (main thread re-derives via the cached
`rpcDataMap` view — see `plugins/canvas/.../baseModel.ts`). Remove them from
the RPC payload; add a fetchAutorun assertion that `setShowLabels` does NOT
trigger RPC.

Blocked by the `ConfigOverrideMixin` reactivity issue below — a targeted
"destructure label fields out of the RPC payload" fix doesn't work because
`rpcProps` transitively depends on `configOverrides` as a whole frozen
object.

*Partial mitigation landed via ADR-006:* the refetch still fires
spuriously, but `rawRpcDataMap` is no longer cleared during it, so labels
don't visually disappear. The refetch is wasted work but not user-visible
as a flash.

**`ConfigOverrideMixin` reactivity + type safety.** `configOverrides` is a
single `types.frozen<Record<string, unknown>>()` atom. `setOverride('k', v)`
replaces the whole object, so every consumer that reads any key depends on
every other key. Concrete consequence in canvas: `SettingsInvalidate` reads
`rpcProps`, `rpcProps` spreads `displayConfigSnapshot`, `displayConfigSnapshot`
spreads `configOverrides` — so toggling `showLabels` invalidates `rpcProps`
and triggers a refetch even when the worker output is label-independent. No
clean workaround exists inside the current mixin shape (a destructure in
`rpcProps` still subscribes to the whole frozen object via mobx).

Same latent issue affects every display that uses `ConfigOverrideMixin` +
SettingsInvalidate-style autoruns: variants `LDDisplay` (19 overrides),
`MultiSampleVariantBaseModel` (7), alignments. They happen not to feel it
today only because their overrides all *do* warrant refetches.

Secondary: `getConfWithOverride<T>(key)` is typed by caller assertion —
rename a config field and nothing warns. `DisplayConfig` (canvas) is
hand-maintained to parallel `baseConfigSchema.ts` with no compiler
enforcement that they agree.

Directions considered (none landed in the derived-layout PR — scope was too
broad and design choices non-obvious):
- *Per-field typed `*Override` props on one display.* Consistent when every
  override moves; hacky as a partial split.
- *Treat UI-toggle fields as non-config state.* Pull `showLabels`/
  `showDescriptions` out of the schema; make them plain MST props. Small,
  resolves the canvas-specific issue, but breaks admin config defaults for
  those two fields.
- *Retire `ConfigOverrideMixin` plugin-wide, in favor of per-field typed
  props with config fallback.* Cleanest design; cross-plugin refactor.
- *Generate `DisplayConfig` (and peers) from the schema at the type level,
  and have `getConf` return `unknown` by default* — addresses type safety
  independent of the reactivity problem.

Worth a scoped PR that picks one of the last two directions deliberately.

**Backend conformance test suite.** `packages/core/src/gpu/backendConformance.test.ts`
with one `describe.each(ALL_BACKENDS)`. Covers idempotent upload,
render-before-ready no-op, `deleteRegion` / prune absent-key removal,
`dispose()` buffer release (count via `MockHal`), context-loss reinit
equivalence. Land before dotplot / synteny PR-B ship.

**Tab visibility → HAL.** Move `visibilitychange` into the HAL; drops
`useTabVisibilityRerender` and `renderNow()` from the public mixin API.
Both still used in synteny (`LevelSyntenyCanvas.tsx`, `MultiSyntenyRendering.tsx`)
and dotplot. Post-synteny.

**Dead code sweep.** `pruneRegionMap` is still actively used by 8 backends — keep it.

**Structural `RenderSvgModel`.** Matrix + variants use the structural form;
wiggle / alignments / canvas still import the MST type. Mechanical conversion;
hardens against type circularity across lazy boundaries.

**`chainIdMap` perf.** Gate to `linkedRead + chain highlights active`.
Currently iterates every read × region on every data update.


**Eliminate remaining `untracked` usage.** Every `untracked` call is a
reactivity bypass — a signal that something is structured wrong, not a
feature. Each one below has a specific target fix.

HiC + LDDisplay `untracked` calls eliminated (see ADR-007). Remaining:

- `plugins/alignments/.../LinearAlignmentsDisplay/model.ts:1563`
  (`sortLayout` autorun wraps rpcDataMap-read-then-mutate).
  *Fix:* convert `computeAndAssignLayoutForData` to a pure function that
  returns a fresh laid-out map; expose laid-out data as a cached MST view
  (same shape canvas already uses). Upload autorun reads the derived
  view; no imperative writeback. Deletes the sortLayout autorun and its
  untracked block. The bigger S1-alignments work — largest payoff.

- `plugins/graph/.../GraphCanvas.tsx:186` (`viewportBounds` computed via
  untracked inside a scale/translate update).
  *Fix:* pan/zoom live on React state here, not MST. Move
  `computeViewportBounds` to a `useMemo` keyed on the scale/translate
  values. Standalone, low urgency.

Test-file untracked calls (`fetchAutorunIntegration.test.ts:83, 119, 171, 234`)
are acceptable — tests read state without triggering reactions deliberately.

Acceptance: `grep -rn 'untracked(' plugins/ packages/ --include='*.ts' --include='*.tsx' | grep -v test | grep -v '\.md' | wc -l` returns 0 (currently 5).




---

## Features & UX

**Synteny viewport culling** LOD improvements for large comparisons (Hs1 vs mm39
slow). Widen margins or soften refetch criterion.

**Protein3D on linearbasicdisplay** Consolidation removed it; may need separate
display or restoration.


**Synteny/dotplot UX** Linked views, swap axes, better defaults for human vs
mouse.

**Gene glyph compact modes** Add super-compact for dense layouts; side labels
for genes.

---

## Active WIP (uncommitted)

**MismatchParser → packed NUMERIC_CIGAR.** Replacing string-based
`cigarToMismatches.ts` / `mdToMismatches.ts` with `cigarToMismatches2.ts` /
`mdToMismatches2.ts` that work directly on packed `Uint32Array` from `@gmod/bam`.
Eliminates the string-parse step; avoids the `parseCigar` → string split path.
Tests updated in `parseCigar2.test.ts`.

---

## Performance & Stability

**Test speed & stability** Browser test suite slow; some flaky tests. Reduce
runtime, fix failures.

**Scroll zoom lag** ~500ms–1s delay after tab switch. Debug LinearGenomeView
reactivity or JS event throttling.

**Canvas SNP cutoff** Remove SNP clickmap at megabase zoom levels (no reason to
render).

**Verify `?renderer=X` param** Check URL parameter functioning.




## Polish

**Dark reader compatibility** Multiwiggle/DNA rendering with light backgrounds.


**Feature padding & crowding** Right-side canvas padding excessive? Subpixel
drawing crowded?


---

## Unclear (Verify)

- Clustering UI not updating?

## Synteny bugs

**Synteny mouseover stuck.** `hoveredFeatureIdx` doesn't clear when moving off
features. `dispatchHoverPick` fires `backend.pick` async; if `this.inFlight`
never resolves (e.g. `onResult` throws in the second `.then()` of
`drainPickQueue`), no further hover picks run. Reproduce with 3-way volvox
synteny; verify tooltip unsticks on mouse leave.

**Synteny deletion polygons extend beyond LGV boundaries.** In 3-way volvox,
CIGAR `D`/`N` polygons visually exceed the LGV coordinate range. Check
`computeCorners` in `syntenyTypes.slang` against `adjOff`/`scale` uniforms in
`GpuSyntenyRenderer.writeUniforms`, and the CIGAR `cx1` accumulation in
`executeSyntenyInstanceData.ts`. Compare against `origin/main` to rule out
regression.

**LinearSyntenyDisplay GPU leak on chromosome navigation.** The MultiLGV
variant got `clearDisplaySpecificData()` + prune-on-empty-set in the latest
commit. `LinearSyntenyDisplay` (2-way synteny) has no equivalent —
`stateModelFactory.ts` never calls `clearAllBlocks()` when the display navigates
to a new chromosome. Check whether stale GPU buffers accumulate.

## Synteny GPU follow-ups (post-Slang conversion)

Slang codegen already landed: `instanceCount` removed, `FILL_SEGS` constant,
single `hermiteEdges` call, shared `syntenyTypes` module.

**`isCurve` → uniform + Instance struct shrink.** `isCurve` is per-view (same
value for every instance in a draw call). Move to Uniforms; stop emitting
`isCurves[]` from the RPC; pass via `renderParams`. Remove `isCurve : ATTR6`
from Instance struct. ~30-line change across RPC, `syntenyBackendTypes`,
renderer, `syntenyTypes.slang`. Next concrete win.

## plugins/canvas

**Features collapsed to y=0 on NCBI.** Add logging to investigate; needs
reproduction steps (user can navigate to it).

## Tasks

- Alignments sortLayout → derived view (deferred for its own PR; PileupDataResult
  has 6+ parallel typed arrays + chain-mode bakes Flatbush, out of scope for sweep)
- Decouple amino-acid overlay loading + treat density gate as one-shot → drop
  canvas `isCacheValid` entirely


## Polish (continued)


Add log scale to plugins/alignments  there is example of this on origin/main
