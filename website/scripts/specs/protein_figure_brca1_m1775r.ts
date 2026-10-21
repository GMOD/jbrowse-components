import { deflateSync } from 'node:zlib'

import { UCSC_HG38_CONFIG } from '../screenshot-spec-helpers.ts'
import { PARK_CURSOR } from '../screenshot-spec-types.ts'
import { readSession } from './protein_variants.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

const LGV = '[data-testid="view-container-lgv-BRCA1"]'
const WT = '[data-testid="view-container-protein-BRCA1-1t15"]'
const MUT = '[data-testid="view-container-protein-BRCA1-1n5o"]'

// The session comes from /var/tmp/m1775r/mksession.py. 1N5O superposed on 1T15
// (Biopython, BRCA1 Calpha): RMSD 0.94 A over 207 residues; Arg1775's
// guanidinium lies 0.9-1.4 A from the BACH1 Phe+3 (1T15 B:11) ring atoms, and
// wild-type Met1775 sits 3.6 A from that Phe. Both cameras look across the
// Met-to-Phe axis from the least occluded side. SGE (Findlay 2018), codon 1775:
// Arg -1.39, Val -1.52, Lys -1.83 (below the -1.328 loss-of-function cut);
// Ile -0.84/-1.03 (in between) and -0.30; Thr -0.70; Leu +0.09/+0.16.
function pocketSession() {
  const session = readSession('brca1_m1775r_pocket.session.json')
  return `?config=${UCSC_HG38_CONFIG}&session=encoded-${deflateSync(
    JSON.stringify(session),
  ).toString('base64url')}`
}

function badge(text: string, selector: string, dy = 14) {
  return {
    type: 'circle' as const,
    text,
    fontSize: 22,
    radius: 15,
    anchor: { selector, alignX: 'left' as const, alignY: 'top' as const },
    dx: 20,
    dy,
  }
}

export const proteinBrca1M1775rSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'protein/brca1_m1775r_pocket',
    url: pocketSession(),
    readySelector: `body:has(${WT} [data-testid="protein-view-ready"]):has(${MUT} [data-testid="protein-view-ready"])`,
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
    viewportHeight: 1270,
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
            '[data-testid="view-container-protein-BRCA1-1t15"] [data-testid="protein-view-molstar"]',
          alignX: 'left',
          alignY: 'top',
        },
        dx: 16,
        dy: 52,
      },
      {
        type: 'text',
        text: 'MUTANT: M1775R',
        fontSize: 34,
        maxWidth: 700,
        anchor: {
          selector:
            '[data-testid="view-container-protein-BRCA1-1n5o"] [data-testid="protein-view-molstar"]',
          alignX: 'left',
          alignY: 'top',
        },
        dx: 16,
        dy: 52,
      },
      {
        type: 'text',
        text: "Arg1775 fills BACH1's phenylalanine pocket, so M1775R breaks BRCA1",
        fontSize: 30,
        maxWidth: 1400,
        color: '#ffffff',
        anchor: { selector: WT, alignX: 'right', alignY: 'top' },
        dx: -500,
        dy: -22,
      },
      {
        type: 'text',
        text: 'Arg −1.39, Val −1.52, Lys −1.83',
        fontSize: 18,
        maxWidth: 400,
        leader: true,
        anchor: {
          trackId: 'brca1_sge_missense',
          loc: 'chr17:43051071-43051072',
          fracY: 0.72,
        },
        dx: 120,
        dy: 20,
      },
      badge('A', LGV),
      badge('B', WT),
      badge('C', MUT),
      {
        type: 'text',
        text: "Met1775 sits under\nthe partner's Phe (orange)",
        fontSize: 22,
        maxWidth: 400,
        leader: true,
        anchor: { residue: 'A:1775', view: 1 },
        dx: 70,
        dy: 85,
      },
      {
        type: 'text',
        text: "Arg1775 takes\nthe Phe's place",
        fontSize: 22,
        maxWidth: 400,
        leader: true,
        anchor: { residue: 'X:1775', view: 2 },
        dx: 70,
        dy: 110,
      },
    ],
  },
]
