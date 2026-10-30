import { deflateSync } from 'node:zlib'

import { UCSC_HG38_CONFIG } from '../screenshot-spec-helpers.ts'
import { PARK_CURSOR } from '../screenshot-spec-types.ts'
import { readSession } from './protein_variants.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

function metEx14Session() {
  const session = readSession('met_ex14.session.json')
  return `?config=${UCSC_HG38_CONFIG}&session=encoded-${deflateSync(
    JSON.stringify(session),
  ).toString('base64url')}`
}

// The state the MET exon 14 tutorial's clicks reach from the Protein Browser's
// gene=MET&structure=3bux link: CCLE reads from demos/metex14 (NCI-H596, no
// reference reads at c.3028+1, and EBC-1 for comparison), exon 14 highlighted,
// a copy of the view at the splice donor sorted on its base, and 3BUX as its
// assembly 5, CBL's TKB domain holding MET's pY1003 peptide.
const PROTEIN = 'protein-MET-3bux'

export const proteinMetEx14Specs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'protein/met_ex14',
    url: metEx14Session(),
    readySelector: `body:has([data-testid="view-container-${PROTEIN}"] [data-testid="protein-view-ready"])`,
    readyTimeout: 300000,
    hideSelectors: [
      '.msp-viewport-controls',
      '.msp-viewport-top-left-controls',
      '.msp-background-tasks',
      '.msp-highlight-info',
    ],
    tooltip: 'hide',
    viewportWidth: 1600,
    viewportHeight: 1125,
    actions: [
      { type: 'waitForAppSettled' },
      PARK_CURSOR,
      { type: 'delay', ms: 800 },
    ],
    annotations: [
      ...(
        [
          ['A', 'lgv-MET'],
          ['B', 'lgv-MET-donor'],
          ['C', PROTEIN],
        ] as const
      ).map(([text, id]) => ({
        type: 'circle' as const,
        text,
        radius: 16,
        anchor: {
          selector: `[data-testid="view-container-${id}"]`,
          alignX: 'left' as const,
          alignY: 'top' as const,
        },
        dx: 18,
        dy: 16,
      })),
      {
        type: 'text',
        text: 'Exon 14 skipped',
        fontSize: 22,
        leader: true,
        anchor: {
          trackId: 'NCI-H596_RNA',
          loc: 'chr7:116771920',
          view: 0,
          fracY: 0.5,
        },
        dx: 150,
        dy: 30,
      },
      {
        type: 'text',
        text: 'G>T in every read',
        fontSize: 22,
        leader: true,
        anchor: {
          trackId: 'NCI-H596_DNA',
          loc: 'chr7:116771990',
          view: 1,
          fracY: 0.3,
        },
        dx: 170,
        dy: 0,
      },
      {
        type: 'text',
        text: 'pY1003',
        fontSize: 22,
        leader: true,
        anchor: { residue: 'A:1003', view: 2 },
        dx: 170,
        dy: -190,
      },
    ],
  },
]
