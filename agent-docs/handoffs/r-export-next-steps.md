---
name: r-export-next-steps
description: "The R script export (view menu → Export R script, plugins/linear-genome-view/src/LinearGenomeView/rExport/) is a doorway to ggjbrowse: reader calls plus one jbrowse_stack(). On main. Open: a ggjbrowse release bundling the CRAM fix, its r-universe build, first R users, and a live export of a real session."
---

# R export: what is left

The export writes a short script of ggjbrowse reader calls
and one `jbrowse_stack()`; [R_EXPORT.md](../reference/R_EXPORT.md) has where
the code is, what it reads and the settled decisions, and
`website/docs/user_guides/r_export.md` is the user-facing page. ggjbrowse is
the product and the export a doorway to it (Colin, 2026-10-11); in-browser R is
not wanted.

## Next, in order

1. **A tagged ggjbrowse release.** Its bundle (`inst/js/jbrowse-tables.js`) is
   jbrowse-components dc06068, which predates e2cf9b5d19, the CramAdapter fix
   for a CRAM read again under another assembly (below). Once that commit is
   on GitHub, rebuild the bundle with `scripts/build-js.sh` from a clean
   checkout at it, then bump DESCRIPTION and tag. ggjbrowse's "Get started"
   vignette (`vignettes/ggjbrowse.Rmd`) is on main and passes `R CMD check`.
2. **An r-universe build**, so V8 installs as a binary and the vignette ships
   built (`install_github` skips vignettes). gmod.r-universe.dev exists but
   lists only JBrowseR, picked up from CRAN. Adding ggjbrowse needs a
   `GMOD/gmod.r-universe.dev` registry repo with a `packages.json` and the
   r-universe GitHub app on the GMOD org: Colin's step.
3. **Two or three R users** with their own tracks.
4. **A live export of a real session**: an hg38 view with a deep BAM, a CRAM
   and ten tracks, through the menu item, then `Rscript` on the download.

## Real data, read from R (2026-10-30)

- GIAB HG002's 300x BAM over 5 kb at chr7:117.2 Mb: 11,296 reads in 5 s.
- 1000 Genomes CRAMs over CCR5 against UCSC's `hg38.2bit`: about 1 s each.
  GENCODE v47, phyloP and seven CRAMs stacked in one `jbrowse_stack()` in
  25 s. The GENCODE band left a tall empty gap between its rows; unchecked
  against the browser.
- jbrowse.org's `hg38.prefix.fa.gz` names its contigs `1`, `10`, ..., with no
  `chr`, so a CRAM spelling `chr3` read against it with no alias table decodes
  every substitution as `N`, and only the sequence band warns. A second read
  in the same session with `jbrowse_assembly(fasta, aliases)` returned the
  same `N`s from CramAdapter's record cache; fixed in e2cf9b5d19.

## Export side

- The menu label reads "Export R script"; "(beta)" is Colin's call.

Small ggjbrowse defects:
[ideas/waiting-on-someone-else/ggjbrowse-rough-edges.md](../ideas/waiting-on-someone-else/ggjbrowse-rough-edges.md).
