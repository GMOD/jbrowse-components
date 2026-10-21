import { displayPainted } from '@jbrowse/browser-test-utils'

import { lgvSession } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The density gate counts bytes before the gene filter applies, so the
// filtered gene lane still needs `forceLoad`
const locusPanel = (
  chrom: string,
  gene: string,
  callout: string,
): ScreenshotSpec => ({
  mode: 'url',
  name: `qtl/bxd_${gene.toLowerCase()}_locus`,
  url: lgvSession('test_data/config_bxd.json', {
    assembly: 'mm10',
    loc: chrom,
    tracks: [
      {
        trackId: 'mm10_ncbi_refseq',
        filter: {
          expressions: [`jexl:get(feature,'name')=='${gene}'`],
          genes: 'only',
        },
        forceLoad: true,
        height: 50,
      },
      {
        trackId: 'bxd_gwas_coatcolor_mm10',
        height: 160,
      },
      {
        trackId: 'bxd_chromosome_painting_mm10',
        height: 520,
        forceLoad: true,
      },
    ],
  }),
  readySelector: displayPainted('mark-display'),
  readyTimeout: 90000,
  viewportHeight: 1020,
  annotations: [
    {
      type: 'text',
      anchor: { text: gene, alignX: 'right', dx: 12 },
      maxWidth: 360,
      fontSize: 15,
      text: callout,
    },
  ],
})

export const qtlSpecs: ScreenshotSpec[] = [
  locusPanel('chr4', 'Tyrp1', 'Tyrp1, the brown locus'),
  locusPanel('chr9', 'Myo5a', 'Myo5a, the dilute locus'),
]
