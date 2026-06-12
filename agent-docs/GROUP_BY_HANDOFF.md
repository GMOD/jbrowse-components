# In-track Group-by — implementation handoff

Companion to `GROUP_BY_PLAN.md` (the design). This tracks what is **built**,
what **remains**, and the decisions/gotchas a continuing engineer needs.

Branch: `webgl-poc`. All work is scoped to `plugins/alignments` (plus one
unrelated `packages/core/package.json` export fix, see below).

## Status

| Stage | Scope | State |
| ----- | ----- | ----- |
| 1 | Worker partitions one fetch into N groups | **Done, tests pass** |
| 2 | Model: grouped storage, per-group layout, `sections` geometry, shared coverage domain | **Done, tests pass. NOT browser-verified.** |
| 3 | Renderers loop sections (GPU + Canvas2D) | **Done. tsgo+lint clean, unit tests pass, ungrouped browser-verified (see below)** |
| 4 | Hit-test / highlights / labels / SVG loop sections | **Done. tsgo+lint clean, unit tests pass, ungrouped integration green** |
| 5 | Dialog + in-track UX (`setGroupBy`, dividers, the demand driver) | **Done. Grouping reachable + browser-verified end-to-end (stacked render snapshot)** |

## Stage 3 — what was built

Renderers now loop a per-section geometry list; the ungrouped path is one
section and is byte-identical to pre-grouping.

- **Shader:** `alignmentsUniforms.slang` gains a `covTop` float + `covAreaTop(u)`
  helper (`1.0 - covTop/canvasH*2`). Every band-top-anchored coverage mark
  (coverage/snpCoverage/modCoverage `covBottom`, `indicator` `sy`,
  `interbaseHistogram` `sTop`) now starts at `covAreaTop` instead of the literal
  `1.0`. `covTop == 0` reproduces the old sticky-at-top coverage exactly. Ran
  `pnpm gen:shaders`; UBO is 304 bytes, `covTop` at f32 slot 12.
- **`rendererTypes.ts`:** `RenderState` gains `coverageTopOffset` (screen px of
  the coverage band top → `covTop`) and `sections: SectionRender[]` (per-section
  `pileupTopOffset` / `coverageTopOffset` + coverage & pileup clip bands).
  `AlignmentsSources.sections: { groupKey, laidOutPileupMap }[]` replaces the
  single `laidOutPileupMap`. `sectionRegionKey(sectionIdx, regionIdx) =
  sectionIdx * (1<<20) + regionIdx` namespaces HAL/region keys — **section 0 ==
  the raw region index**, the invariant that keeps ungrouped byte-identical.
- **`GpuAlignmentsRenderer` / `Canvas2DAlignmentsRenderer`:** `sync` uploads each
  (section, region) under its composite key; `renderBlocks` /
  `drawAlignmentBlocks` loop `state.sections`, cloning the per-section offsets
  into the `state` handed to the existing draw helpers and clipping to each
  band. Arcs/overlays only run for the single (ungrouped) section
  (`state.sections.length === 1`). GPU device-px scissor via `devBand` rounds
  top/bottom edges separately so the single-section band is bit-exact with the
  old `bufH - round(top*dpr)` math. Canvas2D coverage gets a
  `ctx.translate(0, coverageTopOffset)` (no-op at 0).
- **`sectionLayout.ts`:** `buildSectionRenders(layout, {scrollTop, canvasHeight})`
  resolves a `SectionsLayout` to screen-space `SectionRender[]`. Ungrouped keeps
  coverage sticky (clip = full canvas, `coverageTopOffset` 0, pileup clip to
  canvas bottom). Grouped scrolls each whole band by `scrollTop`; the pileup
  *offset* stays content-space (the shader subtracts `scrollTop` via `rangeY0`).
