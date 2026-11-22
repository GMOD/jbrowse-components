---
name: mcscan-anchors-block-identity
description: "Block bands under the gene ribbons of an MCScan `.anchors` track in the multiway display. The pairs already have `block` and `blockSpan`; the bands are planned and unbuilt, and whether they draw by default waits on Colin's call over captures."
---

# MCScan `.anchors` block bands

Started 2026-11-21 from Colin asking to draw MCScan's `.anchors.simple` blocks
and `.anchors` gene pairs together in one MultiWaySyntenyDisplay. Each `.anchors`
pair now has its block (`readAnchorsPair` in
`plugins/comparative-adapters/src/mcscanUtil.ts`, `BUILT_IN_COLUMNS` in
`packages/synteny-core/src/attributeChannels.ts`), and "Coloring gene pairs by
block" in `website/docs/tutorials/mcscan_synteny_grape_peach.md` colors and
filters by it, which leaves the bands.

It supersedes the MCScan case of
[a-multiway-track-draws-another-synteny-track-as-a-ribbon-layer](../ideas/waiting-on-a-call/a-multiway-track-draws-another-synteny-track-as-a-ribbon-layer.md).

## Why one file is enough

Recomputed on 2026-11-21 against the hosted demo copies
(`jbrowse.org/demos/grape_peach_cacao/`):

- `grape.peach.anchors.gz` holds 540 `###`-separated blocks, 16,607 pairs.
- `grape.peach.anchors.simple.gz` is exactly `jcvi.compara.synteny screen
  --minspan=30 --simple` of that file: its 315 rows are the blocks whose shorter
  side spans at least 30 genes, matched by each side's lowest- and
  highest-ranked genes. Only 220 of the 315 have those genes on their first and
  last file rows. Rank is a gene's position in its contig sorted by start; span
  is max rank − min rank + 1.
- `.simple` column 5 is jcvi's score `floor(sqrt(aspan*bspan))` (315/315), not a
  size; `MCScanSimpleAnchorsAdapter.ts:10` calls it "size". A score ≥ 30 cut
  keeps 347 blocks, not 315.
- 364 of 540 blocks mix gene-strand products; a block's direction is the sign
  of its gene-rank slope, which matches `.simple` column 6 on 315 of 315 rows.
- No block crosses a contig on either side, so each falls in one copy lane.
- Peach chrG7 (NC_034015.1) 17–20 Mb: 489 pairs in 17 blocks, 9 with
  `blockSpan` ≥ 30 holding 433 pairs. 8–20 Mb: 1,265 pairs, 36 blocks, 23 kept.

Declined: a combination adapter over both files (the second is a lossy copy of
the first), `ribbonLayers` for MCScan, a zoom switch between the two tracks
(declined 2026-09-21 as flicker), blocks as separate features (they would
outvote genes in the lane decisions), display-side chaining for MCScan.

## The fields on each pair

- `block` is text (`block0` is the file's first `###` section), so it paints a
  color per block with no `scale` written; a numeric column paints a ramp by
  default and stops listing its values past `MAX_DISTINCT_VALUES`. The number
  is the section's place in the file, kept when a section's pairs all fail to
  join.
- `block` names are per file. Two `.anchors` children of one
  `MultiPairwiseSyntenyAdapter`, or two overlaid tracks, share a color and a
  legend row for `block3`. No demo composes them; a band keyed on `block` alone
  would merge the two, so key it on the lane pair as well.
- `blockSpan` is the shorter side's gene span over the pairs that joined, so a
  BED missing genes gives a smaller span than jcvi counts.
- Only the gene-pair adapter sections its file: a `###` in an `.anchors.simple`
  is skipped.

## The bands

- Captures of the pairs colored by block (shot on ada 2026-11-21 from probe
  specs that were never committed) match what the plan expected: at
  chrG7:17–20 Mb most lanes hold one or two blocks, so the color mostly
  restates the lane, and the gene ribbons still read as hairlines beside the
  solid bands `.anchors.simple` draws. Where several blocks share a lane
  (grape chr8 against chrG7:8.4–15.2 Mb, the tutorial figure) the color
  separates fans that strand colors mix.
- One band per block per gutter, drawn before the gene ribbons at low alpha,
  from the block's full extents, which its pairs need as fields: the in-window
  hull moves under pan. Clipped at the lane edge, cut at holes
  (`addAcrossHoles` in `MultiWaySyntenyDisplay/multiwayGeometry.ts`), one per
  block and side in a self-alignment (`facingSides` emits both).
- The gene ribbons are built in `buildRibbonGeometry` (same file) and drawn
  through `syntenyRibbonMarks` (`LinearSyntenyDisplay/syntenyRibbonMarks.ts`,
  called from `multiwayMarks.ts`).
- Colored by block direction (a `blockStrand` field). Gene ribbons stay the
  hover unit; a band hovers as block, pair count, span and extents.
- Keep "block" out of display identifiers: it already names the lane-fit
  cluster (`blocksOf`, `LaneBlock`).

## Next

- Build the bands in a worktree: the adapter fields for a block's extents and
  direction, then the geometry.
- Shoot on ada at chrG7:17–20 Mb and 8–20 Mb: the pairs as they draw now, the
  bands, with `.anchors.simple` as the reference.
- **Colin's call, with those captures:** bands on by default for `.anchors`
  tracks (changes the deployed demo and the `mcscan_synteny/gamma_copies` and
  `mcscan_synteny/blocks` figures) or opt-in.
- On landing, replace the ribbon-layer idea note with one scoped to sources
  carrying no block ids (keep its "What it does not cover" paragraph), and note
  in "Collinear runs as block ribbons"
  (`ideas/collections/multiway-synteny-lgv-track.md`) that a source stating its
  own blocks is covered. The multi-genome `.blocks` table, OrthoFinder tables
  and PAFs stay uncovered.
