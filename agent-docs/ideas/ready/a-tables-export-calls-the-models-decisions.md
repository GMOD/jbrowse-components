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
hold each of these as a `test.failing` drift:

- **`rows.tree` order**, wiggle and variants: the view orders rows by the
  tree's leaves, the tables by `rows.sort` and the file. The tree-sidebar row
  chain.
- **Wiggle keys no categorical scale.** The view keys the subtracks over a
  shared plot, a `rows.color` attribute and a threshold's bands (`< -20`,
  `-20 – 20`, `≥ 20`); the tables ship `ramps` alone. Minimal:
  `{ rows: { field: '' } }` on a MultiWiggleAdapter.
- **Wiggle rules on a heatmap.** `{ mark: 'rect', encoding: { y: { rules:
  [{ value: 10 }] } } }`: the view draws no rule, the tables list one.
- **Variants key no records-band scale.** An SV VCF's view keys `SV type`
  (Duplication) above the genotype key; the tables do not.
- **Variants under `genotypes: { show: false }`** ship every row, their colors
  and the genotype key; the view draws no row and keys nothing.
- **Variants under an identity color callback** (`value: 'jexl:…'`,
  `scale: { type: 'identity', domain, names }`) key nothing; the view keys
  the named colors (`identityKeyEntries`).

## Equivalent today, by hand

- Autoscale glue in alignments coverage's tables, and the nice-rounding step
  in wiggle's, which ignore `encoding.y.scale.group`. Wiggle's range, color
  and mark sources run the model's own getters
  ([a-displays-render-inputs-run-on-a-plain-host](a-displays-render-inputs-run-on-a-plain-host.md)).
- Variants row colors (`rowColorsOf` in `plugins/variants/src/tables.ts`) and
  the features carry-overs in `plugins/features/src/tables.ts`: the collapsed
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
