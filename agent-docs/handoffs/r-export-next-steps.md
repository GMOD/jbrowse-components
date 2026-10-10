---
name: r-export-next-steps
description: "The R exporter (view menu → Export R script, plugins/marks/src/rexport/) is built and live-verified on volvox but not landed. Open: Colin's call on landing, an external plugin or holding; trying it on real tracks with R users; an adversarial pass over the alignments and gene-glyph translators, which the first review barely touched; BigBed; the gene glyph's isoform collapse; CI for the Rscript suite."
---

# R export: what is left

Written 2026-10-05. The exporter turns the open tracks of a linear genome view
into a self-contained `.R` that redraws them in rtracklayer, Rsamtools and
ggplot2. Where the code is, what it draws and the parity rules are in
[R_EXPORT.md](../reference/R_EXPORT.md); the user-facing page is
`website/docs/user_guides/r_export.md`. **Colin has not approved landing it**:
it was landed once by mistake and taken back, so do not merge or push it
without an explicit go.

## State

- Mark displays (BigWig, GFF3, VCF, BED, BAM), the wiggle display, the gene
  glyph (GFF3 and BED) and a basic alignments pileup (coverage, reads, mismatch
  ticks) export, checked in the running app against the browser.
- One adversarial review (a fresh read-only reviewer) hunted the mark path
  hardest. Its findings are fixed except BigBed and the type-duplication cleanup.
- Everything was verified on volvox. Nothing has run on an hg38 hub, a large
  remote BAM, a CRAM or a session of ten tracks.

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
3. **Whether R belongs in CI.** `rScriptRun.test.ts` and `exportViewR.test.ts`
   skip themselves where R is absent, which is every CI run, so a regression
   stays green.

## Next, in order

1. **Put it in front of two or three R users with their own tracks.** The open
   question is demand, not correctness. Ask what they hit first: an
   unsupported track, a figure that differs from the browser, or a script they
   could not extend.
2. **A second adversarial review aimed at `alignmentsToR.ts` and
   `featureToPlot.ts`.** Brief it as the first one was (read-only, fresh, told
   to break it, repros required), pointed at those two and at the live path in
   `exportLinearView.ts`. Expect color, coordinate and strand bugs like the
   ones found in the mark path.
3. **Try real data.** An hg38 hub gene track, a large remote BAM, a CRAM, a
   ten-track session, refName aliases (`chr1` against `1`), a flipped view, and
   a view of two regions. Read each figure against the browser.
4. **BigBed.** rtracklayer fails on BED12 block lists inside a bigBed, so gene
   tracks from hubs would lose their exons. Options: read blocks another way, or
   draw boxes only and say so in the header. Most hub gene tracks are BigBed, so
   this decides how useful the export is on hosted data.
5. **Gene glyph.** Collapse to one isoform in `auto` mode as the browser does
   (dense windows now overprint labels), then color by field, facet, compact
   modes, and panel height that grows with the packed rows.
6. **Alignments.** Indels, clips and splice gaps on reads; more than one region;
   sort; facet; modifications; CRAM. The old CRAM, modification and sort
   helpers and their oracles are described in R_EXPORT.md and need only their
   imports fixed.
7. **The class of bug, not the instances.** The translators re-derive the
   browser's rules by hand (palettes, zoom gates, domain fallbacks, SO terms).
   Anything that can be read from the browser's own code or config at export
   time, such as the tag palette's 30 shades or the browser's collision
   avoidance for unlisted domain values, should be, and each rule kept by a
   test that compares R with the TypeScript original.
8. **Cosmetics.** A 1 bp mark in a wide window antialiases grey; legend order is
   ggplot's, not the browser's.

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
