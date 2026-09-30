import { displayPainted } from '@jbrowse/browser-test-utils'

import { lgvSession } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Real GeneNetwork BXD data on mm10: the coat-color scan over the 198-strain
// painting, whose rows test_data/config_bxd.json bands by each strain's coat
// color (`rowGroups` + `facet: 'group'`). The bands come from the phenotype, so
// a column where each band is one solid genotype is a finding, not a sort.
//
// The gene lane is filtered to the one gene: a whole RefSeq track over a
// chromosome is a solid bar, and `forceLoad` is needed because the density gate
// runs on bytes, before the filter.
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
        type: 'LinearBasicDisplay',
        filterSetting: [`jexl:get(feature,'name')=='${gene}'`],
        forceLoad: true,
        showOnlyGenes: true,
        height: 50,
      },
      {
        trackId: 'bxd_gwas_coatcolor_mm10',
        type: 'LinearManhattanDisplay',
        height: 160,
      },
      {
        trackId: 'bxd_chromosome_painting_mm10',
        type: 'LinearMultiRowFeatureDisplay',
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
