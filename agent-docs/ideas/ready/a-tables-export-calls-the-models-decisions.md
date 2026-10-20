---
name: a-tables-export-calls-the-models-decisions
description: Each display's tables.ts re-derives some of what its model decides (palette order by contig), so an R or CLI export can paint or key a picture the view does not. The fix per site is one pure function both call.
---

# A tables export calls the model's decisions

GRAMMAR_OF_GRAPHICS.md rule 2 holds the tables export to the one object every
surface reads. A census on 2026-10-20 found these sites where a `tables.ts`
computes a display decision by its own code, ranked by how readily the two
disagree today.

## Can disagree now

- **Contig palette order off an assembly the export never sees.** The view
  deals `query`/`target`/`mateRefName` colors in the assembly's order
  (`refNamePositionFor`, `synteny-core/src/colorFunctions.ts`). The tables
  deal them in an axis's `refNames` (`axisNamePosition`,
  `synteny-core/src/comparativeTables.ts`), else the regions' order, and
  `alignments/src/tables.ts` in its `refNames`, else the BAM header's.
  - Since ggjbrowse 688c92b, R sends each comparative axis's contigs in the
    natural order its whole-genome axis lays them, so a contig shown alone
    keeps its slot. That matches the view where the assembly lists its
    contigs in natural order, the usual FASTA.
  - Left: an assembly in another order, and contig aliases. The fix is an
    axis `assembly` the tables resolve through `assemblyOf`, ordering the
    palette by its regions and aliases as `getRefNamePosition` does. Build it
    together with R laying a whole-genome axis in the assembly's order, which
    needs `jbrowse_synteny` to take assembly configs where it now takes names.

## Equivalent today, by hand

- Autoscale glue in wiggle's and alignments coverage's tables, which ignores
  `scales.y.autoscaleGroup`.
- Variants row colors (`variants/src/tables.ts:726-756`) and four canvas
  carry-overs (`canvas/src/tables.ts:377, 402-404, 465-471`).

## Not a defect

The synteny tables decide the `auto` thin-ribbon fade from one level with no
latch, where the view latches (`SyntenyFadeMixin.ts`) and takes the narrowest
level: the latch is hysteresis against flicker while zooming, which a static
export has no history for.

Canvas label density counted a feature crossing two regions twice; the tables
count each feature once now, as the display's on-screen ids do. The variants
key leaves out the insertion entry the display's key carries, and the tables
emit no insertion markers either, so the two agree.

The alignments tables key reads and arcs apart (`legend`, `arcLegend`) where
the display's one legend box merges them when they share a color
(`getAlignmentsColorScales`). Merging in the export was built and reverted on
2026-10-20: ggjbrowse draws reads and arcs as separate layers, each with its
own guide, so an arcs-only plot lost its key. Merging is the legend box's
presentation, which a host composing its own guides does for itself.

Variants categorical slots start empty in the tables, where the view holds
them session-wide (`display-kit/src/heldColorSlots.ts`): a stateless export
has no session to hold them.