- **`model.ts`:** `sourceSections` getter (groupOrder → `{groupKey,
  laidOutPileupMap}[]`); `renderState` gains `coverageTopOffset` + `sections`;
  `startRenderingBackend` sync passes `sourceSections`. Scroll model is now
  grouping-aware via `isGrouped` / `pileupContentHeight`: ungrouped scrolls just
  the pileup (sticky coverage), grouped scrolls the whole stack
  (`sections.contentHeight`). `PileupComponent` scrollbar thumb uses
  `pileupContentHeight`.
- **`renderSvg.tsx`:** rebuilds `sections` at `scrollTop 0` (full-height export).

### Stage 3 verification

- `npx tsgo --noEmit` clean for `plugins/alignments/src` (the lone error is a
  pre-existing `packages/core/.../ArrayValue.tsx` issue, not ours).
- `npx eslint` clean. `npx jest plugins/alignments/src` — all pass (the one
  `AlignmentsFeatureDetail` snapshot failure is a concurrent agent's BaseCard
  testid change, not ours). New tests: `sectionLayout.test.ts`
  (`buildSectionRenders` + `sectionRegionKey`), updated `coverageParity` /
  `chainOverlayUtils` mocks.
- jbrowse-web integration: `Alignments`, `SNPCoverage`, `AlignmentStack`,
  `AlignmentsSort`, `AlignmentsModifications`, `AlignmentLinked` pass; the
  `AlignmentsColorBy` "color by stranded rna-seq" image snapshot passes (reads
  render pixel-identically through the new section loop).

## Stage 4 — what was built

The overlay/interaction pipeline now resolves which stacked section a screen-Y
falls in and uses that section's group data + offsets. Ungrouped is one section
spanning the canvas, so every path reduces to pre-grouping.

- **`model.renderSections`:** per-section `{ groupKey, laidOutPileupMap (that
  group's), topOffset (= `pileupTop`, the row offset), coverageTop,
  coverageHeight }`. The single content-space source the hit-test, labels, and
  highlights all read.
- **`computeVisibleLabels`:** takes `sections: { laidOutPileupMap, topOffset }[]`
  and wraps the per-region body in a section loop (each section places its
  labels at its own pileup top).
- **`computeHighlightBoxes`:** takes `sections` + the `readIdIndexMap` (which
  carries `groupKey` from Stage 2); each hovered/selected read is resolved to its
  group's section for the box's data map + `topOffset`. Spans collapse per
  (group, region).
- **`hitTestPipeline`:** new `coverageTopOffset` option; the coverage/indicator
  strip tests run against `canvasY - coverageTopOffset` so the strip is
  section-local. The pileup `topOffset` is the section's `pileupTop`
  (`canvasToGenomicCoords` still subtracts `scrollTop`).
- **`useAlignmentsBase`:** `resolveSectionForCanvasY` walks `renderSections`
  screen bands (`coverageTop − scrollTop` … next section) to pick the section;
  `resolveBlockForCanvasX` now takes that section's data map; `runHitTest`
  passes the section's `topOffset` + screen `coverageTopOffset`. Ungrouped short-
  circuits to section 0 / offset 0.
- **`renderSvg`:** labels use `model.renderSections` (scroll-independent
  content-space offsets; the function is passed `scrollTop 0` for full-height
  export).

### Stage 4 verification

