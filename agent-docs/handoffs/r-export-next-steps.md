---
name: r-export-next-steps
description: "The R exporter (view menu → Export R script, plugins/marks/src/rexport/) is built, reviewed twice and live-verified on volvox but not landed. Open: Colin's call on landing, an external plugin or holding; R tests in CI; real data with R users; per-position base counts for the coverage band; insertions, clips, sort, facet, modifications and CRAM on alignments."
---

# R export: what is left

Written 2026-10-05, revised 2026-10-10. The exporter turns the open tracks of a linear genome view
into a self-contained `.R` that redraws them in rtracklayer, Rsamtools and
ggplot2. Where the code is, what it draws and the parity rules are in
[R_EXPORT.md](../reference/R_EXPORT.md); the user-facing page is
`website/docs/user_guides/r_export.md`. **Colin has not approved landing it**:
it was landed once by mistake and taken back, so do not merge or push it
without an explicit go.

## State

- Mark displays (BigWig, GFF3, VCF, BED, BigBed, BAM), the wiggle display, the
  gene glyph (GFF3, BED, BigBed) and an alignments pileup export, checked in
  the running app against the browser, over one region or several.
- Reads draw their deletions and splice gaps, mismatch ticks (MD or the
  reference), and the browser's read colors, MAPQ bins and insert-size bands.
- Two fresh adversarial reviews have run. The second, over the alignments and
  gene-glyph translators, found no wrong picture in the fixes it was given;
  its other findings are fixed or listed below.
- Everything ran on volvox and a remote GENCODE bigBed. Nothing has run on an
  hg38 BAM, a CRAM or a ten-track session.

## Decide first (Colin)

1. **Land, ship as an external plugin, or hold.** An external plugin needs the
   grammar leaf modules (`markVocabulary`, `markSpecs`, `stepChannels`,
   `autoBin`) reachable outside the repo, and `@jbrowse/core/util/getLocationUri`
   kept published; see
   [PLUGIN_ABI_STABILITY.md](../reference/PLUGIN_ABI_STABILITY.md). Its cost is a
   silent ABI break with no compiler guard.
2. **Where the translators live.** All three sit in `plugins/marks` because
   `plugins/marks` cannot import `plugins/canvas` or `plugins/alignments`
   without a cycle. A per-display export slot with a shared package would put
   each next to the settings it reads. `BUILTIN_EXPORTERS` in `exportView.ts` is
   the seam.

## Next, in order

1. **Put it in front of two or three R users with their own tracks.** Ask what
   they hit first: an unsupported track, a figure that differs from the browser,
   or a script they could not extend.
2. **Real data.** An hg38 BAM at a deep locus (time it: `bam_mismatches` is
   vectorized, `read_bam` and the pileup packing are not measured), a CRAM, a
   ten-track session, `chr1` against `1` aliases.
3. **Per-position base counts** (`Rsamtools::pileup`) as their own frame. They
   would color the coverage band by allele as the browser does, which the
   header now admits it does not, and give each mismatch its frequency. That
   frequency is data, so it survives a resized figure, unlike a fade keyed to
   pixels per bp, which the second review advised against porting.
4. **Mismatch geometry.** A tick is a fixed-width line; a base cell zoomed in
   is wider. A 1 bp `geom_rect` needs a fill scale of its own beside the reads'.
5. **Insert-size cuts from the browser.** The R estimator re-derives the band
   per region; the live display already holds it and could bake its cuts into
   the script.
6. **Alignments.** Insertions and clips on reads, sashimi arcs, sort, facet,
   modifications, CRAM. The old CRAM, modification and sort helpers and their
   oracles are described in R_EXPORT.md and need only their imports fixed.
7. **The class of bug, not the instances.** Read a rule off the browser's code
   or config at export time where possible (as MAPQ now reads
   `colorEncodingOf`), and keep each one by a test against the TypeScript
   original.

## Verify a change

- `npx jest plugins/marks/src/rexport --reporters=default`. `exportViewR.test.ts`
  runs real scripts in one R session and asserts on what they read
  (`ggplot_build` rows and literal colors), not on a PNG existing.
- **Also drive the real app.** Start the jbrowse-web dev server, open a volvox
  config with a few tracks, click the view menu's Export R script, run the
  downloaded file with `Rscript`, and read the figure beside a screenshot. The
  live path caught three bugs the pure layer cannot: a default mark type the
  config snapshot omits, empty-string placeholders in a resolved config, and a
  `rowColor` default read as a setting.
- Add a sabotage check for any new assertion; a green `exportView.test.ts`
  figure case proves only that a file was written.

## Do not redo

- A bespoke R package, a TS to R transpiler, `facet_grid` for regions, and
  matching the browser pixel for pixel are settled in R_EXPORT.md.
- Do not propose Python or Vega-Lite as a replacement; the goal is the R
  ecosystem.
