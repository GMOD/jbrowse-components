import { deflateSync } from 'node:zlib'

import { UCSC_HG38_CONFIG } from '../screenshot-spec-helpers.ts'
import { PARK_CURSOR } from '../screenshot-spec-types.ts'
import { readSession } from './protein_variants.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

function sncaSession() {
  const session = readSession('snca_e46k.session.json')
  return `?config=${UCSC_HG38_CONFIG}&session=encoded-${deflateSync(
    JSON.stringify(session),
  ).toString('base64url')}`
}

export const proteinSncaE46kSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'protein/snca_e46k',
    url: sncaSession(),
    readySelector:
      'body:has([data-testid="view-container-protein-SNCA-6cu7"] [data-testid="protein-view-ready"]):has([data-testid="view-container-protein-SNCA-6ufr"] [data-testid="protein-view-ready"])',
    readyTimeout: 300000,
    hideSelectors: [
      '.msp-viewport-controls',
      '.msp-viewport-top-left-controls',
      '.msp-background-tasks',
      '.msp-highlight-info',
      '[data-testid="header-alignment-quality"]',
    ],
    tooltip: 'hide',
    viewportWidth: 1600,
    viewportHeight: 1200,
    actions: [
      { type: 'waitForAppSettled' },
      PARK_CURSOR,
      { type: 'delay', ms: 800 },
    ],
    annotations: [
      {
        type: 'text',
        text: 'WILD TYPE',
        fontSize: 34,
        maxWidth: 700,
        anchor: {
          selector:
            '[data-testid="view-container-protein-SNCA-6cu7"] [data-testid="protein-view-molstar"]',
          alignX: 'left',
          alignY: 'top',
        },
        dx: 16,
        dy: 52,
      },
      {
        type: 'text',
        text: 'MUTANT: E46K',
        fontSize: 34,
        maxWidth: 700,
        anchor: {
          selector:
            '[data-testid="view-container-protein-SNCA-6ufr"] [data-testid="protein-view-molstar"]',
          alignX: 'left',
          alignY: 'top',
        },
        dx: 16,
        dy: 52,
      },
      ...(
        [
          ['A', 'lgv-SNCA'],
          ['B', 'protein-SNCA-6cu7'],
          ['C', 'protein-SNCA-6ufr'],
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
        text: '5.8 kb not shown',
        fontSize: 16,
        maxWidth: 600,
        color: '#777777',
        anchor: { trackId: 'snca-residues', loc: 'chr4:89828159', fracY: 0.45 },
        dx: -68,
        dy: 0,
      },
    ],
  },
]
