import { deflateSync } from 'node:zlib'

import { UCSC_HG38_CONFIG } from '../screenshot-spec-helpers.ts'
import { PARK_CURSOR } from '../screenshot-spec-types.ts'
import { readSession } from './protein_variants.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

function krasSession() {
  const session = readSession('kras_g12c.session.json')
  return `?config=${UCSC_HG38_CONFIG}&session=encoded-${deflateSync(
    JSON.stringify(session),
  ).toString('base64url')}`
}

// The three cameras are one camera carried through a CA superposition of 4LDJ
// and 6OIM onto 4OBE, switch I and II left out since they move; a replaced
// structure needs its camera recomputed.
const PANELS = [
  { id: 'protein-KRAS-4obe', pill: 'WILD TYPE' },
  { id: 'protein-KRAS-4ldj', pill: 'G12C' },
  { id: 'protein-KRAS-6oim', pill: 'G12C + SOTORASIB' },
] as const

const molstar = (id: string) =>
  `[data-testid="view-container-${id}"] [data-testid="protein-view-molstar"]`

export const proteinKrasG12cSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'protein/kras_g12c',
    url: krasSession(),
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
          ['A', 'lgv-KRAS'],
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
        type: 'text',
        text: 'Pocket closed',
        fontSize: 24,
        maxWidth: 300,
        leader: true,
        anchor: { residue: 'A:72', view: 2 },
        dx: 60,
        dy: 200,
      },
      {
        type: 'text',
        text: 'Bonded to Cys12',
        fontSize: 24,
        maxWidth: 300,
        leader: true,
        anchor: { residue: 'A:12', view: 3 },
        dx: -200,
        dy: 120,
      },
    ],
  },
]
