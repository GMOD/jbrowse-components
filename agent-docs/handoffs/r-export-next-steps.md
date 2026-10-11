---
name: r-export-next-steps
description: "The R exporter (view menu → Export R script, plugins/marks/src/rexport/) is built and reviewed twice, and since 2026-10-11 reads feature, quantitative and alignments tracks through ggjbrowse and draws them with its geoms; not landed. Open: Colin's call on landing, an external plugin or holding; a live-app check of the engine path; real data with R users; variant displays and the multi-BigWig palette."
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

- Feature (GFF3, GTF, BED, BigBed), quantitative (BigWig, multi-BigWig) and
  alignments (BAM, CRAM) tracks read through ggjbrowse since 2026-10-11 and
  draw as `ggplot(result)` plus a `geom_jbrowse_*` per table, as ggjbrowse's
  `autoplot` composes them. Each display's written config and, where it carries
  a setting, its adapter config go to the engine verbatim (`engineToR.ts`), so
  the gene glyph, labels, BigWig colors and axis, junctions, allele coverage,
  insertions and clips are the browser's own. The hand ports (`bed_features`,
  `gene_parts`, `gene_layout`, `collapse_isoforms`, `alignments_regions`,
  `featureToPlot.ts`, `wiggleToMarks.ts`) are gone.
- Several regions bind into one result through `jbrowse_regions`, on the
  cumulative axis the mark displays share.
- Mark displays still read through rtracklayer and translate in
  `markToPlot.ts`.
- The engine path is unit-tested under R (`exportViewR.test.ts`,
  `rScriptRun.test.ts`) and was checked in the running app on 2026-10-11:
  volvox GFF3, BigBed, BigWig, multi-BigWig, BAM and CRAM, over one region and
  two, downloaded from the menu and run. The live adapter configs come back
  without their defaults, so a GFF3 or BAM passes as a path and the BigBed as
  its adapter list (for `aggregateField`).
- Two differences from the browser remain, both deliberate or known:
  - A feature track draws every row and label. The browser's `heightMode:
    'fit'` squeezes rows into the track's height and drops labels; the engine
    lays out as `grow`, which a figure that sizes itself wants.
  - A multi-BigWig with no declared colors draws navy where the browser draws
    blue (the palette gap in TABLES.md).
- ggjbrowse needs 3c8e7ae or later: a reader taking an adapter config,
  `scale_y_jbrowse()`, and `display$color` read as the config reads it.

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

1. **Variant displays** through `jbrowse_variants` and
   `geom_jbrowse_genotypes`.
2. **The multi-BigWig palette** for sources with no declared color, which the
   engine does not deal yet (TABLES.md).
3. **Put it in front of two or three R users with their own tracks.** Ask what
   they hit first: an unsupported track, a figure that differs from the
   browser, or a script they could not extend.
4. **Real data.** An hg38 BAM at a deep locus, a CRAM, a ten-track session,
   `chr1` against `1` aliases.
5. **Mark displays through the engine** too, once a mark table exists; then
   `read_bigbed`, `read_gff` and the rest of `frameFor.ts` go.

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
