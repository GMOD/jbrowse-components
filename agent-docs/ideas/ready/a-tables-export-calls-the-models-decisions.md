---
name: a-tables-export-calls-the-models-decisions
description: Each display's tables.ts re-derives some of what its model decides (palette order by contig, split to its own entry), so an R or CLI export can paint or key a picture the view does not. The fix per site is one pure function both call.
---

# A tables export calls the model's decisions

GRAMMAR_OF_GRAPHICS.md rule 2 holds the tables export to the one object every
surface reads. A census on 2026-10-20 found these sites where a `tables.ts`
computes a display decision by its own code, ranked by how readily the two
disagree today.

## Can disagree now

- **Contig palette order.** The tables order a color by contig naturally or
  by the file, the view by the assembly; they agree for a naturally ordered
  FASTA. Steps to close it:
  [tables-order-contig-colors-by-the-assembly](tables-order-contig-colors-by-the-assembly.md).

The parity suites in `packages/tables/src/parity/` (TEST_INFRASTRUCTURE.md)
hold a known disagreement as a drift pinned to the export's value today; the
wiggle and variants suites hold none. Their last ones closed by running the
display's own views on the tables' static hosts
([a-displays-render-inputs-run-on-a-plain-host](a-displays-render-inputs-run-on-a-plain-host.md)):
the `rows.tree` order, wiggle's categorical key (`legend`, `legendTitle`) and
its rules on a heatmap (`scoreRulesDrawn`), and the variants records-band
key, `genotypes: { show: false }` (`drawsGenotypeRows`) and an identity color
callback's names (`variantDataColorScales`). Still open:

- **Synteny and dotplot tables key the default color.** With no
  `encoding.color` field (unset, a `value` constant, or only an opacity or
  filter), the view keys nothing (`hasLegendKey`); the synteny tables key
  `Default` with a `match` chip and a chip per CIGAR op drawn, the dotplot
  tables an `alignment` chip in black. Under `{ value: '#008000' }` that is a
  red `match` chip over green ribbons.
- **Synteny and dotplot tables key no track chip.** Under `encoding.color:
  'track'` the view keys `Track` with the track's name in its palette color
  (`colorLegendChips`); the tables key nothing, since `comparativeLegend`
  passes no `trackChips`.

## Equivalent today, by hand

- Autoscale glue in alignments coverage's tables, and the nice-rounding step
  in wiggle's, which ignore `encoding.y.scale.group`. Wiggle's range, color
  and mark sources run the model's own getters, and the wiggle and variants
  rows, row colors and row color key run `TreeSidebarMixin`'s
  ([a-displays-render-inputs-run-on-a-plain-host](a-displays-render-inputs-run-on-a-plain-host.md)).
- The features carry-overs in `plugins/features/src/tables.ts`: the collapsed
  mode's forced `subfeatureLabels` of `'none'`, the `resolvedGeneGlyphMode`
  call in the fetch args, and the hand-built `layoutInputs` handed to
  `hostFeatureBand`.

## Not a defect

The synteny tables decide the `auto` thin-ribbon fade from one level with no
latch, where the view latches (`SyntenyFadeMixin.ts`) and takes the narrowest
level: the latch is hysteresis against flicker while zooming, which a static
export has no history for.

Canvas label density counted a feature crossing two regions twice; the tables
count each feature once now, as the display's on-screen ids do.

The alignments tables key reads and arcs apart (`legend`, `arcLegend`) where
the display's one legend box merges them when they share a color
(`getAlignmentsColorScales`). Merging in the export was built and reverted on
2026-10-20: ggjbrowse draws reads and arcs as separate layers, each with its
own guide, so an arcs-only plot lost its key. Merging is the legend box's
presentation, which a host composing its own guides does for itself.

Variants categorical slots start empty in the tables, where the view holds
them session-wide (`display-kit/src/heldColorSlots.ts`): a stateless export
has no session to hold them.
