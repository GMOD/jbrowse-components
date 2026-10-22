---
name: r-export-next-steps
description: "The R script export (view menu → Export R script, plugins/linear-genome-view/src/LinearGenomeView/rExport/) is a doorway to ggjbrowse: reader calls plus one jbrowse_stack(). On main. Open: the ggjbrowse vignette and first R users, real-data checks, and ggjbrowse matching a bare contig name through the engine's canonical names."
---

# R export: what is left

Revised 2026-10-19. The export writes a short script of ggjbrowse reader calls
and one `jbrowse_stack()`; [R_EXPORT.md](../reference/R_EXPORT.md) has where
the code is, what it reads and the settled decisions, and
`website/docs/user_guides/r_export.md` is the user-facing page. ggjbrowse is
the product and the export a doorway to it (Colin, 2026-10-11); in-browser R is
not wanted.

## Next, in order

1. **ggjbrowse for its first users:** a vignette built from ggjbrowse's
   figures script and its README gallery, a tagged release once
   `@jbrowse/tables` publishes, an r-universe build so V8 installs as a
   binary, then two or three R users with their own tracks.
2. **Real data:** an hg38 BAM at a deep locus, a CRAM, a ten-track session.
3. **ggjbrowse names a whole contig by its alias:** on ggjbrowse's main,
   `parsed_regions()` matches a bare name against the file's contigs as
   typed, so `12` for a file spelling it `chr12` is refused while the locus
   `12:1-100` reads. The engine gives `fileRegions` and `regions` a
   `canonical` column and `canonicalNames({ assembly, refNames })`
   (TABLES.md). ggjbrowse's unmerged `engine-calls` branch matches a name's
   canonical against the contigs', and lands with the next bundle.

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
- R reads a locus past its contig's end without a warning.
- `width` vs `px_per_bp`.
- Printed regions are 0-based.
- Two tracks on different contigs with the same span stack under one label.

## Gallery comparison (2026-10-11)

Thirteen live exports beside their views (https://claude.ai/artifact/6h9xxrCvFpkf1J1T2q6cgw)
led to ggjbrowse 0.2.1: sub-pixel features draw a pixel wide, the genotype
matrix paints its grey reference rows, section labels read across. A ramp
keys as a bar since ggjbrowse 0.6.0 (the tables' `ramps`, `rampKeyOf`), and
`baseColor: baseQuality` paints each base (`qualities`).

A multi-region wiggle autoscales over every region together, as the
browser does: `wiggleTables` (`plugins/wiggle/src/tables.ts`) runs
`computeAutoscaleDomain` over every region's sources, and ggjbrowse's
`test-wiggle.R` checks that two loci share one axis and one ramp.

Reads now draw at the display's `featureHeight` (ggjbrowse 0.3.0, engine
d4744ce27e reporting the band pixel sizes), and the script saves at
`jbrowse_height(fig)` (0.4.0, which measures the figure), so compact and
super-compact pileups match the browser. Matrix row labels fit their rows
(0.3.2).

## Simplicity review (2026-10-11), not taken

- Move `settingNotes` into ggjbrowse as reader warnings, so direct R users
  hear about a `mateRefName` color too.
- The reader could write `inset` into its tables and drop `jbrowse_layer`'s
  `rows`/`finish`, at the cost of a drawing detail in the data.
- Keep `on_axis()` at the top of the `autoplot` methods: `arc_top()` reads
  `x$arcs` directly, and dropping it there changed the arc band.

## Gallery feedback round (2026-10-11)

Done in ggjbrowse 0.5.0 and 0.5.1, with the engine reporting each variant
row's `rowColor` and the wiggle display's `height` (58f0b9c842, 0a713fa097):
comma-written axes, bands close together, each facet section's coverage over
its own reads, modification calls on the reads, no unasked-for sequence band,
arcs at the view's scale and flattened to their band, split reads arcing
across two regions, matrix rows marked by their samples-file group, and a
multi-wiggle packing 1,000 rows into its height without gaps.

Still open:

- At 1 px a row the browser blends a bar into a tint; R draws its height
  within the row, which reads as fine stripes.
- The strand facet could also stack every section's coverage above every
  section's reads, the old R layout, as an option for both apps.

## ggjbrowse fixes through ea5a69d (2026-10-19)

- Arcs and arc ticks draw at the display's px width; read as points, they
  drew twice as thick.
- Curved ribbons follow the display's Bezier in y as well as x.
- Insertions draw as `insertionGlyph.slang` sizes them, and indels fade by
  size below a pixel on top of the frequency fade.
- Junction counts show only under `sashimi.labels.show`, and letters at the
  display's 6.5 px a base.
- A feature file's contig of unknown length ends at its last record; other
  readers take the length the file states, which a multi-wiggle now reports
  (its BigWigs' longest).
- A region that is reversed or starts before base 1 is refused, and a
  region on a contig the file lacks warns.

## Dropped 0.9 branch (2026-10-18)

An unlanded branch ("emit ggjbrowse 0.9's frozen contract", 6d0ef8c951) lost to
main's assembly reader and 0.10.0 work. Three ideas from it survive, checked
against ggjbrowse 0.10.0:

- `jbrowse_features()` takes `color_by_cds =` and `amino_acids =`. The export
  passes neither, so a feature track's CDS coloring and amino acids drop.
- `jbrowse_stack()` can title its bands from named arguments; the export
  writes `jbrowse_stack(a, b)`.
- The menu label reads "Export R script"; "(beta)" is Colin's call.

The branch's `jbrowse_genotypes()` and `view = list(colorByCDS, showAminoAcids)`
do not exist in ggjbrowse.
