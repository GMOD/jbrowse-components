---
name: a-tables-export-calls-the-models-decisions
description: Each display's tables.ts re-derives some of what its model decides (palette order by contig, merged legend sections, the synteny fade latch, label density, wiggle's mark colors), so an R or CLI export can paint or key a picture the view does not. The fix per site is one pure function both call.
---

# A tables export calls the model's decisions

GRAMMAR_OF_GRAPHICS.md rule 2 holds the tables export to the one object every
surface reads. A census on 2026-10-20 found these sites where a `tables.ts`
computes a display decision by its own code, ranked by how readily the two
disagree today.

## Can disagree now

- **Contig palette order.** `linear-comparative-view/src/tables.ts:373-378`,
  its offscreen strip (507-516), `dotplot-view/src/tables.ts:105-110` and
  `alignments/src/tables.ts:388, 1408` deal `query`/`target`/`mateRefName`
  colors in the order of the contigs passed in (`axisNamePosition`,
  `synteny-core/src/comparativeTables.ts:109-112`). The view deals in the
  assembly's order through `refNamePositionFor`
  (`synteny-core/src/colorFunctions.ts:104-121`). With chr2 shown alone, the
  view paints it palette slot 1 and the tables slot 0. Fix: one
  `refNamePositionOf(refNames, aliases)` both call.
- **Alignments legend sections.** `alignments/src/tables.ts:494-551, 948-964`
  emit `legend` and `arcLegend` apart; the view merges matching sections and
  folds split twins in `getAlignmentsColorScales`
  (`shared/legendUtils.ts:232-275`). Chain mode with read connections repeats
  the orientation rows. Fix: the tables call `getAlignmentsColorScales`.
- **Synteny thin-ribbon fade on `auto`.** `linear-comparative-view/src/tables.ts:403-412`
  decides from one level with no latch; the view latches
  (`synteny-core/src/SyntenyFadeMixin.ts:61-66`) and takes the narrowest level
  (`LinearSyntenyView/model.ts:530-539`).
- **Canvas label density.** `canvas/src/tables.ts:432-436` counts features
  across concatenated regions; the view counts unique on-screen ids
  (`LinearBasicDisplay/baseModel.ts:438-475`), so a feature crossing two
  regions counts twice near `maxLabelFeatureDensity`.
- **Variants key.** `variants/src/tables.ts:374-388` passes no insertion
  marker entry where the view's key has one (`model.ts:2279`).

## Equivalent today, by hand

- Wiggle mark colors: `wiggle/src/tables.ts:230-252` rebuilds `paletteDeals`,
  the `UNCOLORED_ROW` grey and `markSources` that the model builds at
  `LinearWiggleDisplay/model.ts:386-396` and `TreeSidebarMixin.ts:584-586`.
- Autoscale glue in wiggle's and alignments coverage's tables, which ignores
  `scales.y.autoscaleGroup`.
- Variants row colors (`variants/src/tables.ts:726-756`) and four canvas
  carry-overs (`canvas/src/tables.ts:377, 402-404, 465-471`).

## Not a defect

Variants categorical slots start empty in the tables, where the view holds
them session-wide (`display-kit/src/heldColorSlots.ts`): a stateless export
has no session to hold them.
