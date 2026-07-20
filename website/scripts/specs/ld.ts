import { encodeSessionSpec } from '@jbrowse/browser-test-utils'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The LD heatmap display's home-run result: the 17q21.31 MAPT inversion, a
// common ~900 kb polymorphic inversion in humans. Because the inverted (H2) and
// standard (H1) arrangements can't recombine in heterozygotes, the whole segment
// is inherited as one unit, so SNPs across it are in strong long-range LD — a
// solid triangle of high r². Computed live from phased 1000 Genomes genotypes
// (exact haplotypic r², not the composite estimate), so no precomputed LD file
// is needed. hg19 (the phase3 20130502 release coordinates).
//
// Data is a region slice of the phase3 1000 Genomes VCF (all 2504 samples,
// chr17:43.4–44.6 Mb) re-hosted on jbrowse.org S3 so the figure and its live
// "Open in JBrowse" link load fast and don't depend on the EBI FTP being up.
// The VCF names the contig "17"; the hosted UCSC hg19 hub's chromAlias
// reconciles "chr17" at query time.
const HG19_HUB = `?config=${encodeURIComponent('https://jbrowse.org/ucsc/hg19/config.json')}`

const KGP_CHR17 = 'https://jbrowse.org/demos/popgen/mapt_1kg_chr17.vcf.gz'

const LD_TRACK = {
  type: 'VariantTrack',
  trackId: 'kgp_chr17_ld',
  name: '17q21.31 LD (r²)',
  assemblyNames: ['hg19'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: KGP_CHR17,
    // 2504 samples make the region byte-heavy; raise the adapter's fetch gate
    // (default 5 Mb) so panning/zooming within the slice loads rather than
    // tripping "region too large".
    fetchSizeLimit: 500_000_000,
  },
  displays: [
    {
      type: 'LDDisplay',
      showLDTriangle: true,
      showLegend: true,
      // A proxy recombination track (1 - r² between adjacent SNPs) drawn above
      // the triangle, so the "white gaps are recombination boundaries" story is
      // shown, not just asserted: the spikes line up with the gaps.
      showRecombination: true,
      // Thin the dense 1000G SNPs to the common (haplotype-tagging) ones: cleans
      // the speckle from noisy rare-allele r² estimates, keeps the block-forming
      // markers, and keeps the O(N²) compute fast.
      minorAlleleFrequencyFilter: 0.35,
      height: 460,
    },
  ],
}

const KGP_CHR2 = 'https://jbrowse.org/demos/popgen/lct_1kg_chr2.vcf.gz'

// LCT / MCM6 lactase-persistence locus. Recent positive selection swept a long
// haplotype to high frequency, so a large block of SNPs around LCT is inherited
// together — a long stretch of high r². A relatable "why do the SNPs travel
// together" story. Phased 1000G slice (chr2:135.8–137.4 Mb), exact r², hg19.
const LCT_TRACK = {
  type: 'VariantTrack',
  trackId: 'kgp_lct_ld',
  name: 'LCT lactase-persistence LD (r²)',
  assemblyNames: ['hg19'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: KGP_CHR2,
    fetchSizeLimit: 500_000_000,
  },
  displays: [
    {
      type: 'LDDisplay',
      showLDTriangle: true,
      showLegend: true,
      minorAlleleFrequencyFilter: 0.35,
      height: 460,
    },
  ],
}

// The haplotypes behind the LCT LD block, shown directly: the SAME phased 1000G
// slice as the LD triangle, but as a multi-sample variant MATRIX with genotype
// clustering on. Each column is a variant, each row one of the 2504 samples,
// reordered by genotype similarity so co-inherited haplotypes group into
// contiguous bands. The swept lactase-persistence haplotype reads as a large
// block of samples sharing the same alleles — the concrete "why the SNPs travel
// together" companion to the abstract r² triangle. runClustering runs the real
// clustering RPC declaratively (readySelector waits on the dendrogram, so the
// figure is correct however long clustering the callset takes); the window is
// kept to the ~200 kb core block so the variant count stays tractable.
const LCT_MATRIX_TRACK = {
  type: 'VariantTrack',
  trackId: 'kgp_lct_matrix',
  name: 'LCT haplotypes (1000 Genomes, clustered)',
  assemblyNames: ['hg19'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: KGP_CHR2,
    fetchSizeLimit: 500_000_000,
  },
  displays: [
    {
      type: 'LinearMultiSampleVariantMatrixDisplay',
      minorAlleleFrequencyFilter: 0.35,
      height: 500,
    },
  ],
}