tsgo + eslint clean. `jest plugins/alignments/src` 488 pass (same lone
`AlignmentsFeatureDetail` snapshot is the concurrent agent's, not ours); new
coverage in `computeVisibleLabels`/`hitTestPipeline` tests (mocks updated to the
section shape). jbrowse-web `Alignments`, `SNPCoverage`,
`AlignmentsModifications`, `AlignmentsSoftClip` pass — labels, coverage hover,
soft-clip, and modification overlays render identically through the section
pipeline.

## Stage 5 — what was built

Grouping is now **reachable**: choosing a dimension stacks the reads as sections
in the current track. This is the first end-to-end exercise of Stages 1–4.

- **`model.setGroupBy(groupBy?)`** action: sets/clears the `groupBy` override
  (tier-1 refetch — the worker re-partitions) and resets `scrollTop`.
- **`GroupByDialog`** gains a **mode** select: "Stack groups in this track"
  (default → `setGroupBy`) vs "Split into separate tracks (legacy)" → the
  existing `createGroupTracks`. Stack mode exposes every group-key dimension
  (strand, first-of-pair strand, tag, pair orientation, supplementary,
  duplicate, MAPQ); split stays strand/tag (all `createGroupTracks` wires).
- **`menus/sortGroup.ts`:** the dialog item is now "Group by…", plus a new
  "Ungroup (this track)" item (clears the override, disabled when ungrouped) and
  the kept "Remove grouped tracks" for legacy subtracks.
- **`GroupLabelsOverlay`:** inline section dividers + per-group labels with read
  counts, positioned at each section's scrolled coverage top (rendered only when
  grouped). `PileupComponent` scrollbar spans the whole display when grouped
  (the entire stack scrolls).
- **`model.renderSections`** carries the group `label` for the overlay.

### Stage 5 verification

- New `products/jbrowse-web/src/tests/AlignmentGroupBy.test.tsx`: group-by-strand
  yields `isGrouped`, two `groupOrder`/`renderSections` entries, two groups per
  fetched region, the divider-overlay labels (`Forward strand (n)` /
  `Reverse strand (n)`), and an **image snapshot of the stacked render** (two
  coverage+pileup sections sharing one scale). A second test confirms
  `setGroupBy(undefined)` restores a single section.
- tsgo + eslint clean; `jest plugins/alignments/src` 488 pass; ungrouped
  `Alignments`/`SNPCoverage` integration unaffected.

### Stage 5 polish — done

- **Collapsible sections.** Volatile `collapsedGroups` set + `isGroupCollapsed`
  / `toggleGroupCollapsed`. A collapsed group passes `maxY: 0` to
  `computeStackedSections` (pileup band 0, coverage stays). `GroupLabelsOverlay`
  labels are buttons with a ▾/▸ chevron that toggle. `setGroupBy` clears the
  set. Covered by `AlignmentGroupBy.test.tsx` ("collapsing a group …").
- **Resize handles gated when grouped.** Arc/sashimi resize handles are hidden
  in grouped mode (`!model.isGrouped`), since read-connections are a v1 scope
  cut there. The coverage-height handle stays (it resizes every section's
  coverage band).

## Known pre-existing failures (NOT Stage 3/4/5)

- **`AlignmentsColorBy` "color by tag" image snapshot — ~13% diff (Stage 1/2).**
  Proven independent of Stage 3 by isolation: reverting the three renderer files
  to HEAD + pointing the model/SVG sync back at `laidOutPileupMap` reproduces the
  **exact** 12.9975% / 26255-pixel diff. The tag-color path (worker
  `uniqueTagValues` extraction is unchanged from HEAD; `partitionFeatures`
  preserves feature order for the single ungrouped group) must be debugged in the
  Stage 1/2 worker spine refactor — likely a per-read coloring or feature-set
  difference in `executeRenderAlignmentData`'s `buildGroupResult`. This is the
  browser regression Stage 2's "NOT browser-verified" note warned about.
- **`AlignmentArcs` (all 6) — fail at `findByText('Show pair overlay')`.** A
  menu-label rename from the recent read-connections refactor (commit
  `07233e22b7`); a test/label mismatch, no image diff, unrelated to grouping.

**Key invariant exploited so far:** nothing sets `groupBy` until Stage 5, so the
worker always returns exactly **one** group. Every per-group code path therefore
reduces to the old single-pileup behavior — the ungrouped path is byte-identical
and the existing test suite guards it. Stages 3–4 can be built and shipped while
grouping is still unreachable; Stage 5 flips it on.

## Verification status

