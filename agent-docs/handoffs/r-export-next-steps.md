---
name: r-export-next-steps
description: "The R script export (view menu → Export R script, plugins/linear-genome-view/src/LinearGenomeView/rExport/) is a doorway to ggjbrowse: reader calls plus one jbrowse_stack(). Open: Colin's go to land it, mark displays through an engine marks table, the ggjbrowse vignette and first R users."
---

# R export: what is left

Revised 2026-10-11. The export writes a short script of ggjbrowse reader calls
and one `jbrowse_stack()`; [R_EXPORT.md](../reference/R_EXPORT.md) has where
the code is, what it reads and the settled decisions, and
`website/docs/user_guides/r_export.md` is the user-facing page. ggjbrowse is
the product and the export a doorway to it (Colin, 2026-10-11); in-browser R is
not wanted.

## Decide first (Colin)

- **Land it.** It was landed once by mistake and taken back, so it waits on an
  explicit go. It now lives in `plugins/linear-genome-view` beside Export SVG,
  is lazily imported, needs only core and adds no plugin export. Checked in
  the running app on 2026-10-11 over volvox GFF3, BigBed, BigWig,
  multi-BigWig, VCF and BAM tracks, one region and two: each figure matched
  its view.

## Next, in order

1. **Mark displays through the engine.** A marks table in `@jbrowse/tables`
   built on `CoreGetEncodedLayers` / `markLayerRequest`, and one
   `geom_jbrowse_marks()`, would bring back every arc/link track (BEDPE,
   Hi-C loops, junctions) and the GWAS display without a hand translator.
2. **ggjbrowse for its first users:** a vignette built from
   `scripts/figures.R`, a tagged release once `@jbrowse/tables` publishes, an
   r-universe build so V8 installs as a binary, then two or three R users with
   their own tracks.
3. **Real data:** an hg38 BAM at a deep locus, a CRAM, a ten-track session.

## ggjbrowse API review (2026-10-11)

ggjbrowse 0.2.0 (4d8b6f1) fixed the review's top four, each reviewed again:

- Engine warnings and errors queue and are raised once the call returns
  (`in_engine`, `R/engine.R`), so a `tryCatch(warning =)` no longer leaves V8
  to abort R on the next read.
- A result over several loci keeps genomic `start`/`end`/`position`, each row
  with `chrom` and `.region`; `on_axis()` moves rows onto the end-to-end axis
  as they draw. Figures render byte-identical to 0.1.1.
- `jbrowse_stack()` and `autoplot(<alignments>, tracks =)` refuse tracks over
  different spans (contig names may differ, as aliased files spell them) and
  stack a plain ggplot as a band.
- `jbrowse_alignments()` takes its settings in `display` only.

Still open, smaller:

- `inherit.aes = FALSE` drops plot-level aesthetics.
- A join on `features` does not reach `geom_jbrowse_glyphs`' other tables.
- `scale_*_jbrowse` take no `name`/`...`.
- A bad contig among several loci, and a reversed or overlong locus, pass
  silently.
- `width` vs `px_per_bp`, and `min_reads` vs `min_junction_reads`.
- Printed regions are 0-based.
- `jbrowse_sequence` takes no locus.
- Two tracks on different contigs with the same span stack under one label.

## Gallery comparison (2026-10-11)

Thirteen live exports beside their views (https://claude.ai/artifact/6h9xxrCvFpkf1J1T2q6cgw)
led to ggjbrowse 0.2.1: sub-pixel features draw a pixel wide, the genotype
matrix paints its grey reference rows, section labels read across. Still
differing:

- A density or other ramp draws no key in R (`legendOf` keys categorical
  scales only).
- A multi-sample matrix leaves out the `rowColor` group colors; the engine's
  `rows` table carries none.
- A multi-sample matrix's row labels overprint past about 40 rows.

Reads now draw at the display's `featureHeight` (ggjbrowse 0.3.0, engine
d4744ce27e reporting the band pixel sizes), and the script saves at
`jbrowse_height()`, so compact and super-compact pileups match the browser.
