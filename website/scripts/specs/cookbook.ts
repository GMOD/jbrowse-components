import {
  DEMO_CONFIG,
  lgvSession,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Three PUR (Puerto Rican, 1000 Genomes) copy-number BigWigs from the Kidd lab
// wired into a single MultiQuantitativeTrack as a session track (session tracks
// don't inherit the config's baseUri, so absolute urls are used). This mirrors
// the docs "Multiple signals on one track, each its own color" recipe exactly:
// three named subadapters, each given the recipe's own #f00/#f60/#fa0 color.
// Drawn over the AMY1 amylase cluster, the textbook human copy-number-variable
// locus, so the three individuals' CN traces differ visibly.
const PUR_CNV = 'https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR'
const COOKBOOK_MULTIWIG_TRACK = {
  type: 'MultiQuantitativeTrack',
  trackId: 'cookbook_multiwig',
  name: 'PUR copy number (3 samples)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'MultiWiggleAdapter',
    subadapters: [
      {
        type: 'BigWigAdapter',
        name: 'HG00551',
        color: '#f00',
        bigWigLocation: {
          uri: `${PUR_CNV}/HG00551.qm2.CN.1k.bw`,
          locationType: 'UriLocation',
        },
      },
      {
        type: 'BigWigAdapter',
        name: 'HG00553',
        color: '#f60',
        bigWigLocation: {
          uri: `${PUR_CNV}/HG00553.qm2.CN.1k.bw`,
          locationType: 'UriLocation',
        },
      },
      {
        type: 'BigWigAdapter',
        name: 'HG00554',
        color: '#fa0',
        bigWigLocation: {
          uri: `${PUR_CNV}/HG00554.qm2.CN.1k.bw`,
          locationType: 'UriLocation',
        },
      },
    ],
  },
}

// Figures that back the copy-paste recipes in docs/cookbook.md. Each spec
// applies the exact recipe config to a demo track via inline per-track display
// options (the session-spec equivalent of the recipe's displayDefaults), so if a
// recipe's syntax ever goes stale the rendered figure changes and surfaces it —
// and every figure links to a live instance running that recipe.
export const cookbookSpecs: ScreenshotSpec[] = [
  // "Color by strand" recipe: NCBI RefSeq genes on hg38 (reviewer: use hg38 +
  // ncbi gff) tinted blue on the + strand and red on the - strand via the jexl
  // color slot the recipe teaches. The chr17p13 window spans several genes on
  // both strands (TP53−, WRAP53+, ATP1B2, EFNB3, …) so both colors show.
  {
    mode: 'url',
    name: 'cookbook_color_by_strand',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr17:7,400,000-7,700,000',
      tracks: [
        {
          trackId: 'ncbi_refseq_109_hg38',
          height: 260,
          color: "jexl:feature.strand==1?'#1f77b4':'#d62728'",
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 60000,
    settleMs: 6000,
    viewportHeight: 460,
  },

  // "Color by feature type (lookup table)" recipe: the same NCBI RefSeq hg38
  // track, colored by the exact jexl lookup the recipe teaches (CDS red, exon
  // green, gene blue, everything else gray). Within each gene the coding
  // segments (CDS) read red against green exon/UTR, so the lookup-table
  // technique is visible per feature. Same window as color-by-strand so the two
  // figures read as the same track under two different color rules.
  {
    mode: 'url',
    name: 'cookbook_color_by_type',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr17:7,400,000-7,700,000',
      tracks: [
        {
          trackId: 'ncbi_refseq_109_hg38',
          height: 260,
          color:
            "jexl:{CDS:'#d62728',exon:'#2ca02c',gene:'#1f77b4'}[feature.type] || 'gray'",
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 60000,
    settleMs: 6000,
    viewportHeight: 460,
  },

  // "Multiple signals on one track, each its own color" recipe: the three-sample
  // colored MultiQuantitativeTrack above, over the AMY1 amylase copy-number
  // locus, with the NCBI RefSeq genes for context. Rendered multirowxy (one
  // stacked row per signal) so each individual's copy-number trace reads in its
  // own color.
  {
    mode: 'url',
    name: 'cookbook_multiwig',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [COOKBOOK_MULTIWIG_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr1:103,540,000-103,770,000',
          tracks: [
            { trackId: 'ncbi_refseq_109_hg38', height: 70 },
            {
              trackId: 'cookbook_multiwig',
              height: 240,
              defaultRendering: 'multirowxy',
            },
          ],
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 60000,
    settleMs: 8000,
    viewportHeight: 600,
  },
]
