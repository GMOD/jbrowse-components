import { displayPainted } from '@jbrowse/browser-test-utils'

import { lgvSession } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// demos/circrna/config.json is the source of the hosted config.
const CIRCRNA_CONFIG = 'https://jbrowse.org/demos/circrna/config.json'

const READS = 'hela_rnaser_reads'

// A duplication-type split junction takes its read arc twin's color, the RL
// pair teal (`colorPairRL` in packages/core/src/ui/palette.ts).
const DUPLICATION_TYPE_TEAL = '#0099bb'

export const circrnaSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'circrna/zkscan1_backsplice',
    url: lgvSession(CIRCRNA_CONFIG, {
      assembly: 'hg38',
      loc: 'chr7:100,021,500..100,026,000',
      tracks: [
        'ncbi_refseq_genes',
        'hela_rnaser_backsplice',
        { trackId: READS, height: 320 },
      ],
    }),
    readySelector: displayPainted('pileup-display'),
    viewportHeight: 900,
    annotations: [
      {
        type: 'legend',
        fontSize: 18,
        entries: [
          {
            label: 'Back-splice (duplication-type split)',
            color: DUPLICATION_TYPE_TEAL,
          },
        ],
        anchor: { trackId: READS, loc: 'chr7:100,024,750', fracY: 0.1 },
      },
    ],
  },
]
