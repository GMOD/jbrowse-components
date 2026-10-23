import { displayPainted } from '@jbrowse/browser-test-utils'

import { lgvSession } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

export const gwasSpecs: ScreenshotSpec[] = [
  // one whole contig renders headless; genome-wide showAllRegions does not
  {
    mode: 'url',
    name: 'gwas/manhattan',
    url: lgvSession('test_data/config_gwas.json', {
      assembly: 'hg19',
      loc: '2',
      tracks: [
        {
          trackId: 'gwas_track',
          height: 250,
        },
      ],
    }),
    readySelector: displayPainted('mark-display'),
    readyTimeout: 90000,
    viewportHeight: 470,
  },

  // SLE.ld is keyed to rs4274624, the top hit the index SNP auto-picks here
  {
    mode: 'url',
    name: 'gwas/locuszoom_ld',
    url: lgvSession('test_data/config_gwas.json', {
      assembly: 'hg19',
      loc: '2:191,790,000-192,120,000',
      trackLabels: 'offset',
      tracks: [
        {
          trackId: 'sle_gwas_ld',
          height: 200,
        },
        {
          trackId: 'ncbi_gff_hg19',
          height: 90,
          filter: ['geneLike'],
        },
      ],
    }),
    readySelector: displayPainted('mark-display'),
    readyTimeout: 60000,
    viewportHeight: 542,
  },
]
