import { deflateSync } from 'node:zlib'

import { PARK_CURSOR } from '../screenshot-spec-types.ts'
import { readSession } from './protein_variants.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// One session carrying the whole chain, so it needs one config holding hg38,
// the Δ32 allele and the Protein3d plugin: demos/ccr5/config.json.
//
// The Δ32 allele is a multiway lane in the reads' own view. At the whole gene's
// 6.6 kb the reads carrying the deletion still read as one dark column, so one
// genome view holds the reads and both alleles' genes.
const CCR5_CONFIG = 'https://jbrowse.org/demos/ccr5/config.json'

const PANELS = ['protein-CCR5-6meo', 'protein-CCR5-v3'] as const

function comboSession() {
  const session = readSession('ccr5_delta32_combo.session.json')
  return `?config=${CCR5_CONFIG}&session=encoded-${deflateSync(
    JSON.stringify(session),
  ).toString('base64url')}`
}

export const proteinCcr5ComboSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'protein/ccr5_delta32_combo',
    url: comboSession(),
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
    viewportHeight: 920,
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
        type: 'text',
        text: 'Premature stop',
        fontSize: 20,
        leader: true,
        anchor: {
          trackId: 'ccr5_hg38_to_delta32',
          loc: 'chr3:46,373,581',
          fracY: 0.76,
        },
        dx: 140,
        dy: -30,
      },
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
          alignY: 'bottom',
        },
        dx: 16,
        dy: -130,
      },
    ],
  },
]
