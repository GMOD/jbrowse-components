// The grant's synteny row: Drosophila blocks, TP53 across T2T apes and the
// E. coli O-antigen cluster, each 1100x880 so the three sit side by side at one
// text size.
import { displaySettled } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'
import {
  drosophilaBlocksUrl,
  paperDrosophilaSpecs,
} from './paper-drosophila.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

const SIZE = { viewportWidth: 1100, viewportHeight: 880 }

// MG1655 is the reference row. One strain per lab lineage (BL21 for B), since
// the K-12 and B derivatives repeat their parent's cluster.
const ECOLI_LANES = [
  'BL21_DE3',
  'HS',
  'IAI1',
  'SE11',
  '55989',
  'E24377A',
  'Sakai',
  'EDL933',
  'CFT073',
  'UTI89',
  'S88',
  'APEC_O1',
  'UMN026',
  'IAI39',
  'ED1a',
  'SMS-3-5',
  'Sflexneri_301',
  'Sdysenteriae_Sd197',
  'Sboydii_Sb227',
  'Ssonnei_53G',
]

export const grantSyntenySpecs: ScreenshotSpec[] = [
  {
    ...paperDrosophilaSpecs[0]!,
    name: 'grant/drosophila_blocks',
    url: drosophilaBlocksUrl(150),
    ...SIZE,
  },
  {
    mode: 'url',
    name: 'grant/tp53_cactus',
    url: sessionSpec('https://jbrowse.org/demos/t2t_apes_cactus/config.json', {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr17:7,400,000-7,700,000',
          tracks: [
            {
              trackId: 't2t_apes_cactus',
              height: 640,
              ribbons: { encoding: { color: 'strand' } },
              labels: { lanes: { placement: 'overlay' } },
            },
          ],
        },
      ],
    }),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    ...SIZE,
    hideSelectors: ['[data-testid="floating-legend"]'],
  },
  {
    mode: 'url',
    name: 'grant/ecoli_oantigen',
    url: sessionSpec('https://jbrowse.org/demos/ecoli_orthologs/config.json', {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'MG1655',
          loc: 'NC_000913.3:2,095,000-2,115,000',
          tracks: [
            {
              trackId: 'ecoli_orthologs',
              height: 640,
              rows: { kept: ECOLI_LANES },
              labels: { lanes: { placement: 'overlay' } },
            },
          ],
        },
      ],
    }),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    ...SIZE,
  },
]
