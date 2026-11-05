---
name: tables-order-contig-colors-by-the-assembly
description: ggjbrowse's synteny and dotplot still color by contig in natural order. The engine now deals the palette by an axis's `assembly` config, as the view does, aliases included; R has to send one and lay whole-genome axes in its order.
---

# Tables order contig colors by the assembly

Split from
[a-tables-export-calls-the-models-decisions](a-tables-export-calls-the-models-decisions.md).

**The engine:** the view and the tables deal a by-contig palette through one
function, `refNamePositionIn` (`core/src/assemblyManager/refNameMaps.ts`).
A synteny or dotplot axis's `assembly` and an alignments call's `assembly`
order the palette, ahead of `refNames` and the BAM header
(`packages/tables/src/contigColors.test.ts`).

## What ggjbrowse needs

- `jbrowse_synteny` and `jbrowse_dotplot` take assembly configs
  (`jbrowse_assembly()` or a config list) where `assemblies` now takes names,
  and `axis_args` sends each as the axis's `assembly`. Natural order stays the
  default with no assembly.
- A whole-genome axis lays its contigs in the assembly's order (the engine's
  `regions` call lists them), so the axis and its palette agree.
- An axis's regions are not renamed through the assembly: they stay spelled
  as the file spells its contigs.
- The alignments reader needs no change where it already sends `assembly`.
