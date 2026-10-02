---
name: canvas-review-fixes
description: "The 2026-10-02 review of plugins/canvas: four bugs fixed and one simplification landed on branch canvas-review-fixes (not yet on main); a WIP commit moves the multi-row indel overlay and sort-by-value onto the encode and needs its tests rewritten; the remaining approved items are listed with their triggers."
---

# Canvas plugin review fixes

Colin approved every item below on 2026-10-02 ("whatever you think is best").
The work is on branch `canvas-review-fixes`, worktree
`.claude/worktrees/canvas-review-fixes`. **Nothing has landed on main yet.**

## Done, committed on the branch

- `fae8146e82` A density-only band no longer sizes the track to the hidden
  stack: `layoutReady` checks `coarseTierStandsIn`, and `laidOutDataMap` drops
  its own check.
- `61c56fba22` A hidden Group by section no longer suppresses the labels of
  the sections shown. `onScreenFeatureIds` skips `hiddenGroupFeatureIds`,
  which now reads `rpcDataMap`; the read moved ahead of the label gate to
  avoid a cycle.
- `0bc3d7a8a9` The multi-row colour quantile weighs each feature. The
  multi-row lane `featureColorValues` became `rectColorValues` (the canvas
  name; canvas's `PrimitiveArrayKey` selects lanes by the `rect*` prefix, so
  the canvas name has to stay). `FeatureColorHost` now requires the lane, so a
  mismatch fails the build. The quantile's spread push became a loop: it threw
  RangeError past ~150k boxes.
- `2f29b2b934` "Cluster rows by similarity" offers the colour field (score,
  strand). `clusterCandidates` = row candidates ∪ the colour field wherever a
  region shipped a value for it.
- `fe333f3cbb` + `c29aaabd44` Removed `featureItemMap`; the label overlay
  reads `featureIdIndex`. Generated model docs refreshed; the
  stop-rewriting idea doc updated.

`pnpm typecheck` was clean and `npx jest plugins/canvas` was green at
`c29aaabd44`.

## WIP commit: the multi-row display stops re-deriving its paint

The top commit (`WIP: ...`) is unfinished. Two consumers re-derived "does this
feature paint, on which row, in what colour", the indel overlay doing it on
every frame. Both now read the encode (`encodedChannels`) plus the row table:

- `rowOrderByValueAt(sources, encoded, pos, rowKeys, rowTable)`.
- `drawMultiRowIndelGlyphs(ctx, regions, encodedChannels, renderBlocks, state, color)`
  places each channel through `rowSlot`/`rowColor`.
- Deleted: `featurePaintInputs`, `MultiRowFeaturePaintInputs`,
  `drawnFeatureContext`, `forEachDrawnFeature`, `drawnRowAt`, and the paint
  half of `renderState`.
- `MultiRowEncoded.color` narrowed to `Uint32Array`, and
  `buildMultiRowChannels` takes only the lanes it reads.
- Added `rendering/encodeTestUtils.ts` `encodeRows(data, { rows, rowColors, hiddenColors, fieldPalette })`,
  which builds the encode and the row table the way the display does.

**To finish:**

1. Rewrite `rendering/drawMultiRowIndelGlyphs.test.ts`'s `draw()` helper and
   `rowOrderByValueAt.test.ts`'s `order()`/`paintInputs()` on `encodeRows`.
   Map the old overrides like this: `rowIndexByValue` becomes `rows`,
   `rowColorsByIndex` becomes `rowColors`, and `hiddenColors` and
   `fieldPalette` pass through unchanged. Keep every assertion.
2. Delete the `describe('featurePaintInputs')` block in
   `featurePaintInputs.test.ts`, and `git mv` the file to
   `encodeInputs.test.ts`.
3. Run `pnpm typecheck` and `npx jest plugins/canvas/src/LinearMultiRowFeatureDisplay`.
4. Reword the WIP commit with `git commit --amend`, then run `pnpm autogen`
   (the model docs lose `featurePaintInputs`).

One semantic change to check: a row focused off screen that has a colour
override is now "overridden" by the encode's rule. That rule comes from
`editableSources`, so a hidden legend category no longer hides that row's
features in the sort's colour map. It is still left out of block sizing. This
matches the paint.

## Approved, not started

Each item lists its trigger, as the review found it.

- **One peptide rule.** `peptides/peptideUtils.ts:188` `findTranscriptsWithCDS`
  and `glyphs/findGlyph.ts` disagree, so some CDS boxes draw no codons. The
  triggers are a `proteoform_orf` (or any `containerTypes` type) with direct
  CDS children, and a gene with a polyprotein CDS beside a plain CDS. Take the
  targets from `findGlyph`'s predicates. Do it with the codons-or-box helper:
  the same branch appears three times in `collect/glyphEmitters.ts`, at about
  :89, :287 and :576.
- **Motif → CrisprGuide.** Point `TYPE_GLYPHS.motif` at `layoutCrisprGuide`
  and delete `glyphs/motif.ts` and `processMotifLayout`. Motifs carry no PAM
  subfeature, and two tests assert the `'Motif'` type.
- **One cluster-args builder.** `runMultiRowClustering.ts:73` and
  `MultiRowClusterDialog.tsx:50` each build the RPC args by hand.
- **Small tidies:**
  - Remove `activeFilters` (`baseModel.ts`, an alias of `configuredFilters`).
  - Remove the `defaultColorItem` re-export on the `baseStateModel` subpath,
    which has no importer.
  - Simplify `isoformsReservation` in `fitLadderViews.ts`, which equals
    `fitHeightToDisplay ? labelsReservation : fullReservation`.
  - Fix the stale cost comment at `layout.ts:305`.
  - Fix the misplaced comment above `keepsAnyName` in `layoutQueries.ts`.
  - Name trimmed isoforms correctly in the Collapse introns dialog:
    `model.ts:363` reads `laidOutDataMap`, which the isoform trim filtered, so
    read `rpcDataMap` instead.
- **Low:** a `guide_rna` nested under another feature puts its PAM box at
  offset 0 (`applyLayout.ts:230`, `glyphEmitters.ts:523`).
- **Out of plugin, flagged only:** the sequence panel's default transcript
  (`core/.../featureTypeUtil.ts:57`) ignores `canonicalTranscriptTags` and
  breaks ties the other way from `glyphs/subfeatures.ts:128`.

## Declined, with reasons

- **The `rectDensityFade` wire lane** (the worker ships zeros). Removing it
  changes a plugin-ABI type for an allocation-only cut.
- **Fields left optional for old fixtures.** Low value.
- **Export trimming.** No dead code was found.

## Landing

Rebase onto main, run `pnpm verify`, then follow the CLAUDE.md flow:
`ExitWorktree keep`, then `git merge --ff-only canvas-review-fixes` in the
primary checkout. Remove the worktree after the merge.
