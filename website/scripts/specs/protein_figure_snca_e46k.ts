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
    hideTooltip: true,
    viewportWidth: 1600,
    viewportHeight: 1250,
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
      {
        type: 'text',
        text: 'E46K breaks the Glu46–Lys80 salt bridge; the fold rearranges. JBrowse links codon to residue',
        fontSize: 22,
        maxWidth: 1200,
        color: 'transparent',
        anchor: {
          selector: '[data-testid="view-container-lgv-SNCA"]',
          alignX: 'left',
          alignY: 'top',
        },
        dx: 300,
        dy: 30,
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
        text: "E46K (c.136G>A): familial Parkinson's mutation, pathogenic in ClinVar",
        fontSize: 22,
        maxWidth: 520,
        leader: true,
        anchor: {
          trackId: 'snca-clinvar-e46k',
          loc: 'chr4:89828170',
          fracY: 0.3,
        },
        dx: 200,
        dy: 0,
      },
      {
        type: 'text',
        text: 'Glu46 (−) pairs with Lys80 (+)',
        fontSize: 22,
        maxWidth: 250,
        textAlign: 'end',
        anchor: {
          selector: '[data-testid="view-container-protein-SNCA-6cu7"]',
          alignX: 'right',
          alignY: 'top',
        },
        dx: -40,
        dy: 140,
      },
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
      {
        type: 'text',
        text: 'Lys46 (+) no longer pairs with Lys80',
        fontSize: 22,
        maxWidth: 280,
        leader: true,
        anchor: { residue: 'A:46', view: 2 },
        dx: 90,
        dy: 110,
      },
    ],
  },
]