- `npx tsgo --noEmit` — clean for `plugins/alignments/src`.
- `npx jest plugins/alignments/src` — **483 pass**. The 1 failure
  (`AlignmentsFeatureDetail/index.test.tsx` snapshot, a `BaseCard` testid) is a
  **concurrent agent's** unrelated change, not group-by.
- **Not yet done:** browser check that a normal (ungrouped) BAM track still
  renders pixel-identically. Do this before Stage 3 (`pnpm build` then
  screenshots, or load a BAM in jbrowse-web). Memory flags this code's fetch
  autoruns as "extremely high-stakes".

## Data flow (after Stage 2)

```
worker: executeRenderAlignmentData
  fetch → partitionFeatures(groupBy) → [groups]
  per group: extract (simplex resolved GLOBALLY across groups) → buildGroupResult
  → returns GroupedAlignmentsResult { groups: [{key,label,data: PileupDataResult}] }

model:
  rpcDataMap: Map<regionIdx, GroupedAlignmentsResult>     // was Map<_, PileupDataResult>
  laidOutByGroup (groupLayout.ts): groupKey → (regionIdx → laid-out data)
    - each group laid out independently, own maxRows cap
  laidOutPileupMap = laidOutByGroup[firstGroup]            // renderer-facing (Stage 2)
  sections (sectionLayout.ts): vertical band stack, 1 entry per group
    - 1 group  → reuses belowCoverageBands (coverage+arc+sashimi), identical to old
    - N groups → stacked coverage+pileup, arc/sashimi pinned 0
  coverageStats: domain spans ALL groups (shared scale)
```

## Files

New:
- `shared/groupFeatures.ts` (+ `.test.ts`) — `partitionFeatures(features, groupBy)`
  and per-dimension key generators (strand, firstOfPairStrand, tag, pairOrientation,
  supplementary, duplicate, mapq). Untagged/unknown key is `''`, sorts last.
- `LinearAlignmentsDisplay/groupLayout.ts` — `buildLaidOutByGroup`, `groupMaxY`.
- `LinearAlignmentsDisplay/sectionLayout.ts` (+ `.test.ts`) — `Section`,
  `SectionsLayout`, `computeStackedSections`.

Changed:
- `RenderAlignmentDataRPC/types.ts` — `groupBy?` on args; `AlignmentGroup`,
  `GroupedAlignmentsResult`.
- `RenderAlignmentDataRPC/executeRenderAlignmentData.ts` — spine refactored into
  `buildGroupResult` per group; global simplex resolution.
- `RenderAlignmentDataRPC/RenderAlignmentData.ts` — RPC return type.
- `shared/types.ts` — `GroupBy`, `GroupByType`.
- `shared/extractFeatureArrays.ts` — returns `seenModTypes` (for global simplex).
- `shared/collectTransferables.ts` — `collectGroupedTransferables` (walks `group.data`).
- `LinearAlignmentsDisplay/model.ts` — `groupBy` override key + getter + `rpcProps`;
  `rpcDataMap` retype; readers iterate `.groups`; `laidOutByGroup`/`groupOrder`/
  `sections`/`primaryRawDataMap` getters; grouped `setRpcData`/`fetchNeeded`.
- `LinearAlignmentsDisplay/components/SashimiArcsOverlay.tsx` — uses `primaryRawDataMap`.
- `LinearAlignmentsDisplay/fetchAutorun.test.ts` — RPC mock wrapped in `{groups:[...]}`.

Unrelated fix (needed to run the suite): `packages/core/package.json` — added the
missing `./gpu/displayPhase` export entry. A concurrent agent added
`src/gpu/displayPhase.ts` and imports it across linear-genome-view but never
listed it in `exports`, which broke module resolution for every test importing
linear-genome-view. **If that agent also adds it, dedupe.**

## Key decisions / gotchas

- **Simplex modifications resolved globally.** `detectSimplexModifications` is a
  whole-dataset property. The worker extracts per group, merges `seenModTypes`
  across all groups, resolves once, and feeds that one set to every group's
  coverage pipeline. Don't resolve per group — coloring would differ per section.
