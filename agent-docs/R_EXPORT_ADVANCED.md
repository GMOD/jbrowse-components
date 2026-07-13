# R export — advanced (2-D / matrix / heatmap) displays

Handoff for extending the R-script export (`agent-docs/R_EXPORT.md`, read that
first) to displays that aren't a single 1-D track: **multi-sample variant
matrix** and **Hi-C contact maps**. The shipped work covers wiggle, multi-wiggle,
alignments, genes, and (basic) variants — each a `geom_*` panel over a genomic
x-axis, stacked with `patchwork`. The displays below add a *second* dimension
(sample, or a second genomic axis), i.e. a heatmap.

## Does the existing `RTrackFragment` model still fit?

Yes. A fragment is just "an R expression that builds a ggplot object, stacked via
patchwork with a `heightWeight`." A heatmap is still one ggplot (`geom_tile` /
`geom_raster`) with `x = genomic position`; it only adds `y = sample` or
`y = genomic bin`. `plotExpr` may itself build a *composed* ggplot (e.g.
`dendrogram + tiles + plot_layout(...)`) because patchwork nests — so a
multi-panel mini-figure is still "one stacked entry." New readers go in the
`HELPERS` table in `exportR.ts`, same as `read_bigwig`/`read_vcf`.

**The one real gap: aspect ratio.** Every shipped panel is wide-and-short;
`heightWeight` is the only size lever and it only scales height. A Hi-C map wants
`coord_fixed()` (square bins) and a many-sample matrix wants to be tall. Decide
early (see open decisions) whether to (a) just lean on `heightWeight`, or
(b) add an optional aspect/`coord_fixed` hint to `RTrackFragment`. Recommend
starting with `heightWeight` only and revisiting if figures look wrong.

## Hi-C — `LinearHicDisplay` / `HicAdapter` (do this one first)

Smaller and cleaner than the variant matrix: a single heatmap, one R dependency,
one test file.

- **Source.** `HicAdapter`, slot `hicLocation.uri` (or the `uri` shorthand) → a
  `.hic` file. The worker (`RenderHicDataRPC`) emits contact records
  `{ bin1, bin2, counts }` at a binsize the display auto-picks from zoom
  (`autoResolutionIdx` + `resolutionBias`), colored by `colorScheme` on a
  linear/log scale (`useLogScale`; default max clamp is `maxScore / 20`).
- **R reader: `strawr`** (CRAN, from the `.hic` authors — the idiomatic reader).
  `strawr::straw(norm, hicfile, chr1loc, chr2loc, unit = "BP", binsize)` returns
  `data.frame(x, y, counts)` where x/y are genomic bin-start coords. Add a
  `read_hic()` helper. Pick binsize like the display does:
  `strawr::readHicBpResolutions(hicfile)` then the largest resolution
  `<= ~2 * bpPerPx` (mirror `autoResolutionIdx`), **or** just emit `binsize` as a
  visible script variable the user edits (more hackable — prefer this).
- **Plot.** `geom_raster(aes(x, y, fill = counts))` +
  `scale_fill_viridis_c(trans = "log1p")` (or `scale_fill_gradient`) is the
  standard square heatmap. straw returns only the upper triangle, so `rbind` the
  x/y-swapped copy to fill the square (the matrix is symmetric). JBrowse draws a
  rotated 45° triangle; that's reproducible (plot `(x+y)/2` vs `(y-x)/2`) but the
  square map is more idiomatic and readable in R — recommend square by default,
  note the triangle as an option. Use `coord_fixed()`.
- **Params to thread:** uri, `binsize` (or bpPerPx to auto-pick), `norm`
  (default `"NONE"` or `"KR"` — expose as a var), colorScheme → gradient
  endpoints, log vs linear.
- **`.cool`/`.mcool`:** no solid R-native cooler reader (would need `rhdf5` +
  manual matrix assembly). Defer — `HicAdapter` only handles `.hic` anyway;
  `.cool` flows through a different adapter.
- **Test data:** local `extra_test_data/test.hic` (~5 MB, hg19 — for the
  `Rscript` run test). Real hg19 figures/gallery: two remote `.hic` tracks are
  already wired in `test_data/config_demo.json` —
  `https://jbrowse.org/genomes/hg19/intra_nofrag_30.hic` and the Rao et al.
  `GSE63525_HMEC_combined.hic`. `strawr` is **not** installed in this env
  (`requireNamespace("strawr")` → FALSE); `install.packages("strawr")` (CRAN) to
  test, and gate the run test on it exactly like wiggle gates on `rtracklayer`.

## Multi-sample variant matrix — `LinearMultiSampleVariantMatrixDisplay`

Samples (rows) × variants (columns), each cell a genotype. Bigger job:
genotypes + optional clustering + MAF/missingness filters. See
`plugins/variants/src/CLAUDE.md` for the shipped model's tiers and the phased
HP-split convention.

