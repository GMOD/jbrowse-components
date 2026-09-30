---
status: Accepted
summary: "The strand arrow's width gate has two values: 14 px for any feature, 7 px — one arrow length — for a gene. The worker ships the choice as an `arrowGene` lane copied from the feature's `flatbushItems` gene bit (`isGeneType`), so the shader, the Canvas2D/SVG arrow mark, layout's room reservation and hit-testing read one bit and cannot disagree. Every multi-way synteny lane is a gene, so its arrows take the gene gate. Rejected: a glyph-kind test, a per-track uniform, a sentinel in `arrowWidthsBp`, and no floor"
---

# ADR-200: A gene keeps its strand arrow down to one arrow length

## Status

Accepted (2026-09-30). Narrows the single 14 px gate that
[ADR-051](adr-051-shader-js-codegen-is-scalar-only.md) lists for `arrowDraws`.

## Context

`arrowDraws` dropped the 7 px strand arrow on any feature under 14 px, so a
gene 8-10 px wide showed no direction. The gate exists for repeats: an arrow
past a sub-pixel stranded mark sits on its neighbour, and reserving its room
packed 5000 such marks 46 rows deep instead of 2. Genes are sparse by
comparison, and strand is the main fact a gene glyph carries.

## Decision

- **`arrowDraws(widthPx, gene)`** compares against
  `GENE_ARROW_MIN_FEATURE_WIDTH_PX` (7) for a gene and
  `ARROW_MIN_FEATURE_WIDTH_PX` (14) otherwise.
- **The bit is `FlatbushItem.gene`**, the same `isGeneType` answer the labels
  and layout already use. `packRenderArrays` copies it per arrow into
  `arrowGene` through the arrow's `flatbushIdx`. The shader reads it as an
  instance attribute; Canvas2D/SVG and `ink` read the lane;
  `strandArrowReachPx(strand, widthPx, gene)` reads `geom.gene` in layout and
  `item.gene` in hit-testing.
- **Multi-way synteny ships `arrowGene` as 1 for every arrow**, since each lane
  is a gene.
- **The floor is 7 px, not zero.** Nothing collapses a sub-pixel gene before
  its arrow matters (`densityFade` is `Box`-only), so a gene at about one per
  pixel reserves 9 px of packing room instead of 2. At a 7 px floor the room
  at most doubles, and the arrow is never longer than the gene it marks.

## Rejected alternatives

- **Exempt the transcript glyph.** `processTranscriptLayout` also draws
  `cDNA_match`/`EST_match` alignments, whose `gene` bit is false. Their arrows
  would paint with no room reserved.
- **A per-track uniform.** An NCBI GFF track mixes genes with `cDNA_match` and
  `repeat_region`, so the choice is per feature.
- **Encode the exemption in `arrowWidthsBp`.** Canvas2D derives the feature's
  other end from it, and layout and hit-testing never read it.
- **No floor.** The packing cost above.
