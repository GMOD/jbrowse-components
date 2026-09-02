---
name: alignments-display-review
description: Review of plugins/alignments LinearAlignmentsDisplay — every verified finding, what landed on the alignments-display-review worktree branch, and what is still open
---

# LinearAlignmentsDisplay review handoff

Worktree: `.claude/worktrees/alignments-display-review`, branched from local
`main` at `ac47137850`. Two implementation commits are on the worktree branch:
batch one (`9f598924f7`) landed every first-pass finding, and batch two landed
all three second-pass reviewer lists except the items under "Still open". The
branch has not been rebased or merged to `main` yet.

## Landed (both batches; verified by lint, typecheck, `test-related --with-web`)

First pass: density-coverage doc block; sashimi and bezier hover through
`setHoverState` (`setMouseoverExtraInformation` removed); bezier click selects
the chain; one read tooltip in both modes with strand and MAPQ; line-width
slider in the arc band options and the debug geometry toggle gated to dev;
`setLayoutOrder`; scroll survives a refetch; GPU arc-only upload path
(`renderers/arcOnlyUpload.test.ts`, bench in `benches/arcUploadPath.bench.ts`);
feature-height dialog noun; SNP-floor radio snapping; typed `model.view`
replaces the casts; strand/flags/mapq read without fallbacks.

Second pass, colour modules: overlap legend swatch composites the real
`colorOverlapTint` (label now "Overlapping reads (tint = depth)");
`modFwd`/`modRev` are swatch categories so a modifications legend names the
read body; an untagged `{type:'tag'}` keys the "Reads" row; categorical tag
values hash into three relit laps of the palette (`colorTagUtils.ts`); baked
legend values sort numerically or by assembly position; `readColorCategory` is
an override ladder plus a scheme switch; dead exports and drifted comments gone;
the unreachable legend tests retargeted.

Second pass, chain and layout: chain ids assigned in sorted-name order so the
consensus frame no longer depends on region arrival order (test strengthened);
zero-length buckets abstain instead of voting NaN; single-region
`computeChainLayout` deleted; typed-array `packedOverlapIntervals` for the
collapsed relayout and `mergeSortedSpans` for the chain path (the unsorted
`mergeSpans` had no caller and is gone; the canvas plugin's tuple-based copy
stays separate on purpose, see below); group chip opacity applied to the
background colour on both paths; chip inset, icon size and compact-axis font in
`groupLabelStyle.ts`/`coverageAxisStyle.ts`; `YScaleTicks` down-mode reversal
documented; replacement arrays allocated lazily.

Second pass, tooltip and arc components: TLEN caption takes the palette; export
chips cull and pin through the shared `groupChipTop`; arc hover highlight
carries the mark's dash; sections emit `arcDown`; `coverageRows` in
`tooltipUtils.ts` feeds both the hover table and the click widget (Ref and
Deletion rows now in both, no "Ref 0" at zero depth); sashimi selection lives
on the model (`selectedSashimiKey`) so the SVG export draws the outline; the
remaining `getContainingView` casts use `model.view`; `resolveArcHover` reads
the lane's own `arcsRpcDataMap`; tooltip payload switch is exhaustive; debug
overlay label boxes measure their text.

## Still open

- `packages/core/src/ui/palette.ts:698-700` modification fills have no dark
  variant, and the tag palette likewise. Decide separately; bigger job.
- `plugins/alignments/src/shared/legendWidth.test.ts` sweeps `SCHEMES`/`ALL`
  and neither lists `modifications` or the new `modFwd`/`modRev` rows, so
  those labels are unmeasured against `LEGEND_MAX_WIDTH` (they fit today,
  ~103px of 173px).
- `perBaseQuality`/`perBaseLetter` paint marks over a `plain` body no legend
  row names, the same gap closed for modifications. `plain` is not a
  `SwatchCategory`, so it needs an explicit row in those `schemeLegend`
  branches.
