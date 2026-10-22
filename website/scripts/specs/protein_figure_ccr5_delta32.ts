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
// The read tracks are tall and sorted on a base inside the deletion, since a
// short unsorted track packs the reads carrying it out of sight. The two
// structure panels take their own angles: B is turned so the kept and lost
// halves sit side by side (in this crystal 182 residues are kept and 129
// lost), and C so the crown stays visible. Δ32 keeps residues 1-184, so the session colors 185
// on; gp120 (chain G) is a cartoon mark of its own color, and its V3 crown
// (310-315) sticks of a brighter one.
const PANELS = ['protein-CCR5-6meo', 'protein-CCR5-v3'] as const

const molstar = (id: string) =>
  `[data-testid="view-container-${id}"] [data-testid="protein-view-molstar"]`

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
    viewportHeight: 1928,
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
          selector: molstar(PANELS[0]),
          alignX: 'left',
          alignY: 'top',
        },
        dx: 110,
        dy: 70,
      },
      {
        type: 'text',
        text: 'Every read carries the deletion',
        fontSize: 24,
        color: '#d1007a',
        textColor: '#d1007a',
        maxWidth: 420,
        leader: true,
        anchor: { trackId: 'ccr5-HG00137', loc: 'chr3:46373468', fracY: 0.86 },
        dx: 260,
        dy: 40,
      },
      {
        type: 'text',
        text: '32 bases is not a multiple of 3,\nso the frame shifts and hits a stop',
        fontSize: 30,
        maxWidth: 760,
        leader: true,
        anchor: { trackId: 'ccr5-frameshift', loc: 'chr3:46373581' },
        dx: -120,
        dy: -150,
      },
      {
        type: 'text',
        text: 'Helices 5-7 and the tail',
        fontSize: 24,
        maxWidth: 340,
        leader: true,
        anchor: { residue: 'B:250', view: 1 },
        dx: 150,
        dy: 120,
      },
      {
        type: 'text',
        text: 'V3 crown',
        fontSize: 24,
        maxWidth: 300,
        leader: true,
        anchor: { residue: 'G:313', view: 2 },
        dx: 170,
        dy: -150,
      },
    ],
  },
]
