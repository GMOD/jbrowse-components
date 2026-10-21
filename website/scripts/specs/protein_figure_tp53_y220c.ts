import { deflateSync } from 'node:zlib'

import { UCSC_HG38_CONFIG } from '../screenshot-spec-helpers.ts'
import { PARK_CURSOR } from '../screenshot-spec-types.ts'
import { readSession } from './protein_variants.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

function tp53Session() {
  const session = readSession('tp53_y220c.session.json')
  return `?config=${UCSC_HG38_CONFIG}&session=encoded-${deflateSync(
    JSON.stringify(session),
  ).toString('base64url')}`
}

export const proteinTp53Y220cSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'protein/tp53_y220c',
    url: tp53Session(),
    readySelector:
      'body:has([data-testid="view-container-protein-TP53-2xwr"] [data-testid="protein-view-ready"]):has([data-testid="view-container-protein-TP53-9s9o"] [data-testid="protein-view-ready"])',
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
    viewportHeight: 1300,
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
            '[data-testid="view-container-protein-TP53-2xwr"] [data-testid="protein-view-molstar"]',
          alignX: 'left',
          alignY: 'top',
        },
        dx: 16,
        dy: 52,
      },
      {
        type: 'text',
        text: 'MUTANT: Y220C + drug',
        fontSize: 34,
        maxWidth: 700,
        anchor: {
          selector:
            '[data-testid="view-container-protein-TP53-9s9o"] [data-testid="protein-view-molstar"]',
          alignX: 'left',
          alignY: 'top',
        },
        dx: 16,
        dy: 52,
      },
      {
        type: 'circle',
        text: 'A',
        radius: 16,
        fontSize: 20,
        anchor: {
          selector: '[data-testid="view-container-lgv-TP53"]',
          alignX: 'left',
          alignY: 'top',
          dx: 56,
          dy: 18,
        },
      },
      {
        type: 'circle',
        text: 'B',
        radius: 16,
        fontSize: 20,
        anchor: {
          selector: '[data-testid="view-container-protein-TP53-2xwr"]',
          alignX: 'left',
          alignY: 'top',
          dx: 56,
          dy: 18,
        },
      },
      {
        type: 'circle',
        text: 'C',
        radius: 16,
        fontSize: 20,
        anchor: {
          selector: '[data-testid="view-container-protein-TP53-9s9o"]',
          alignX: 'left',
          alignY: 'top',
          dx: 56,
          dy: 18,
        },
      },
      {
        type: 'text',
        text: "Y220C empties Tyr220's spot in p53; the drug rezatapopt fills it",
        fontSize: 28,
        color: '#ffffff',
        maxWidth: 1500,
        anchor: {
          selector: '[data-testid="view-container-protein-TP53-9s9o"]',
          alignX: 'left',
          alignY: 'top',
          dy: -22,
        },
        dx: -440,
      },
      {
        type: 'legend',
        fontSize: 18,
        entries: [
          { label: 'p53 broken (score > 0)', color: '#c51b1b' },
          { label: 'p53 works (score ≤ 0)', color: '#4f8fc6' },
        ],
        anchor: { trackId: 'tp53-sge', loc: 'chr17:7674935', fracY: 0.12 },
      },
      {
        type: 'text',
        text: 'Y220F (Phe keeps the ring): works',
        fontSize: 20,
        color: '#2f6fae',
        textColor: '#2f6fae',
        maxWidth: 600,
        leader: true,
        anchor: { trackId: 'tp53-sge', loc: 'chr17:7674872', fracY: 0.7 },
        dx: -40,
        dy: 30,
      },
      {
        type: 'text',
        text: 'Y220C, S, N, D, H: broken',
        fontSize: 20,
        color: '#c51b1b',
        textColor: '#c51b1b',
        maxWidth: 600,
        leader: true,
        anchor: { trackId: 'tp53-sge', loc: 'chr17:7674873', fracY: 0.42 },
        dx: -60,
        dy: -30,
      },
      {
        type: 'text',
        text: "Tyr220's ring fills this spot",
        fontSize: 22,
        maxWidth: 300,
        leader: true,
        anchor: { residue: 'A:220', view: 1 },
        dx: -40,
        dy: -170,
      },
      {
        type: 'text',
        text: 'Spot left empty; drug (orange) fills it',
        fontSize: 22,
        maxWidth: 340,
        leader: true,
        anchor: { residue: 'A:402', view: 2 },
        dx: -40,
        dy: 190,
      },
    ],
  },
]
