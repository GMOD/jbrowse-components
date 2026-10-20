---
name: tables-order-contig-colors-by-the-assembly
description: A tables export colors by contig (synteny/dotplot `query`/`target`, alignments `mateRefName`) in natural or file order, where the view uses the assembly's order and aliases. They agree for a naturally ordered FASTA. Fix with an axis `assembly` the engine resolves, plus ggjbrowse taking assembly configs and laying whole-genome axes in that order.
---

# Tables order contig colors by the assembly

Split from
[a-tables-export-calls-the-models-decisions](a-tables-export-calls-the-models-decisions.md)
on 2026-10-20.

**The view:** a color by contig hands out the palette by
`Assembly.getRefNamePosition`, which canonicalizes the name and reads its
index in the assembly's regions (`packages/core/src/assemblyManager/assembly.ts`).

**The tables:**

- Synteny and dotplot deal by the axis's `refNames` (`axisNamePosition`,
  `synteny-core/src/comparativeTables.ts`), else the regions on screen.
  Since ggjbrowse 688c92b, R sends each side's contigs in natural order, the
  order its whole-genome axis lays them.
- Alignments deal `mateRefName` by its `refNames` arg, else the BAM header
  (`positionIn`, `alignments/src/tables.ts`). The engine's `named` step drops
  the call's `assembly` before the table function sees it, and R never
  passes `refNames`.

**Where they disagree:**

- An assembly whose FASTA lists contigs in another order (`chr10` before
  `chr2`, or scaffolds interleaved): R paints the slots in natural order,
  the view in FASTA order.
- A file spelling a contig by an alias (`1` against a canonical `chr1`): the
  tables find no position for it and fall back to a hash color, which the
  view does not.

## Steps

1. **Engine, comparative:** `AxisArgs` takes `assembly`, an assembly config
   as the linear readers take one. The engine (`packages/tables/src/index.ts`)
   resolves it with `assemblyOf` and hands the axis a position function:
   canonicalize, then index in the assembly's regions. `axisNamePosition`
   reads that function before `refNames`.
2. **Engine, alignments:** where the call names an `assembly` and no
   `refNames`, deal `mateRefName` by the resolved assembly the same way.
3. **ggjbrowse:** `jbrowse_synteny` and `jbrowse_dotplot` take assembly
   configs (`jbrowse_assembly()` or a config list) where `assemblies` now
   takes names. A whole-genome axis then lays its contigs in the assembly's
   order, its palette follows, and `axis_args` passes the config.
   Natural order stays the default with no assembly.
4. **Tests:**
   - A FASTA listing contigs out of natural order: a contig keeps one color
     alone, whole-genome and in the view.
   - A PAF spelling contigs by alias: no hash colors.
   - A BAM whose header order differs from its reference: `mateRefName`
     colors match the view.
