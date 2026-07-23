import { encodeSessionSpec } from '@jbrowse/browser-test-utils'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The LD heatmap display's home-run result: the lactase-persistence sweep at
// LCT/MCM6, computed live from phased 1000 Genomes genotypes (exact haplotypic
// r², not the composite estimate), so no precomputed LD file is needed. hg19
// (the phase3 20130502 release coordinates).
//
// A companion MAPT 17q21.31 inversion figure was dropped in 969c44cc21: no
// accessible callset has usable per-sample genotypes for that inversion, so it
// could only have been shown with a proxy. The inversion case is covered in
// prose in the linkage_disequilibrium tutorial, with no figure — don't
// reintroduce one without real genotypes behind it.
//
// Data is a region slice of the phase3 1000 Genomes VCF (all 2504 samples,
// chr2:135.8–137.4 Mb) re-hosted on jbrowse.org S3 so the figure and its live
// "Open in JBrowse" link load fast and don't depend on the EBI FTP being up.
// The VCF names the contig "2"; the hosted UCSC hg19 hub's chromAlias
// reconciles "chr2" at query time.
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

export const ldSpecs: ScreenshotSpec[] = [
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
              height: 60,
              showOnlyGenes: true,
            },
            // The causal variant, from a source independent of the genotypes
            // the r² is computed from: ClinVar's LACTASE PERSISTENCE records at
            // chr2:136,608,642–136,608,745 — rs4988235, the -13910 C>T enhancer
            // variant in an MCM6 intron that keeps LCT transcribed into
            // adulthood. ClinVar has ~79 records in this window, nearly all
            // unrelated VUS, so filter to the lactase phenotype: one labeled
            // variant anchoring the block rather than a wall of clinical noise.
            {
              trackId: 'hg19-clinvarMain',
              type: 'LinearBasicDisplay',
              height: 70,
              jexlFiltersSetting: [
                "jexl:get(feature,'phenotypeList')=='LACTASE PERSISTENCE'",
              ],
            },
            { trackId: 'kgp_lct_ld', type: 'LDDisplay' },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    readyText: 'variants shown',
    readyTimeout: 180000,
    // gene(60) + clinvar(70) + ld(460) + 3 headers + ruler/overview, with room
    // for the triangle to reach its base
    viewportHeight: 900,
    settleMs: 14000,
    annotations: [
      {
        type: 'text',
        // bottom-left, in the triangle's empty long-range corner: clear of the
        // banded LCT/MCM6 locus (highlight starts ~x=650) and, unlike the old
        // y=245, clear of the ClinVar track header it used to cover
        x: 40,
        y: 700,
        maxWidth: 300,
        fontSize: 16,
        text: 'rs4988235 swept — and dragged this whole block with it',
      },
    ],
  },
]
