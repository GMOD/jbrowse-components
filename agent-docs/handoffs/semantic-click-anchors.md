---
name: semantic-click-anchors
description: "Figure and tour anchors that name what they point at, a record or a row, instead of a fraction of a track's height, so a screenshot spec survives a band added above its target. Built: the feature anchor (`{ trackId, feature }`, through `featuresNamed`) and the row anchor (`{ trackId, row }`, through the tree sidebar's row geometry), with the stopgaps that waited on them converted. Open: the sweep of the ~79 fractional anchors still on a record or a row, and an anchor kind for reads, arcs and synteny blocks."
---

# Click anchors that name the thing

A spec's callout or click on canvas-drawn data is a locus plus `fracY`/`dy`, a
guess at where something sits in the track's height. It holds only until
something is drawn above it. The variant display merge moved every such anchor on
a variant track twice on 2026-10-31: the records band took the top of the track,
then the band chips took a strip of their own (ADR-254's ninth amendment). It
also deleted the two things clicks used to find, the `feature-name-<id>` label
element and the "C -> T" text. Nothing failed. The anchors landed on the wrong
row, and a reviewer had to spot it in the PNG.

## Built

- **`feature`**: `{ trackId, feature }` resolves through the display's
  `featuresNamed` method (LinearBasicDisplay, and the variant display's
  records band), built only when a capture calls it:
  `products/jbrowse-capture/src/featureAnchor.ts`. It matches the text the
  label shows, so over genotype rows a record is its one-line label with the
  carrier share (`C -> T <1%`), and a record with no ID its description. A
  name labelling more than one laid-out feature, an undrawn one included,
  misses unless `loc` picks a drawn copy. `variant_panel` and
  `link_to_split_view` use it.
- **`row`**: `{ trackId, row, loc? }` resolves through the tree sidebar's
  geometry (`sources` from `rowsTopOffset`, `effectiveRowHeight`, `scrollTop`
  inside `scrollViewportHeight`), so every `TreeSidebarMixin` display answers
  it: `products/jbrowse-capture/src/rowAnchor.ts`. A row answers to its name
  or its label, and a facet band to its label or key, spanning its drawn
  rows. More than one match, a row narrowed away or hidden, and one scrolled
  out of the rows viewport miss. With `loc` the strip narrows to the locus;
  `fracY` is a fraction of the row. The trio crossover frames
  (`trioRowTop` is gone), `popgen/in2lt_inversion` (`row: 'In(2L)t'`, the
  band) and `pangenome/bovine_tas2r46` (`row: 'Gaur'`) use it. The trio
  reshoots were byte-identical to the published figures; the other two moved
  their arrow heads to the middle of the row or band, a few px, and their new
  bytes are not yet in the figure store.

## Next: the sweep

A survey of the 187 `fracY` anchors in specs and tours on 2026-11-02 found 79
on a record or a row; the rest sit on score axes, triangles, ribbons, empty
lane space or whole pileups, where a fraction is the right word. Reshoot each
converted figure and check it against the published one.

- **Rows** (`row:`): `dog10k.ts` (wolfdog, NHEJ1, AMY2B, RNASE1, CYP1A2
  carriers, the most row fractions in one file), `tcga.ts` (`subtypeCallout`'s
  `SUBTYPE_ROW_PITCH`, the CDH1 lobular facet band), `ld.ts`
  (`ld/lct_population_af`), `maf.ts` (the caePb3 hover), `pangenome_cactus.ts`
  (depth by builder), `protein_variants.ts` (sickle-cell and SOD1 top rows),
  `ui.ts` (chromhmm B-cell rows), and `trio.ts`'s painting step box, a
  `paintingTopRow * TRIO_PAINT_ROW_H` depth from the top.
- **Records** (`feature:`): gene glyphs in `alignments.ts` (SURF1/SURF2),
  `features.ts` and `ui.ts` (Apple3, TP53), `msa.ts` (NLRP1), `sv.ts` (SV_85,
  SMAD4), `protein_*.ts` codon callouts, `videos/proteins.ts`; records in
  `cancer_sv.ts` (truth set), `graph-hprc.ts` (KIV-2 and ABCA7 TRs),
  `grant_callout_sizes.ts` and `ld.ts` (GWAS and ClinVar), `alphagenome.ts`
  (the enhancer variant), `videos/sv.ts` (HGSV_1821).
- **No anchor kind yet**: an alignments read (`alignments.ts`, `ui.ts`,
  `cancer_sv.ts`, `bovine_bola`), a sashimi arc or `link` mark
  (`alignments.ts`, `cancer_sv.ts` K562, `protein_figure_met_ex14.ts`), a
  synteny chain block or multi-way lane record (`synteny.ts`,
  `videos/synteny.ts`), and an alignments group band
  (`methylation/hg002_snrpn_grouped`, held by a `text` stopgap today).

Declined: ARIA elements per on-screen feature, so the harness could click by
role and name. The goal is screenshot specs that survive layout changes, which
the two harness anchors reach without DOM per feature (Colin, 2026-11-01: "i
dont care a lot about aria").