- `spanOverlaps.ts` and `plugins/canvas/src/shared/mergeSpans.ts` stay separate:
  canvas merges `[start, end]` tuples on a hot path, alignments merges
  `{start, end}` objects, and core's `mergeIntervals` always sorts a copy so it
  cannot back the sorted-input entry point.
- `pnpm autogen` refuses on main and here alike: hand-written TS fences in the
  docs exceed `DOC_FENCE_BASELINE` (49 vs 24). Not from this branch; the other
  generated-doc drift in the main checkout is also not from this branch.

## Parked / rejected

- GroupByDialog firing two actions: the fetch autorun coalesces within a
  microtask, so no double fetch. Dropped.
- Layout, hit-test and both renderers' math checked against their parity tests;
  no wrong-answer bug found there.

## Original finding lists

Kept for the line references; every item is either under "Landed" or "Still
open" above.

## Confirmed findings (first pass, all verified by reading the code path)

Bugs

- `model.ts:1048` doc block for `densityCoverageRegions` sits above
  `densityStandsIn`; generated docs page glues them (`website/docs/models/LinearAlignmentsDisplay.md:207-208`).
- `components/PileupBezierOverlay.tsx:121` click selects one mate; canvas click
  (`useAlignmentsBase.ts:496`) selects the chain via `setSelectedChainReadIds`.
- `setMouseoverExtraInformation` (`model.ts:3859`) has no context-menu guard;
  `setHoverState` (`:3883`) does. Sashimi (`SashimiArcsOverlay.tsx:88`) and
  bezier (`PileupBezierOverlay.tsx:113`) hover through the unguarded one.
- `setReadConnectionsLineWidth` (`model.ts:3734`) has no caller anywhere; the
  slot is config-only. GPU memo tracks `arcLineWidth` for nothing.

Perf

- `renderers/GpuAlignmentsRenderer.ts:865` — any change to the `arcs` object
  (every arc-tier setting, incl. the live `minInterchromSupport` slider)
  rebuilds all 13 pileup + 5 coverage passes. Only the recolour path is narrow.

Cleanups

- Casts where `model.view` (typed LGV) exists: `model.ts:2532`,
  `PileupComponent.tsx:96`, `AlignmentsDisplayComponent.tsx:87`.
- `pileupViewportHeight`/`pileupContentHeight` (`model.ts:2489/2505`) duplicate
  the sticky-band subtraction.
- Hover-band type spelled twice (`model.ts:482`, `:3876`); `readLookup.ts:705`
  `?? 1` strand fallback; `model.ts:3151` `name || id`; `menus/sortGroup.ts:741`
  three actions per radio; direct MST actions passed as callbacks in
  `menus/reads.ts:920`, `menus/readConnections.ts:377`.

UX

- Plain-pileup hover is name+location+strand only; `formatChainTooltip`
  (`tooltipUtils.ts:627`) already falls back to the read span and could serve
  both modes (+ MAPQ line).
- "Debug: show arc geometry" (`menus/readConnections.ts:455`) ships in the user
  menu.
- `clearDisplaySpecificData` (`model.ts:3291`) zeroes scroll on every refetch.
- `SetFeatureHeightDialog.tsx:24` says "read" while the menu threads
  `featureNoun`.
- `menus/coverage.ts:151` SNP-floor radio ticks nothing for an off-list value.

## Second-pass findings: colour modules reviewer

- bug `shared/legendUtils.ts:627-635` collapsed-overlap legend swatch composites
  black; pass paints `colorOverlapTint` = `palette.text.primary` (light in
  dark mode). Composite the real tint; reword "darker = more"; add
  `colorOverlapTint` to the test palette.
- bug `colorUtils.ts:60-66,584-591` + `legendUtils.ts:255-260`: `modFwd`/`modRev`
  are flat slots misfiled as dynamic, so a modifications legend never names
  the read fill. Move into `swatchPaletteKeys` with `CATEGORY_LEGEND` labels.
