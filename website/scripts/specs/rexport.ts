import type { RExportSpec } from '../screenshot-spec-types.ts'

// The "Export R script" gallery: for each figure, the SAME session an existing
// browser figure already shows, re-rendered through the real exporter —
// `jb2export --config … --session … --out <tmp>.R`, then Rscript.
//
// Every spec here names another spec (`from`) rather than carrying a dataset of
// its own, so each R figure is the direct counterpart of a JBrowse rendering of
// the identical view. That is the comparison a reader actually wants ("what does
// this track look like in ggplot2?"), and it keeps the R gallery on the datasets
// the docs already explain rather than on a parallel set of examples.
//
// It also removes a class of drift: retargeting a browser figure retargets its R
// twin, and deleting one is a validateSpecs failure rather than a stale render.
// Before this, these 19 figures were hand-made PNGs force-added past
// .gitignore, absent from figures.lock, and reproducible only from prose.
function rexportSpec(
  name: string,
  from: string,
  extra: Partial<RExportSpec> = {},
): RExportSpec {
  return { mode: 'rexport', name: `rexport/${name}`, from, ...extra }
}

// Bioconductor readers, by track type. Named per spec so a machine without the
// full stack skips the figures it cannot draw and says which package is missing,
// instead of failing the sweep.
const BIGWIG = ['rtracklayer']
const BAM = ['Rsamtools', 'GenomicAlignments']
const TABIX = ['Rsamtools']