- **Source: VCF genotypes.** Two reader options:
  - Extend the shipped `read_vcf` (Rsamtools `scanTabix`) to also split the
    FORMAT + per-sample columns for `GT` — keeps the **zero-dependency** path and
    is consistent with the basic track. **Recommended.**
  - `VariantAnnotation::geno(readVcf(...))$GT` gives a clean (variants × samples)
    GT matrix — this is where VariantAnnotation would finally earn its dependency
    (unlike the basic track, where it didn't). But mind the `readVcf(which=)`
    seqinfo pitfall from `R_EXPORT.md` (pass `genome = Seqinfo(seqnamesTabix(uri))`
    or read whole-file then subset).
- **Genotype → cell value.** Mirror `shared/drawAlleleCount.ts`
  (`getColorAlleleCount`): count alleles equal to the most-frequent ALT →
  dosage 0 (ref/ref, color `REFERENCE_COLOR = '#ccc'`), 1 (het), 2 (hom-alt);
  no-call (`.`) and secondary-alt are special-cased there. For R, a long df
  `variant × sample × dosage` + `geom_tile(aes(x, y = sample, fill = dosage))`
  with a discrete 3-level scale (ref/het/hom) or `scale_fill_gradient` from
  `#ccc` to the alt color. Not pixel-perfect: JBrowse alpha-blends dosage
  (`getAltColorForDosage`) and no-call grey — a gradient approximates it.
- **Column layout.** JBrowse's matrix lays columns by *feature index* (evenly
  spaced, compact), not genomic position, and is zoom-cache-strict (see the
  variants CLAUDE.md "matrix mode" section). Decide: `x = factor(variant index)`
  (even columns, matches JBrowse, the matrix's whole point) vs `x = POS` (honest
  genomic spacing, breaks the shared `coord_cartesian(xlim=)` contract). Lean
  toward even columns for the matrix display, honest POS for the non-matrix
  `LinearMultiSampleVariantDisplay`.
- **Clustering.** JBrowse clusters samples into the tree sidebar. R equivalent:
  `hclust(dist(t(genotype_matrix)))` to order the `sample` factor levels;
  optionally draw the dendrogram as a left-hand patchwork panel built from the
  `hclust` merge with hand-rolled `geom_segment` (avoid a heavy `ggdendro` dep —
  same spirit as the inline `gene_layout`/`pileup_layout` helpers). Compose with
  `plot_layout(widths = c(dendro, matrix))`.
- **Filters.** `minorAlleleFrequencyFilter` / `maxMissingnessFilter` are config
  slots applied worker-side (`calculateMinorAlleleFrequency`). Reproduce as a
  `subset()` on per-variant allele freqs computed in R, emitted as visible
  thresholds the user can edit.
- **Phased HP split.** `expandSourcesToHaplotypes` makes `"<sample> HP0/HP1"`
  rows. Probably defer — default to one collapsed row per sample; split `a|b`
  into two rows only if phased output is wanted.
- **Test data:** `volvox.test.vcf.gz` is a **1094-sample 1000-Genomes
  simulation** (great scale/perf check for the `Rscript` run test);
  `volvox.variants.vcf.gz` (50 samples) and `volvox.sv.vcf.gz` (20) are smaller.
  Real figures: `test_data/config_demo.json` wires the phased 1000G high-coverage
  chr1 panel (`.../20201028_3202_phased/CCDG_14151_B01_..._chr1.filtered.
  shapeit2-duohmm-phased.vcf.gz`) on `LinearMultiSampleVariantDisplay`
  (colorBy population).

## Recipe (same as the shipped track types)

Follows `R_EXPORT.md`'s "Adding a track type" recipe verbatim:
add reader/helper(s) to `HELPERS` in `exportR.ts`; a pure
`hicFragment(params)` / `variantMatrixFragment(params)` builder + `exportRCode(self)`
in the display plugin; wire an `exportRCode(): RTrackFragment` model method with
an **explicit return type** (breaks the MST self-type cycle). Both
`LinearMultiSampleVariant*` models already define `renderSvg` in `model.ts`, so
the wiring spot is obvious. Add `exportRCode.test.ts` (codegen) +
`exportRRun.test.ts` (real `Rscript`, `test.skip` when the R dep is absent).

## Open decisions — confirm with the user before building

- **Build order:** recommend **Hi-C first** (one heatmap, one dep, one test
  file), then the variant matrix.
- **Matrix columns:** even feature-index columns (match JBrowse) vs genomic-POS
  columns (honest spacing)?
- **Sample clustering:** include the hand-rolled dendrogram panel, or ship a
  fixed/`hclust`-ordered matrix first and add the tree later?
- **Hi-C glyph:** square heatmap (recommend) vs JBrowse's rotated triangle?
- **Aspect ratio:** lean on `heightWeight` + `coord_fixed()`, or add an aspect
  hint to `RTrackFragment`?
- **Genotype reader:** extend zero-dep `read_vcf` scanTabix (recommend) vs pull
  in `VariantAnnotation` for `geno()$GT`?

Relates to `R_EXPORT.md`, the variants `plugins/variants/src/CLAUDE.md`
(matrix-mode / clustering / filters), and the memory
`[[project-r-export-native-vision]]`.