- bug `legendUtils.ts:900-902` `{type:'tag'}` with no tag → empty legend box;
  fall back to the `normal` branch's "Reads" row.
- bug `colorTagUtils.ts:33-39` categorical tag hash into 10 slots collides;
  use the `refNamePaletteColorAt` lap/relight treatment or the 40-colour
  categorical palette.
- cleanup `colorUtils.ts:331-337` restates `framesUnpairedChainStrand`; call it.
- cleanup `legendUtils.test.ts:226-232` pins an unreachable scheme/category
  combination; retarget or assert the negative.
- cleanup dead exports `colorUtils.ts:140 orientationSchemes`,
  `colorTagUtils.ts:15 TAG_COLOR_PALETTE`.
- ux `legendUtils.ts:821-827` sort baked-value rows numerically / by assembly
  position; `:917-931` per-base schemes never name the read body (add "Reads").
- cleanup `legendUtils.ts:355-361` load-bearing cast; `readTagColors.ts:117-122`
  `?? 0` hides a length mismatch.
- ux `packages/core/src/ui/palette.ts:698-700` modification fills have no dark
  variant (tag palette likewise, bigger job — decide separately).
- drifted comments to delete: `colorUtils.ts:449-453` ("ten" schemes, there are
  nine), `:45` (`rgb255` "backwards-compat"), the "dynamic ramps" claim.
- refactor `colorUtils.ts:265-457` `readColorCategory` → override ladder +
  scheme switch.


## Second-pass findings: chain and layout helpers reviewer

- bug `chainStrandConsensus.ts:246-252,160,306` — consensus frame depends on
  chain ENCOUNTER order: ids assigned in walk order, sweep is id-ordered, and
  the sign anchor needs a strict majority so a two-chain conflict flips either
  way. Region arrival order alone paints both chains red or both blue. Fix:
  assign ids in sorted-name order; strengthen `chainStrandConsensus.test.ts:211`
  with regions listing chains in opposite order (current fixture passes
  vacuously).
- bug `chainStrandConsensus.ts:111` — zero-length segment gives `0/0` = NaN
  vote, poisons the locus total, no chain there ever flips. Fix:
  `t > 0 ? (f - r) / t : 0`.
- cleanup `computeChainLayout.ts:247-254` `computeChainLayout` has no production
  caller (test-only); delete, tests use `computeMultiRegionChainLayout([[0,d]])`.
- perf `spanOverlaps.ts` + `collapsedLayout.ts:48-62` — one object per segment
  per collapsed relayout; add typed-array `overlapIntervalsInto`, and
  `mergeSpans(overlapIntervals(...))` at `computeChainLayout.ts:351` re-sorts
  already-sorted output.
- bug (visual) `GroupLabelsOverlay.tsx:34` applies `GROUP_LABEL_BG_OPACITY` as
  element `opacity` (fades text+icons); SVG `GroupLabelBox.tsx:41` applies it
  to the rect fill only. Use `alpha(background.paper, …)` on screen; hover rule
  at `:67` becomes a background swap.
- cleanup: chip inset `4` and compact-axis `fontSize 9` spelled in both
  screen and export paths; move into `groupLabelStyle.ts`/`coverageAxisStyle.ts`.
- perf `chainStrandConsensus.ts:244-287` two full read walks; seed frames in
  the first loop. `:266` `numSegs < 2` half of the guard is unreachable.
- contract `insertSizeTicks.ts:115-117` down mode inverts `YScaleTicks`
  yTop/yBottom meaning; document or rename fields.
- perf `chainSuppAcrossRegions.ts:89`, `chainStrandConsensus.ts:319` allocate
  the replacement array before knowing anything changed; allocate lazily.
