---
status: Accepted
summary: "An MCScan `.anchors` pair has its `###` block, and MultiWaySyntenyDisplay draws each block as a pale ribbon under its gene pairs, on by default. A second track as a ribbon layer, a combined adapter, hiding a band that fills the window and an opt-in slot were declined"
---

# ADR-281: A source's blocks draw under its gene pairs

## Status

Accepted (2026-11-21). Colin chose bands on for every `.anchors` track, over
hiding a band whose block covers the window and over an opt-in slot, from
before and after captures of peach chrG7 against grape at 3 Mb, 12 Mb and
370 kb.

## Context

Zoomed out to 3 Mb, peach chrG7 against grape reads as a few solid bands when
drawn from MCScan's `.anchors.simple` (one record per collinear block) and as
hundreds of crossing hairlines from `.anchors` (one per gene pair). Colin asked
for both in one MultiWaySyntenyDisplay.

A multiway display decides its lanes from its own source, so two sources in one
display disagree about every lane. The pairs file alone holds what both
draw, measured on 2026-11-21 against the hosted grape and peach files
(`jbrowse.org/demos/grape_peach_cacao/`):

- `.anchors` holds 540 `###`-separated blocks and 16,607 pairs, and the reader
  dropped the `###` lines.
- `.anchors.simple` is `jcvi.compara.synteny screen --minspan=30 --simple` of
  that file: its 315 rows are the blocks whose shorter side spans 30 genes or
  more, named by each side's lowest- and highest-ranked genes. Rank is a gene's
  place among its contig's genes in start order, and span is the highest rank
  less the lowest, plus one. Only 220 of the 315 have those genes on their
  first and last rows.
- 364 of the 540 blocks mix gene-strand products. A block's direction is the
  sign of its gene-rank slope, which matches `.simple`'s orientation column on
  315 of 315 rows.
- No block crosses a contig on either side.

## Decision

- **Each `.anchors` pair has its block** (`readAnchorsPair`,
  `plugins/comparative-adapters/src/mcscanUtil.ts`): `block`, its `###`
  section, and `blockSpan`, the shorter side's gene span. The adapter type
  declares both as columns with nothing configured (`BUILT_IN_COLUMNS`,
  `packages/synteny-core/src/attributeChannels.ts`), so every synteny view
  colors and filters by them. `rowNum` still counts pair rows only, so no id
  moved.
- **`block` is text** (`block0` is the file's first section). A numeric column
  paints a ramp unless `scale.type: 'ordinal'` is written, and stops listing
  its values past `MAX_DISTINCT_VALUES`; text paints a color per value with
  neither.
- **Each pair also has its block's reach on both sides and its direction**
  (`blockStart`, `blockEnd`, `blockMateStart`, `blockMateEnd`, `blockStrand`),
  the whole block, since the part in the window moves under a pan.
- **The multiway display draws one ribbon per block per gutter, in a layer
  under every gutter's ribbons** (`sourceBlocksOf`, `underlayKey`,
  `multiwayGeometry.ts`), at half their alpha (`UNDERLAY_ALPHA`), where at
  least one of the block's pairs draws.
- **A band is a record of its own**: one feature per block, spanning the block
  on the anchor's side with its mate on the lane's, `strand` its direction,
  holding `block` and `blockSpan`. The ribbons' color function reads that
  record, so Color by block colors the bands, and a field only the pairs hold
  reads as missing on the band, where painting from one pair took whichever
  pair drew first.
- **The filter reads the pairs, never the band.** A band draws where one of
  its pairs passes, so a `blockSpan` filter drops a band with its pairs, and a
  filter on a field only the pairs hold (`syntenicDepth`, a score) keeps the
  band of every block it leaves a pair in. Filtering the band's own record
  dropped every band under such a filter, the block having no value to test.
- **The record is keyed as a lane-pair link**, so hover, click, the outline
  and `multiwayTables` read it as they read any ribbon, and an R rebuild of the
  figure draws the bands.
- **On by default, with no slot.** A source that states its blocks draws
  them.
- A band draws only in a gutter beside the anchor's record, where the pair it
  comes from draws directly.

## Consequences

- Zoomed inside one block, its band tints the whole gutter, as in the
  tutorial's `mcscan_synteny/gamma_copies` at 370 kb.
- A block's name is its place in one file. Two `.anchors` children of one
  `MultiPairwiseSyntenyAdapter`, or two overlaid tracks, share a color and a
  legend row for `block3`. No demo composes them.
- `blockSpan` counts the pairs that joined a BED, so a BED missing genes gives
  a smaller span than jcvi counts.
- MCScan's multi-genome `.blocks` table, OrthoFinder tables and PAFs state no
  blocks and draw none.

## Rejected alternatives

- **An adapter combining `.anchors` and `.anchors.simple`**: the second file
  is a lossy copy of the first.
- **Another synteny track drawn as a ribbon layer** (`ribbonLayers`) for
  MCScan: a second source to keep in step with lanes the first decides. The
  idea stays parked for sources that state no blocks.
- **Switching between the two tracks by zoom**: declined 2026-09-21 as
  flicker.
- **Blocks as features of their own**: they would outvote genes in the lane
  decisions.
- **Chaining the pairs in the display**: MCScan already chained them.
- **Hiding a band whose block covers the whole window**: the 370 kb view would
  stay as it was, and a band would appear across the gutter when a block's end
  scrolled into view.
- **An opt-in slot**: the default would leave the hairlines the request was
  about.
- **A numeric `block`**: it painted a ramp from the Color by menu.
