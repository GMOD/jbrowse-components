---
name: canvas-plugin-simplifications
description: A 2026-09-04 read of every non-test file in plugins/canvas for simplifications, refactors and bugs. The worker-side dedupes landed on canvas-simplify (one commit, green on typecheck and all 140 canvas suites); the main-thread list below is what the read found and did not get to, led by the layout memo's hand-kept cache-key list, which is the one item that is a latent-bug class rather than a tidy-up. No confirmed bug was found.
---

# Canvas plugin simplification handoff

One commit on `canvas-simplify` (`2be0d2c5b1`, subject "refactor(canvas):
dedupe the worker-side primitive types, pick tally and color packing"): the
worker-side (`RenderFeatureDataRPC/`) dedupes. `pnpm typecheck` and
`jest plugins/canvas` (140 suites) are green; `pnpm test-related` and
`--with-web` were not run, and nothing in the commit moves a slot, menu,
label or snapshot shape. Land it by rebasing onto main and fast-forwarding.

The rest of this file is the remainder of the read, in the order worth doing.
Every item was checked against callers and tests before being listed; none is
a guess at the code.

## The one that is a bug class

**`layout.ts` `GroupCache` / `groupUnchanged` / the `nextCache.set` literal.**
The incremental layout memo compares eleven `LayoutInputs` fields by hand in
three places (the interface, the compare, the cache write). A field added to
`LayoutInputs` and forgotten in any one of them is a stale layout served from
the memo with no test that would notice. Replace the three lists with one
exhaustive `Record<Exclude<keyof LayoutInputs, 'reversedRegions'>, true>`
(the `WORKER_READS` idiom in `renderConfig.ts`) and compare by looping its
keys. The `?? 'all'` / `?? 1` defaults in the compare can go: every caller
in `fitLadderViews.ts` passes either the same explicit value or leaves the
field undefined, so a raw `===` is equivalent, and the layout.test.ts memo
tests all build inputs through `incInputs()` and compare by field.

## Dedupes, each self-contained

- **`layout.ts` `applyHeightScale` and `applyLayoutToRegion`** spell the
  rect/line/arrow passes out three times; `isoformTrim.ts` and
  `isoformGapFloor.ts` already loop `for (const kind of ['rect','line','arrow']
  as const)` over the `${kind}Ys` / `${kind}FeatureIndices` lanes. Same loop
  here.
- **`isoformTrim.ts` `applyIsoformTrim`** has the kept/dropped/shift decision
  written three times (subfeatureInfos, aminoAcidOverlay, floatingLabelsData).
  One `trimShift(trims, geneId, ordinal)` answering dropped / unshifted /
  `{px, rows}` serves all three.
- **`floatingLabels.ts` `createTranscriptFloatingLabel`** returns
  `parentFeatureId` only to hand it back to its one caller
  (`emitSubfeatureLabel`); return the label alone. `floatingLabels.test.ts`
  asserts `result.parentFeatureId` once and reads `result.subfeatureLabel.*`
  otherwise, so that one assertion goes and the rest read the label directly.
  **`createMoreIsoformsLabel({overflow: {hidden, expanded}})`** has one
  caller, the `moreIsoformsLabel(hidden, expanded)` wrapper in
  `isoformTrim.ts`; flatten the signature and drop the wrapper (`layout.ts`
  imports the wrapper too). No test calls either directly.
- **`featureHighlightViews.ts`**: `canonicalFeatureHighlights` and
  `removeFeatureHighlightsForId` each map the MST highlight to the same plain
  object; one `plainHighlight(h)`. **`featureHighlight.ts`
  `resolveFeatureHighlights`**: the `let {boxed, pin: pins}` plus
  `;({boxed, pin: pins} = …)` reassignment reads as one `const` chosen by the
  fallback condition.
- **`LinearMultiRowFeatureDisplay/hitTesting.ts`**: `contextTargetAtPixel`
  repeats `featureAtPixel`'s sidebar and `oob` checks and then calls it, so
  `pxToBp` runs twice per right-click. Extract `pointerBase(self, mouseX)`
  and an inner `featureAtBase(self, p, mouseY)`.
- **The `featureDeltas.length === featureStarts.length` gate** is spelled in
  `LinearMultiRowFeatureDisplay/hitTesting.ts` and as `regionWithDeltas` in
  `drawMultiRowIndelGlyphs.ts`; one exported predicate beside
  `forEachDrawnFeature` in `featurePainting.ts`.
- **`toggleArrayMember`** (`LinearBasicDisplay/baseModelHelpers.ts`) is what
  the multi-row model's `toggleCategory` re-spells with `replace`. Move it to
  `shared/` (the helper file's own header says two-display things go there)
  and use it in both.
- **`labelScrollBucket`**: `baseModel.ts` and `renderSvg.tsx` both compute
  `Math.floor(scrollTop / LABEL_CULL_BUCKET_PX)`. Export a
  `labelScrollBucket(scrollTop)` from `labelPositioning.ts` beside
  `labelCullBand` and call it from both. Not a model field: `renderSvg.test.tsx`
  drives the export off `scrollTop` alone and should keep doing so.
- **`featureContextMenu.ts` `soloItems`**: the `inSoloList ? {…} : {…}` pair
  differs only in label and icon; one object with two ternaries.
- Small: `layout.ts` `labelOverhangRoomPx` spreads `features.values()` twice;
  `CollapseIntronsDialog.tsx` `parts.filter(f => isExon(f))` is
  `parts.filter(isExon)`; `glyphEmitters.ts` `processMatureProteinLayout`
  destructures `place` twice.

## Looked at and left alone

- `getTranscripts(feature?: Feature)` takes an optional its one caller never
  passes, but `util.test.ts` pins `getTranscripts(undefined)`; not worth the
  test edit.
- `baseModel.ts` `featureItemMap` keeps the last region's copy while
  `indexById` keeps the first; the comment there argues the copies are
  interchangeable, and they are.
- `fitNotes.ts` `everyLabel` is a longer boolean than it needs to be but is
  correct in every combination; rewriting it buys nothing.
- The worker-side `densityTooLargeResult` twin, the `PrimitiveBase` extraction,
  the pick tally, `packColor` and the peptide buffer are the landed commit.