export const rexportSpecs: RExportSpec[] = [
  // ── Quantitative ────────────────────────────────────────────────────────
  // The multi-wiggle renderer comparison: several BigWigs read into one long
  // data.frame, drawn in whichever mode the display is in.
  rexportSpec('multiwiggle', 'multiwig/multi_renderer_types', {
    rPackages: BIGWIG,
  }),

  // ── Alignments ──────────────────────────────────────────────────────────
  // A coverage histogram over a strand-colored pileup, the default alignments
  // view. Deliberately a BAM source rather than one of the CRAM figures: the
  // CRAM path shells out to samtools to decode a temp BAM (Rsamtools is
  // BAM-only) and needs the reference too, which is a lot to ask of a docs
  // regen — jb2export can still do it, and exportRRun covers it.
  rexportSpec('alignments', 'display_type_default_badge', { rPackages: BAM }),

  // Sort by base at a SNP: reads carrying the alternate allele group at the
  // top, which is the whole point of the localized sort.
  //
  // The sort has to be added here. `alignments_sort_by_base` deliberately
  // STARTS unsorted — its two frames are the right-click and its effect — and
  // an rexport spec re-exports the source's session, not the state its UI
  // actions reach, so the R twin came out an ordinary unsorted pileup. Written
  // as the display state the click produces rather than as `sort:base`, which
  // anchors on the view centre (14,485 here): the SNP is at ctgA:14,481, the
  // column the browser figure right-clicks, and sorting three bases off it
  // would look exactly as unsorted as sorting nothing.
  rexportSpec('alignments_sort', 'alignments_sort_by_base', {
    rPackages: BAM,
    extraArgs: [
      '--track',
      'volvox_bam',
      // pos is 0-based genomic, as the context menu's own `genomicPos` is
      '{"sortedBy":{"type":"basePair","pos":14480,"refName":"ctgA","assemblyName":"volvox"}}',
    ],
  }),

  // Long reads across an insertion: the CIGAR walk that draws deletions,
  // skipped introns and insertion ticks over the read body.
  rexportSpec('long_reads', 'read_vs_ref_insertion', { rPackages: BAM }),

  // Base modifications from the MM/ML tags: each read's 5mC calls as per-base
  // ticks, the one thing a modBAM figure is for.
  //
  // Sourced from the UNGROUPED half of the Group-by-HP pair rather than the
  // grouped one or the four-track combined figure, because those two claim
  // things this export cannot draw and the R twin would quietly contradict its
  // source: `groupBy` has no R translation (the pileup comes out in one block),
  // and the modkit lanes are MultiQuantitativeTracks over a BedTabix bedMethyl,
  // which the multi-wiggle exporter — BigWig-only — contributes nothing for.
  // The CpG-island lane all three carry is dropped either way: it is a
  // `UCSCAdapter` from a plugin jb2export doesn't bundle, so the run warns and
  // renders the rest (see products/jbrowse-img/src/unsupportedTracks.ts).
  rexportSpec('modifications', 'methylation/hg002_snrpn_ungrouped', {
    rPackages: BAM,
  }),

  // ── Genes ───────────────────────────────────────────────────────────────
  rexportSpec('genes', 'customized_feature_details', { rPackages: BIGWIG }),

  // ── Variants ────────────────────────────────────────────────────────────
  rexportSpec('variants', 'volvox_variants', { rPackages: TABIX }),

  // The multi-sample matrix: site-indexed columns, samples ordered by hclust
  // with a hand-rolled dendrogram composed as a left panel.
  rexportSpec('variant_matrix', 'variants/cluster_dialog', {
    rPackages: TABIX,
  }),

  // ── Hi-C ────────────────────────────────────────────────────────────────
  // strawr rotates the contact matrix into the triangular view on a genomic
  // x-axis, so it stacks under the gene track the source figure shows.
  rexportSpec('hic', 'hic/percentile_on', { rPackages: ['strawr'] }),

  // Two discontiguous regions concatenated on one cumulative-bp axis — the
  // multi-region layout, with the Hi-C panel spanning the divider.
  rexportSpec('multiregion', 'hic/two_regions', { rPackages: ['strawr'] }),

  // ── GWAS ────────────────────────────────────────────────────────────────
  rexportSpec('gwas', 'gwas/manhattan', { rPackages: TABIX }),

  // ── Figures the gallery already curates ─────────────────────────────────
  // Everything below re-exports a reviewed gallery/topic figure, so the R
  // rendering can be compared against a JBrowse one a reader has already seen.

  // Polyprotein cleavage products as nested gene glyphs — the densest feature
  // layout in the set, and a good test of gene_layout's row packing.
  rexportSpec('genes_sarscov2', 'gallery/sarscov2_polyprotein', {
    rPackages: BIGWIG,
  }),

  // The same idea across two loci at once — a multi-region scATAC figure, which
  // is the multi-region layout doing real work rather than demonstrating itself.
  rexportSpec('scatac_multiregion', 'scatac/pbmc5k_marker_swap', {
    rPackages: BIGWIG,
  }),

  // A phased trio genotype matrix: each sample expanded into its two
  // haplotypes, which is the one case the matrix colours per allele.
  rexportSpec('trio_phased', 'trio-matrix-phased-clean', {
    rPackages: [...TABIX, ...BIGWIG],
  }),

  // ── Structural variants ─────────────────────────────────────────────────
  // Soft- and hard-clip indicator bars at a breakpoint: the first signal an SV
  // gives you in a pileup, and the reason bam_clips exists.
  rexportSpec('sv_clipping', 'alignment_clipping_indicators', {
    rPackages: BAM,
  }),

  // Somatic SV calls over the tumour and matched-normal long reads they were
  // called from — the comparison that says a call is real.
  rexportSpec('sv_tumour_normal', 'cancer_sv/multihop_tumour_vs_normal', {
    rPackages: [...TABIX, ...BAM],
  }),

  // A foldback inversion: reads whose two halves point the same way.
  rexportSpec('sv_foldback', 'cancer_sv/foldback_reconstruction', {
    rPackages: [...BAM, ...BIGWIG],
  }),

  // BCR-ABL, the two fusion partners side by side on one cumulative axis —
  // multi-region doing the job it exists for.
  rexportSpec('sv_fusion', 'cancer_sv/k562_bcr_abl_split', {
    rPackages: [...BAM, ...BIGWIG],
  }),

  // 1000 Genomes SVs as a multi-sample genotype panel over the genes they hit.
  rexportSpec('sv_multisample', 'multisv_svtype', {
    rPackages: [...TABIX, ...BIGWIG],
  }),

  // `qc/callsets_at_smn` (three SV callsets at SMN) is deliberately NOT here.
  // It exports correctly now — the BigBed reader and the label-room rule both
  // came out of trying it — but the figure is unusable: DGV alone packs 1009
  // overlapping records into 61 rows across that 2.5 Mb window, and a feature
  // panel gets a fixed height weight however many rows it packs, so all 61 are
  // squeezed into ~2 inches. The browser has a scrollable track and a fit
  // ladder; the R panel would need its height weighted by the row count it
  // discovers at draw time. Worth doing, and then this figure is worth adding.

  // A biallelic CNV: copy number over the SV calls and the genes.
  rexportSpec('sv_cnv', 'cnv1000g/ugt2b17_biallelic', {
    rPackages: [...TABIX, ...BIGWIG],
  }),
]
