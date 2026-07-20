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
    url: `${HG19_HUB}&session=${encodeSessionSpec({
      sessionTracks: [LCT_MATRIX_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: 'chr2:136,500,000-136,700,000',
          tracks: [
            {
              trackId: 'hg19-ncbiRefSeqCurated',
              type: 'LinearBasicDisplay',
              height: 90,
              showOnlyGenes: true,
            },
            {
              trackId: 'kgp_lct_matrix',
              type: 'LinearMultiSampleVariantMatrixDisplay',
              runClustering: true,
            },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    readyText: 'chr2',
    readySelector: '[data-testid="tree_sidebar_dendrogram"]',
    readyTimeout: 180000,
    viewportHeight: 660,
    settleMs: 3000,
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
          assembly: 'hg19',
          loc: 'chr17:43,700,000-44,300,000',
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
        x: 320,
        y: 260,
        maxWidth: 440,
        fontSize: 16,
        text: 'The solid triangle of high r² spans MAPT across the 17q21.31 inversion — the inverted segment is inherited as one non-recombining haplotype block.',
      },
    ],
  },
]
