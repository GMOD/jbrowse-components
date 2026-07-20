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
//
// Rows are colored by 1000 Genomes superpopulation, which is what makes the
// SELECTION visible rather than just the haplotype: the swept block is
// overwhelmingly EUR while AFR/EAS samples sit outside it. A haplotype that
// long, that common, and that population-restricted is the signature of recent
// positive selection — drift alone doesn't build it. Metadata is the release's
// own panel file (sample / pop / super_pop / gender, tab-separated, so it drops
// straight into samplesTsvLocation), served CORS-open from the EBI mirror.
const KGP_PANEL =
  'https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/release/20130502/integrated_call_samples_v3.20130502.ALL.panel'

const LCT_MATRIX_TRACK = {
  type: 'VariantTrack',
  trackId: 'kgp_lct_matrix',
  name: 'LCT haplotypes (1000 Genomes, clustered by genotype, colored by population)',
  assemblyNames: ['hg19'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: KGP_CHR2,
    fetchSizeLimit: 500_000_000,
    samplesTsvLocation: { uri: KGP_PANEL, locationType: 'UriLocation' },
  },
  displays: [
    {
      type: 'LinearMultiSampleVariantMatrixDisplay',
      minorAlleleFrequencyFilter: 0.35,
      colorBy: 'super_pop',
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
            // The causal variant, from an independent source: ClinVar's
            // LACTASE PERSISTENCE records sit at chr2:136,608,642–136,608,745
            // — rs4988235, the -13910 C>T enhancer variant in MCM6 intron 13
            // that keeps LCT transcribed into adulthood. ClinVar has ~79
            // records in this window, nearly all unrelated VUS, so filter to
            // the lactase phenotype: one labeled variant anchoring the block
            // instead of a wall of clinical noise.
            {
              trackId: 'hg19-clinvarMain',
              type: 'LinearBasicDisplay',
              height: 70,
              jexlFiltersSetting: [
                "jexl:get(feature,'phenotypeList')=='LACTASE PERSISTENCE'",
              ],
            },
            { trackId: 'kgp_lct_ld', type: 'LDDisplay', height: 300 },
            {
              trackId: 'kgp_lct_matrix',
              type: 'LinearMultiSampleVariantMatrixDisplay',
              runClustering: true,
              // wider than the 80px default so the population color strip
              // beside the dendrogram is actually readable — that strip is
              // what shows the swept band is EUR/SAS, i.e. the selection
              treeAreaWidth: 150,
              height: 400,
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
    viewportHeight: 1180,
    settleMs: 5000,
    annotations: [
      {
        type: 'text',
        x: 40,
        y: 250,
        maxWidth: 290,
        fontSize: 15,
        text: 'One swept haplotype: rs4988235 → LD block → its carriers',
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
]