export const ldSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'ld/lct_haplotype_matrix',
    // The two halves of the same story stacked over one 800 kb window (reviewer:
    // "combine with an LD diagram"): the abstract r² triangle on top and the
    // concrete phased haplotypes below, so the reader sees the block AND the
    // samples that carry it in one frame. Same slice, same MAF filter. The
    // banded LCT/MCM6 locus lines up down all three tracks.
    url: `${HG19_HUB}&session=${encodeSessionSpec({
      sessionTracks: [LCT_TRACK, LCT_MATRIX_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          // wide enough that the swept block reads as a bounded red triangle
          // against lower-LD flanks (a solid fill with no edge doesn't say
          // "block") — same window as the standalone LD figure
          loc: 'chr2:136,200,000-137,000,000',
          highlight: [
            {
              refName: 'chr2',
              start: 136_545_410,
              end: 136_634_000,
              assemblyName: 'hg19',
            },
          ],
          assembly: 'hg19',
          tracks: [
            {
              trackId: 'hg19-ncbiRefSeqCurated',
              type: 'LinearBasicDisplay',
              height: 60,
              showOnlyGenes: true,
            },
            { trackId: 'kgp_lct_ld', type: 'LDDisplay', height: 320 },
            {
              trackId: 'kgp_lct_matrix',
              type: 'LinearMultiSampleVariantMatrixDisplay',
              runClustering: true,
              height: 380,
            },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    readyText: 'chr2',
    // clustering (the dendrogram) is the slowest step; the LD triangle above
    // paints well before it, so waiting on the dendrogram gates both
    readySelector: '[data-testid="tree_sidebar_dendrogram"]',
    readyTimeout: 180000,
    viewportHeight: 1000,
    settleMs: 5000,
    annotations: [
      {
        type: 'text',
        x: 40,
        y: 250,
        maxWidth: 360,
        fontSize: 15,
        text: 'Top: the r² triangle — a solid red block means every SNP across the LCT/MCM6 locus is inherited together. Bottom: the same 2504 samples as a genotype matrix, rows clustered by similarity — one large band all carry the identical swept haplotype (the block), the rest do not.',
      },
    ],
  },
  {
    mode: 'url',
    name: 'ld/lct_lactase',
    url: `${HG19_HUB}&session=${encodeSessionSpec({
      sessionTracks: [LCT_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          // Wider than the block itself (~800 kb) so the swept haplotype reads
          // as a bounded red block against lower-LD flanks — contrast is what
          // makes it legible as a block rather than a wall of red.
          loc: 'chr2:136,200,000-137,000,000',
          // band the LCT/MCM6 locus so the reader sees the high-r² block sits
          // right over the lactase gene (the enhancer variant rs4988235 is in an
          // MCM6 intron, upstream of LCT)
          highlight: [
            {
              refName: 'chr2',
              start: 136_545_410,
              end: 136_634_000,
              assemblyName: 'hg19',
            },
          ],
          tracks: [
            {
              trackId: 'hg19-ncbiRefSeqCurated',
              type: 'LinearBasicDisplay',
              height: 90,
              showOnlyGenes: true,
            },
            { trackId: 'kgp_lct_ld', type: 'LDDisplay' },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    readyText: 'variants shown',
    readyTimeout: 180000,
    // gene(90) + ld(460) + 2 headers + ruler/overview
    viewportHeight: 700,
    settleMs: 14000,
    annotations: [
      {
        type: 'text',
        // kept left of the banded LCT/MCM6 locus (highlight starts ~x=650) so
        // the callout no longer sits on top of the highlight (reviewer)
        x: 40,
        y: 245,
        maxWidth: 380,
        fontSize: 16,
        text: 'A variant near LCT keeps the milk-digesting enzyme lactase switched on into adulthood. It spread so fast under natural selection that a long block of neighboring SNPs was carried along with it — that block is the solid red triangle, all inherited together (high r²).',
      },
    ],
  },
  {
    mode: 'url',
    name: 'ld/mapt_17q21_inversion',
    url: `${HG19_HUB}&session=${encodeSessionSpec({
      sessionTracks: [LD_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          // widened past the previous 43.7–44.3 Mb window (which sat entirely
          // INSIDE the inversion, so the whole view was one red block and the
          // boundary was invisible): now the ~250 kb left flank outside the
          // inversion is in view, where r² drops off — so the block visibly
          // ENDS at the inversion's edge. Right edge stays within the hosted
          // VCF slice (43.4–44.6 Mb).
          loc: 'chr17:43,470,000-44,590,000',
          // Band the 17q21.31 inversion. Coordinates are the 1000 Genomes
          // freeze-4 SV inversion call (hg38 chr17:45,568,280–46,495,155,
          // "chr17-45568281-INV-926875") liftover'd to hg19 via the MAPT anchor
          // — i.e. a real 1kGP SV-callset boundary, not a hand-drawn guess. The
          // highlighted span is where the LD block lives; MAPT sits inside it.
          highlight: [
            {
              refName: 'chr17',
              start: 43_645_646,
              end: 44_572_521,
              assemblyName: 'hg19',
            },
          ],
          assembly: 'hg19',
          tracks: [
            {
              trackId: 'hg19-ncbiRefSeqCurated',
              type: 'LinearBasicDisplay',
              height: 90,
              showOnlyGenes: true,
            },
            { trackId: 'kgp_chr17_ld', type: 'LDDisplay' },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    readyText: 'variants shown',
    readyTimeout: 180000,
    // gene(90) + ld(460) + recombination zone + 2 headers + ruler/overview
    viewportHeight: 790,
    settleMs: 14000,
    annotations: [
      {
        type: 'text',
        x: 40,
        y: 250,
        maxWidth: 400,
        fontSize: 16,
        text: 'The highlighted span is the 17q21.31 inversion (~900 kb, the H1/H2 MAPT haplotypes) — the boundary the 1000 Genomes freeze-4 SV callset calls inverted. The two orientations cannot recombine, so every SNP across it is inherited as one block: the solid high-r² triangle is that non-recombining haplotype. Short-read genotype SV callsets miss this segmental-duplication-flanked inversion, so the LD block is how you actually see it.',
      },
    ],
  },
]
