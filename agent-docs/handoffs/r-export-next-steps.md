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

An adversarial review of ggjbrowse 0.1.1; the first three reproduced by hand.

- **V8 aborts R.** `tryCatch(..., warning =)` around a reader that warns
  (e.g. `display = list(colour = "red")`) leaves V8 broken; the next reader
  call kills the process. Buffer engine warnings in `call_engine`
  (`R/engine.R`) and raise them after the call returns.
- **Several loci rewrite coordinates.** `bind_regions` (`R/regions.R`) moves
  `start`/`end` onto the end-to-end axis (region 2 of
  `c("ctgA:1,001-4,000", "ctgA:6,001-9,000")` reads 4072–7069), so a join
  against the user's own BED is silently wrong. Keep genomic columns and add
  axis `x`/`xend`.
- **`jbrowse_stack` takes mismatched regions** without a word, labelling the
  axis with the last track's contig, and rejects a plain ggplot of the user's
  own.
- **Two spellings for alignments settings:** top-level `color = "strand"`
  means a field and wins silently over `display = list(color = ...)`, where a
  bare string is a constant. The README uses the first, the export the second.
- Smaller: `inherit.aes = FALSE` drops plot-level aesthetics; a join on
  `features` does not reach `geom_jbrowse_glyphs`' other tables;
  `scale_*_jbrowse` take no `name`/`...`; a bad contig among several loci and
  a reversed or overlong locus pass silently; `width` vs `px_per_bp` and
  `min_reads` vs `min_junction_reads`; printed regions are 0-based; tables
  carry no `chrom`; `jbrowse_sequence` takes no locus; README:217's restyle
  example draws mismatches twice.
