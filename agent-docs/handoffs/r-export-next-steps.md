---
name: r-export-next-steps
description: "The R script export (view menu → Export R script, plugins/linear-genome-view/src/LinearGenomeView/rExport/) is a doorway to ggjbrowse: reader calls plus one jbrowse_stack(). On main. Open: an r-universe build, first R users, and how tall a deep pileup exports."
---

# R export: what is left

The export writes a short script of ggjbrowse reader calls
and one `jbrowse_stack()`; [R_EXPORT.md](../reference/R_EXPORT.md) has where
the code is, what it reads and the settled decisions, and
`website/docs/user_guides/r_export.md` is the user-facing page. ggjbrowse is
the product and the export a doorway to it (Colin, 2026-10-11); in-browser R is
not wanted.

## Next, in order

1. **ggjbrowse is released** as v0.10.0 and v0.11.0 (GitHub releases, not
   CRAN). 0.11.0 bundles the engine at d5a0299d00, with both CRAM fixes, and
   has the "Get started" vignette.
2. **An r-universe build**, so V8 installs as a binary and the vignette ships
   built (`install_github` skips vignettes). gmod.r-universe.dev exists but
   lists only JBrowseR, picked up from CRAN. Adding ggjbrowse needs a
   `GMOD/gmod.r-universe.dev` registry repo with a `packages.json` and the
   r-universe GitHub app on the GMOD org: Colin's step.
3. **Two or three R users** with their own tracks.
4. **How tall a deep pileup exports: Colin's call.** The live export below
   drew HG002's 300x BAM as every read's row, 9,474 px of a 63-inch figure,
   where the browser's alignments display keeps its height and scrolls. The
   figure could stop at the rows the view shows (the exporter writes the
   display's height and ggjbrowse crops the pileup to it, new API), or keep
   every read and leave compact rows to the user.

## Live export of a real session (2026-10-30)

The hosted main build (5.0.0-beta.18) on the hg38 hub at CCR5, with GENCODE,
ClinVar, dbSNP, phyloP, phastCons, ENCODE DNase (70 bigWigs), gnomAD coverage,
HG002's GRCh38 300x BAM and two 1000 Genomes CRAMs: the view menu's item wrote
the script, and `Rscript` on the download drew all ten tracks in 95 s with no
warning, matching the browser's tracks. The script's `locus` starts a base
before the location box's, since the exporter keeps a base partly in view.
The probe drove the menu item through `view.menuItems()` with puppeteer
against `https://jbrowse.org/code/jb2/main/` and caught the download with
CDP's `Browser.setDownloadBehavior`; no local build needed.

## Real data, read from R (2026-10-30)

- GIAB HG002's 300x BAM over 5 kb at chr7:117.2 Mb: 11,296 reads in 5 s.
- 1000 Genomes CRAMs over CCR5 against UCSC's `hg38.2bit`: about 1 s each.
  GENCODE v47, phyloP and seven CRAMs stacked in one `jbrowse_stack()` in
  25 s. The GENCODE band's tall empty gap is ENSG00000223552, a lncRNA gene
  spanning 46.36-46.41 Mb whose transcripts outside the window keep their
  layout rows, as the engine lays the glyph.
- jbrowse.org's `hg38.prefix.fa.gz` names its contigs `1`, `10`, ..., with no
  `chr`, so a CRAM spelling `chr3` read against it with no alias table decodes
  every substitution as `N`, and only the sequence band warns. A second read
  in the same session with `jbrowse_assembly(fasta, aliases)` returned the
  same `N`s from CramAdapter's record cache; fixed in e2cf9b5d19, and the
  read now warns when the sequence names no contig of the CRAM's region
  (4ee57bcfa7).

## Export side

- The menu label reads "Export R script"; "(beta)" is Colin's call.

Small ggjbrowse defects:
[ideas/waiting-on-someone-else/ggjbrowse-rough-edges.md](../ideas/waiting-on-someone-else/ggjbrowse-rough-edges.md).
