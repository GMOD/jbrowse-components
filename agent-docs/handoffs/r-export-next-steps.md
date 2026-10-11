---
name: r-export-next-steps
description: "The R exporter (view menu → Export R script, plugins/marks/src/rexport/) is built, reviewed twice, live-verified on volvox and, for alignments, reads through ggjbrowse, but is not landed. Open: Colin's call on landing, an external plugin or holding; feature tracks through the engine too; real data with R users; per-position base counts for the coverage band; insertions, clips, sort, facet and modifications on alignments."
---

# R export: what is left

Written 2026-10-05, revised 2026-10-11. The exporter turns the open tracks of a linear genome view
into a `.R` that redraws them in ggplot2, alignments read through ggjbrowse
(JBrowse's engine in R) and the rest through rtracklayer. Where the code is,
what it draws and the parity rules are in
[R_EXPORT.md](../reference/R_EXPORT.md); the user-facing page is
`website/docs/user_guides/r_export.md`. **Colin has not approved landing it**:
it was landed once by mistake and taken back, so do not merge or push it
without an explicit go.

## State

- Mark displays (BigWig, GFF3, VCF, BED, BigBed, BAM), the wiggle display, the
  gene glyph (GFF3, BED, BigBed) and an alignments pileup export, checked in
  the running app against the browser, over one region or several.
- Alignments (BAM and CRAM) read through ggjbrowse since 2026-10-11: the
  display's `color` and `filter` objects go to the engine as written, so every
  scheme the browser paints (strand, MAPQ bins, insert-size bands, pair
  orientation, tags, a declared `range`) and every filter comes back exact,
  with the browser's key; reads draw their deletions, splice gaps and mismatch
  ticks (MD or the reference). The hand-written BAM readers and the samtools
  CRAM decode are gone.
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

1. **Feature tracks through the engine too.** `read_bigbed`, `bed_features`,
   `gene_parts`, `collapse_isoforms` and `gene_layout` are the hand ports of
   browser rules the alignments path just shed; a `featureTables` beside
   `alignmentTables` (the GFF3, BED, BigBed and VCF adapters plus the gene
   glyph's layout) would retire them the same way. `TABLES.md` has the
   contract shape.
2. **Put it in front of two or three R users with their own tracks.** Ask what
   they hit first: an unsupported track, a figure that differs from the browser,
   or a script they could not extend.
3. **Real data.** An hg38 BAM at a deep locus (time the engine's read and the
   `alignments_regions` bind), a CRAM, a ten-track session, `chr1` against
   `1` aliases.
4. **The coverage band's allele colors.** The engine's `mismatches` already
   carries each mismatch's `frequency`; a per-position base-count table from
   the worker's SNP pass would color the band as the browser does, which the
   header now admits it does not.
5. **Mismatch geometry.** A tick is a fixed-width line; a base cell zoomed in
   is wider. A 1 bp `geom_rect` needs a fill scale of its own beside the reads'.
6. **Alignments.** Insertions and clips on reads (the worker has them), a key
   for a linear ramp (the display's `ramps`), sashimi arcs, sort, facet,
   modifications. Each is an engine table or column first, then a layer.
7. **The class of bug, not the instances.** Read a rule off the browser's code
   at export time, or better run it in the engine, and keep each one by a test
   against the TypeScript original.

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

- A black-box drawing package, a TS to R transpiler, `facet_grid` for
  regions, and matching the browser pixel for pixel are settled in
  R_EXPORT.md; so is hand-porting a browser rule the engine can run.
- Do not propose Python or Vega-Lite as a replacement; the goal is the R
  ecosystem.
