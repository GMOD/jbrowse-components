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

// session.views indexes, which residue anchors name. The three cameras are one
// camera carried through a CA superposition of 2J1X and 9S9O onto 2XWR, so a
// replaced structure needs its camera recomputed. 2J1X and 9S9O share four
// stabilizing mutations away from the pocket.
const PANELS = [
  { id: 'protein-TP53-2xwr', view: 1, pill: 'WILD TYPE' },
  { id: 'protein-TP53-2j1x', view: 2, pill: 'Y220C' },
  { id: 'protein-TP53-9s9o', view: 3, pill: 'Y220C + REZATAPOPT' },
] as const

const molstar = (id: string) =>
  `[data-testid="view-container-${id}"] [data-testid="protein-view-molstar"]`

export const proteinTp53Y220cSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'protein/tp53_y220c',
    url: tp53Session(),
    readySelector: `body${PANELS.map(
      p =>
        `:has([data-testid="view-container-${p.id}"] [data-testid="protein-view-ready"])`,
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
    viewportHeight: 1190,
    actions: [
      { type: 'waitForAppSettled' },
      PARK_CURSOR,
      { type: 'delay', ms: 800 },
    ],
    annotations: [
      ...PANELS.map(p => ({
        type: 'text' as const,
        text: p.pill,
        fontSize: 30,
        maxWidth: 560,
        anchor: {
          selector: molstar(p.id),
          alignX: 'left' as const,
          alignY: 'top' as const,
        },
        dx: 14,
        dy: 46,
      })),
      ...(
        [
          ['A', 'lgv-TP53'],
          ['B', PANELS[0].id],
          ['C', PANELS[1].id],
          ['D', PANELS[2].id],
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
        fontSize: 18,
        entries: [
          { label: 'p53 broken', color: '#c51b1b' },
          { label: 'p53 works', color: '#4f8fc6' },
        ],
        anchor: { trackId: 'tp53-sge', loc: 'chr17:7674935', fracY: 0.14 },
      },
      {
        type: 'text',
        text: 'Y220F keeps the ring: works',
        fontSize: 20,
        color: '#2f6fae',
        textColor: '#2f6fae',
        maxWidth: 600,
        leader: true,
        anchor: { trackId: 'tp53-sge', loc: 'chr17:7674872', fracY: 0.72 },
        dx: -40,
        dy: 34,
      },
      {
        type: 'text',
        text: 'Y220C: broken',
        fontSize: 20,
        color: '#c51b1b',
        textColor: '#c51b1b',
        maxWidth: 600,
        leader: true,
        anchor: { trackId: 'tp53-sge', loc: 'chr17:7674873', fracY: 0.42 },
        dx: -60,
        dy: -34,
      },
      {
        type: 'text',
        text: 'Empty pocket',
        fontSize: 24,
        maxWidth: 300,
        leader: true,
        anchor: { residue: 'A:220', view: 2, dx: 85, dy: -30 },
        dx: 40,
        dy: 170,
      },
    ],
  },
]