- cleanup `computeChainLayout.ts:385` cast `undefined as Flatbush | undefined`;
  `chainStrandConsensus.ts:115` forEach re-indexes; `:232` getOrCreate before
  the `isChainData` guard; `insertSizeTicks.ts:16` dead `v === 0` branch;
  `spanOverlaps.ts:41` duplicates `plugins/canvas/src/shared/mergeSpans.ts`.


## Second-pass findings: tooltip and arc components reviewer

- bug (dark mode) `components/TlenAxisLabel.tsx:17-25` caption has no `fill`;
  renders black on dark track and in dark export. Pass `palette.text.primary`
  down (no `usePalette` on the export path), like `SashimiArcsSvg`.
- bug (export ≠ screen) `renderSvg.tsx:290-322` `GroupLabelBoxes` places chips
  at raw projected `coverageTop + 1`; screen (`GroupLabelsOverlay.tsx:151-167`)
  culls off-screen lanes and pins the chip sticky. Hoist cull + `chipTop` clamp
  into a helper beside `groupLabelStyle.ts`, use in both.
- bug (ux) `arcHitTest.ts:322-340`, `ArcHoverOverlay.tsx:60-65`,
  `CrossRegionArcsOverlay.tsx:117-130` — hover highlight strokes solid over
  dashed marks (interchrom tick, split read-cloud connector), filling the gaps.
  Add `dash?: string` to `ArcHighlight`; set for tick hits (generated dash
  constants, adr-051) and from `arc.dash`; apply as `strokeDasharray`.
- cleanup `ArcDebugOverlay.tsx:100-103` reaches back into `renderSections` by
  key with `?? false` for `arcDown`; `computeCrossRegionArcSections`
  (`overlaySections.ts:190-200`) should emit `arcDown` on the section.
- ux `AlignmentsTooltip.tsx:248-325` vs `detailWidgets.ts:61-95`: hover has Ref
  and Deletion rows the click-through coverage widget lacks; build both from
  one `coverageRows(bin)` in tooltipUtils. Also `strandCounts` and avg-prob
  expression duplicated (`AlignmentsTooltip.tsx:88-99`, `detailWidgets.ts:85-91`).
- cleanup `pileupBezierArcs.ts:18-30` `scrollTop` param is dead (both callers
  pass `model.scrollTop`); drop it, use `model.scrollModel` instead of the
  hand-built scroll object at `:35-39`.
- bug (ux) `SashimiArcsOverlay.tsx:83-91,147` selection key is local React
  state so `SashimiArcsSvg` export never draws the selected-junction outline.
  Move to a model volatile (`selectedSashimiKey`), clear with other selection.
- cleanup casts `getContainingView(model) as LinearGenomeViewModel` in
  `ArcDebugOverlay.tsx:164`, `CrossRegionArcsOverlay.tsx:158`,
  `SashimiArcsOverlay.tsx:160`, `PileupBezierOverlay.tsx:51` → `model.view`.
- cleanup `useAlignmentsBase.ts:189-192` reads arcs via `arcsByGroup` by key
  while `ArcDebugOverlay.tsx:175` reads `sec.arcsRpcDataMap`; widen
  `resolveArcHover`'s section param and read the lane's own map.
- cleanup `AlignmentsTooltip.tsx:371` payload switch not exhaustiveness-checked;
  annotate return type or add `default: never`.
- bug (minor) `AlignmentsTooltip.tsx:249-259` prints "Ref 0" at a zero-depth
  column with alleles; gate `refRow` on `depth > 0`.
- cleanup `TlenAxisLabel.tsx:9` (`x = 42`) and `InsertSizeAxis.tsx:12`
  (`DOWN_MODE_CAPTION_X = 11`) magic offsets; derive from `AXIS_SVG_WIDTH` /
  `leftAxisSpineX(0)`.
- minor: `ArcDebugOverlay` label boxes fixed `width={330}`; `GroupLabelBox`
  width omits the 14px chevron the screen chip draws, so export chips are
  ~14px narrower.

