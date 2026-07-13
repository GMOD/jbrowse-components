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

**Aspect ratio (resolved: `heightWeight` only).** Every panel is wide-and-short;
`heightWeight` is the only size lever and it only scales height. Both shipped 2-D
displays live with that rather than adding a `coord_fixed`/aspect hint to
`RTrackFragment`: the variant matrix leans on a tall `heightWeight`, and Hi-C
ships as the **rotated triangle** (below) whose y-axis is interaction distance,
not a second genomic axis — so it deliberately does *not* want `coord_fixed`; it
shares the genomic x with the other tracks and fills whatever height
`heightWeight` allots. `coord_fixed` (the original square Hi-C plan) was dropped
for exactly this reason. No `RTrackFragment` schema change was needed.

## Hi-C — `LinearHicDisplay` / `HicAdapter` — SHIPPED

Done (`plugins/hic/src/LinearHicDisplay/exportRCode.ts` +
`exportR{Code,Run}.test.ts`, `hic_triangle` helper in `exportR.ts`). Now built as
the **rotated 45° triangle** (superseding the original square `geom_raster`): the
`hic_triangle` helper maps each bin-bin contact's square to a diamond at genomic
midpoint `(x+y)/2` (x) and interaction distance `(y-x)/2` (y), drawn with
`geom_polygon` over a genomic x-axis with `coord_cartesian(xlim = c(start, end))`
— so the map shares its x-range with the other stacked tracks (e.g. a gene
track), which the old square + `coord_fixed()` could not. Still log
`scale_fill_viridis_c`, `binsize`/`norm` as editable script vars defaulting to
the display's `effectiveResolution` / `activeNormalization`; `heightWeight: 3`
(the y-axis is now interaction distance, not a second genomic axis). The square
map is no longer emitted (the triangle is the idiomatic browser view and the
whole point of stacking with `patchwork` is a shared genomic x). Resolved open
decisions: **rotated triangle** glyph, **editable `binsize` var** (not
auto-pick-only), sizing via `heightWeight` (no `RTrackFragment` schema change,
no `coord_fixed`). `strawr` installed in this env; gallery figures
`website/static/img/rexport/hic.png` (standalone) and `hic_genes.png` (over a
gene track). The notes below are retained as the design record.

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

## Multi-sample variant matrix — `LinearMultiSampleVariantMatrixDisplay` — SHIPPED

Done (`plugins/variants/src/LinearMultiSampleVariantMatrixDisplay/exportRCode.ts`
+ `exportR{Code,Run}.test.ts`; `read_vcf_gt` + `dendro_segments` helpers in
`exportR.ts`; gallery `website/static/img/rexport/variant_matrix.png`). Resolved
open decisions: **zero-dep `read_vcf_gt`** (extends the `scanTabix` path — reads
sample names from the `#CHROM` header, locates GT within FORMAT, no
VariantAnnotation); **even site-index columns** (`x = factor(site)`, matching
JBrowse's matrix, not genomic POS — so this panel does NOT share the
`coord_cartesian(xlim=)` contract); **hclust order + hand-rolled dendrogram**
(left `patchwork` panel via `dendro_segments()`, no `ggdendro` dep). Cells are
classed ref/het/hom/other/nocall by dosage of the site's most-frequent ALT
(`scale_fill_manual`, an idiomatic discrete approximation of JBrowse's
alpha-blended dosage — not pixel-perfect, by design). MAF (`minMaf`) and
missingness (`maxMissing`) floors default to the display's config slots and are
emitted as editable script vars. Verified through `Rscript` on the 1094-sample
`volvox.test.vcf.gz` (FORMAT `GT:AP`) and the 50-sample haploid
`volvox.variants.vcf.gz`. The notes below are retained as the design record.

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

## Phased HP split — both multi-sample variant displays — SHIPPED

Done. `read_vcf_gt` grew a `phased = FALSE` parameter (default keeps the
collapsed one-row-per-sample path unchanged). When `phased = TRUE` it expands
each sample into one column per haplotype (`"<sample> HP<n>"`, `n` = the sample's
ploidy = max allele count seen in the region, defaulting to diploid) and classes
each *single* allele `ref` / `alt` (the site's most-frequent ALT) / `other` (a
secondary ALT) / `nocall` — mirroring `getPhasedColor` (`shared/getPhasedColor.ts`),
which colors the mfa allele `set1[0]` (`#377eb8`) and secondary alts `set1[1]`
(`#e41a1c`). Both `variant{Row,Matrix}Fragment` take a `phased: boolean` that
switches the `read_vcf_gt(..., TRUE)` arg and the factor levels + `scale_fill_manual`
palette; the builders read `self.renderingMode === 'phased'` in `exportRCode`.
The matrix still clusters on the (now per-haplotype 0/1) `dose` matrix, so it
gets a haplotype dendrogram for free. Verified through `Rscript` on the diploid
1094-sample `volvox.test.vcf.gz` (2188 haplotype rows) in both
`exportRRun.test.ts` files.

The one gotcha: the classing is intentionally single-allele (`ref`/`alt`/
`other`), *not* the collapsed `het`/`hom` dosage — a haplotype is one chromosome,
so het/hom don't apply. The palette drops the het/hom shades accordingly.

## Open decisions

Hi-C, the variant matrix, the regular per-sample display, and the phased HP
split are all shipped; their decisions are resolved (see the SHIPPED notes
above). The regular `LinearMultiSampleVariantDisplay` reuses `read_vcf_gt`
(extended to also return each site's genomic `start`/`end`) + the ref/het/hom
classing, drawing one `geom_rect` row per sample at honest genomic POS (keeps the
shared `coord_cartesian(xlim=)` contract, so it aligns with 1-D tracks), samples
in VCF order (no dendrogram). Gallery figure `variant_rows_genes.png`. Remaining
for a future pass:

- **Cell fidelity:** the matrix uses a 5-level discrete `scale_fill_manual`; a
  continuous dosage gradient or `scale_fill_identity` mirroring
  `getColorAlleleCount`'s exact alpha blend is possible if closer parity is
  wanted (currently not pixel-perfect, by design). Phased mode likewise flattens
  the phase-set (`PS`) hue coloring `getPhasedColor` does when a `PS` subfield is
  present — every alt haplotype gets the flat mfa/secondary color, not a
  per-phase-set hue.

Relates to `R_EXPORT.md`, the variants `plugins/variants/src/CLAUDE.md`
(matrix-mode / clustering / filters), and the memory
`[[project-r-export-native-vision]]`.
