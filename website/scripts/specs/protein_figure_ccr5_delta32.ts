import { deflateSync } from 'node:zlib'

import { UCSC_HG38_CONFIG } from '../screenshot-spec-helpers.ts'
import { PARK_CURSOR } from '../screenshot-spec-types.ts'
import { readSession } from './protein_variants.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

function ccr5Session() {
  const session = readSession('ccr5_delta32.session.json')
  return `?config=${UCSC_HG38_CONFIG}&session=encoded-${deflateSync(
    JSON.stringify(session),
  ).toString('base64url')}`
}

// The reads stream from the 1000 Genomes 30x CRAMs on the public S3 bucket:
// HG00137 is Δ32/Δ32, HG00101 Δ32/+ and HG00096 +/+ in the 2022 phased panel.
// Δ32 keeps residues 1-184, so the session colors 185 on; gp120 (chain G) is
// a cartoon mark of its own color.
const PANELS = ['protein-CCR5-6meo', 'protein-CCR5-4mbs'] as const

export const proteinCcr5Delta32Specs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'protein/ccr5_delta32',
    url: ccr5Session(),
    readySelector: `body${PANELS.map(
      id =>
        `:has([data-testid="view-container-${id}"] [data-testid="protein-view-ready"])`,
    ).join('')}`,
    readyTimeout: 300000,
    hideSelectors: [
      '.msp-viewport-controls',
      '.msp-viewport-top-left-controls',
      '.msp-background-tasks',
      '.msp-highlight-info',
      '[data-testid="header-alignment-quality"]',
    ],
    hideTooltip: true,
    viewportWidth: 1800,
    viewportHeight: 1410,
    actions: [
      { type: 'waitForAppSettled' },
      PARK_CURSOR,
      { type: 'delay', ms: 800 },
    ],
    annotations: [
      ...(
        [
          ['A', 'lgv-CCR5'],
          ['B', PANELS[0]],
          ['C', PANELS[1]],
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
        type: 'legend',
        fontSize: 20,
        entries: [
          { label: 'Lost in Δ32', color: '#d1007a' },
          { label: 'Kept in Δ32', color: '#b9c2cf' },
          { label: 'HIV gp120', color: '#2e9e6b' },
        ],
        anchor: {
          selector: `[data-testid="view-container-${PANELS[0]}"] [data-testid="protein-view-molstar"]`,
          alignX: 'left',
          alignY: 'top',
        },
        dx: 110,
        dy: 70,
      },
      {
        type: 'text',
        text: 'Maraviroc',
        fontSize: 24,
        maxWidth: 300,
        leader: true,
        anchor: { residue: 'A:1101', view: 2 },
        dx: -200,
        dy: 170,
      },
    ],
  },
]
