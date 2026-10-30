import { deflateSync } from 'node:zlib'

import { UCSC_HG38_CONFIG } from '../screenshot-spec-helpers.ts'
import { PARK_CURSOR } from '../screenshot-spec-types.ts'
import { readSession } from './protein_variants.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

function hbbSession() {
  const session = readSession('hbb_e6v.session.json')
  return `?config=${UCSC_HG38_CONFIG}&session=encoded-${deflateSync(
    JSON.stringify(session),
  ).toString('base64url')}`
}

// session.views indexes, which residue anchors name. The 2HHB camera is the
// 2HBS one carried through a CA superposition of 2HHB onto 2HBS's second
// tetramer, chain B onto H, so Glu6 of 2HHB chain B sits where Val6 of 2HBS
// chain H does and the space beside it is where 2HBS puts the next tetramer's
// pocket.
const PANELS = [
  { id: 'protein-HBB-2hhb', view: 1, pill: 'WILD TYPE' },
  { id: 'protein-HBB-2hbs', view: 2, pill: 'SICKLE' },
] as const

const molstar = (id: string) =>
  `[data-testid="view-container-${id}"] [data-testid="protein-view-molstar"]`

export const proteinHbbE6vSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'protein/hbb_e6v',
    url: hbbSession(),
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
    tooltip: 'hide',
    viewportWidth: 1800,
    viewportHeight: 1150,
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
          ['A', 'lgv-HBB'],
          ['B', PANELS[0].id],
          ['C', PANELS[1].id],
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
        text: "Next molecule's pocket",
        fontSize: 24,
        maxWidth: 320,
        leader: true,
        anchor: { residue: 'B:85', view: PANELS[1].view },
        dx: 70,
        dy: 200,
      },
    ],
  },
]