- **Grouping is pileup-only (v1).** Forced off in chain mode
  (`linkedReads !== 'off'`) in the worker, and read-connections (arcs/sashimi)
  are off in grouped mode — that's why `sections` pins arc/sashimi to 0 for N>1.
- **`groupBy` is a tier-1 refetch setting** (in `rpcProps`) — changing it
  re-partitions, so the worker must re-run. It's an override-only config key
  (like `sortedBy`): `getOverride<GroupBy>('groupBy')`, in the `configKeys` list.
- **MAPQ keys are 3-digit zero-padded** so string sort = numeric, and `255`
  (unavailable) lands last.
- **`laidOutPileupMap` still exists** as the first-group renderer feed so Stage 2
  didn't have to touch renderers. Stage 3 should switch renderers to consume
  `sections` + `laidOutByGroup` and then this getter can likely go away.
- **Scroll/height math is untouched.** Today coverage is sticky and only the
  pileup scrolls. Grouped mode needs the whole stack (`sections.contentHeight`,
  with coverage scrolling per section) — deferred to Stage 3 (the plan calls this
  out as "not free"). `sections.contentHeight` is already computed for it.

## Stage 3 starting points (from the renderer inventory)

The draw path is already offset-parametrized — the seam is "vary the offset per
section":
- GPU `GpuAlignmentsRenderer.ts`: `sync()` loops `laidOutPileupMap` by region;
  `renderBlocks()` writes `covOffset = state.pileupTopOffset` once. Per section:
  set `covOffset`/`covHeight` uniforms + pileup scissor per `section.pileupTop`.
- Canvas2D `Canvas2DAlignmentsRenderer.ts` + `rendererTypes.ts`: `pileupRowY(yRow,
  state)` uses `state.pileupTopOffset`; `drawAlignmentBlocks` computes `pileupTop`
  once. Loop sections, pass each `section.pileupTop`.
- `renderState` (model.ts ~line 1300) currently carries one `pileupTopOffset`.
  Either add per-section offsets or pass `sections` to the renderer.
- Hit-test (`components/hitTestPipeline.ts` → `canvasToGenomicCoords`,
  `topOffset`), labels (`computeVisibleLabels`), highlights
  (`computeHighlightBoxes`), SVG (`renderSvg.tsx`) all take a `topOffset` — Stage 4
  adds a front step mapping screen-y → section, then passes that section's offset.

## Stage 5 (UI) starting points

- `dialogs/GroupByDialog.tsx` currently only does the **legacy subtrack** path
  (`createGroupTracks`). Add the in-track "stack in this track" choice that calls
  a new `setGroupBy(groupBy)` action (set/clear the `groupBy` override). Keep the
  subtrack path for old sessions ("Remove grouped tracks").
- Group-key generators in `groupFeatures.ts` are the shared source for both modes.
- Sample/library-from-`@RG`-header grouping is **not yet implemented** (plan lists
  it as new worker logic). `parseSamHeader` exists in `shared/util.ts` but isn't
  wired to read level. `tag`-based RG works today via `extractFeatureTagValue`.

> **Stages 3–5 above are now DONE** (see the per-stage sections earlier). The
> bullets in these "starting points" blocks are historical context, not open
> work. Open work lives in the next section.

---

# Plan for the next agent

Stages 1–5 are complete and the feature is reachable + browser-verified. What
remains, in priority order:

## P0 — Fix the `color by tag` worker regression (blocks a green suite)

`products/jbrowse-web/src/tests/AlignmentsColorBy.test.tsx` "color by tag" is
**~13% off** and it is **NOT a grouping-render bug** — proven by isolation
(reverting all renderers to HEAD + pointing the model/SVG sync back at
`laidOutPileupMap` reproduces the *exact* 12.9975% / 26255-px diff). It lives in
the **Stage 1/2 worker spine refactor** (`RenderAlignmentDataRPC/
executeRenderAlignmentData.ts`, the `buildGroupResult` / `partitionFeatures`
rework).

How to chase it (per the repo's "prove a hypothesis" rule):
- `npx jest products/jbrowse-web/src/tests/AlignmentsColorBy.test.tsx -t "color by tag" -u`
  is **not** the fix — don't just re-bless the snapshot until you know *why* it
  changed. Open the diff PNG in `__image_snapshots__/__diff_output__/`.
- The diff is in the **read body coloring**, not coverage (the gray histogram
  matches). `color by stranded rna-seq` (same file) passes, so generic read
  rendering is fine — it's specific to the `colorTagMap` → `readTagColors` path.
- `extractFeatureArrays`'s `uniqueTagValues` and per-read `tagColorValues` are
  unchanged from HEAD, and `partitionFeatures` preserves feature order for the
  single ungrouped group — so suspect something *else* the spine refactor moved:
  per-read color assignment order, a filter applied at a different point, or the
  global simplex-modifications resolution touching CRAM tag reads. Add debug
  logging in `buildGroupResult` comparing per-read `tagColorValues` + `readYs`
  against an origin/main run on the same `volvox_cram` HP region.

The `AlignmentArcs` failures are a **separate** stale menu-label test
(`"Show pair overlay"` renamed in the read-connections refactor, commit
`07233e22b7`) — fix the test label, unrelated to grouping.

## P1 — `@RG`-header sample/library grouping (the one unimplemented dimension)

New worker logic. `parseSamHeader` (`shared/util.ts`) parses `@RG` lines but
isn't wired to read level. Add `GroupByType` values `'sample'`/`'library'`, a
`readGroup → SM/LB` map built once per fetch in `executeRenderAlignmentData`, and
key generators in `groupFeatures.ts`. The dialog already iterates
`STACK_DIMENSIONS` — add the entries there. `tag`-based RG (`groupBy {type:'tag',
tag:'RG'}`) already works as a stopgap.

## P2 — Grouping polish

- **Per-group height drag.** `maxHeight` is per-group in layout already; add a
  resize handle at each section's pileup bottom (reuse `ResizeHandle`, write a
  per-group `maxHeightOverride`). Today every non-collapsed group shows full
  height.
- **Base-at-position grouping** via the context menu (plan's last dimension):
  group reads by the base they carry at the clicked column. Needs a worker key
  generator keyed on a genomic position (passed through `rpcProps`).
- **Restore arcs/sashimi per section** (v1 scope cut). `sections` already owns
  arc-band geometry (stubbed at 0) and `drawArcsPass` takes a band — restoring is
  a per-section `drawArcsPass` call + a shared arc Y-domain uniform (same trick as
  coverage). Default collapsed in grouped mode (they eat vertical space).

## Architecture notes for whoever continues

- **`sourceSections` vs `renderSections` are deliberately separate — do not
  merge.** `sourceSections` (data only: `{groupKey, laidOutPileupMap}`) feeds the
  **upload** autorun and is intentionally geometry-free so coverage-height /
  feature-height tweaks don't re-upload every buffer. `renderSections` (adds
  `label` + screen offsets, depends on `sections` geometry) feeds **render**,
  labels, highlights, and hit-test. Merging them would couple uploads to geometry
  (a perf regression — see `agent-docs/ARCHITECTURE.md` on upload vs render).
- **Ungrouped is byte-identical by construction**, guarded by `sectionRegionKey`
  section 0 == raw region index, `covTop == 0`, and `buildSectionRenders`'s
  single-section branch (full-canvas clips, sticky coverage). Keep that invariant
  — it's what lets the whole feature ship while most users never group.
- **Grouping × chain mode** is still disallowed in the worker (`linkedReads ===
  'normal'` forces one group); arcs are off in grouped render. Don't lift these
  without addressing `buildChainMetadata`'s global read-name grouping.
