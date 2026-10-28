import { deflateSync } from 'node:zlib'

import { UCSC_HG38_CONFIG } from '../screenshot-spec-helpers.ts'
import { PARK_CURSOR } from '../screenshot-spec-types.ts'
import { readSession } from './protein_variants.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// UniProt Swiss-Prot beta globins, residues 1-13 counting Met, which most
// entries leave out since they were sequenced as protein. Every one is 146
// residues after Met, so the rows align with no gaps. Residue 7 (Glu6 in
// the mature protein's numbering) is E or D in most mammals; murine rodents,
// elephants, hyrax and tenrec carry Ala there, and Mouse stands for them.
const ROWS = [
  ['Human', 'P68871', 'MVHLTPEEKSAVT'],
  ['Macaque', 'P02026', 'MVHLTPEEKNAVT'],
  ['Colobus', 'P19885', 'MVHLTPDEKAAVT'],
  ['Mouse', 'P02088', 'MVHLTDAEKAAVS'],
  ['Rabbit', 'P02057', 'MVHLSSEEKSAVT'],
  ['Bat', 'P11758', 'MVHLTADEKAAVS'],
  ['Dog', 'P60524', 'MVHLTAEEKSLVS'],
  ['Walrus', 'P68046', 'MVHLTADEKAAVT'],
  ['Horse', 'P02062', 'MVQLSGEEKAAVL'],
  ['Pig', 'P02067', 'MVHLSAEEKEAVL'],
  ['Camel', 'P68231', 'MVHLSGDEKNAVH'],
  ['Dolphin', 'P18990', 'MVHLTGEEKSAVT'],
] as const

// The genome view spans 60 bp: 19 of 5' UTR, then codons 1-13 and a part.
// The label column covers the UTR and each alignment column one codon, so
// residue N sits under codon N at the figure's width. Both views are 1790px
// inside the panel's border, and the alignment's first column starts 7px past
// the label column: the 5px resize handle and 2px measured off a capture.
const VIEW_WIDTH = 1800
const BP_PX = (VIEW_WIDTH - 10) / 60
const LABEL_GUTTER = 7

function msaView(feature: object) {
  return {
    id: 'msa-HBB',
    type: 'MsaView',
    displayName: 'HBB residues 1-13 across mammals (UniProt)',
    height: 330,
    connectedViewId: 'lgv-HBB',
    connectedFeature: feature,
    querySeqName: 'Human',
    data: { msa: ROWS.map(([name, , seq]) => `>${name}\n${seq}`).join('\n') },
    colorSchemeName: 'none',
    drawTree: false,
    treeOrder: 'input',
    labelsAlignRight: true,
    treeAreaWidth: Math.round(19 * BP_PX - LABEL_GUTTER),
    colWidth: 3 * BP_PX,
    rowHeight: 22,
    showDomains: false,
    turnedOffTracks: { conservation: true, 'property-conservation': true },
  }
}

function hbbMsaSession() {
  const session = readSession('hbb_e6v.session.json')
  const structure = (session.views[1]!.structures as { feature: object }[])[0]!
  session.views.push(msaView(structure.feature))
  const layout = session.layout as {
    children: [
      { size: number; tabs: { viewIds: string[] }[] },
      { size: number },
    ]
  }
  const [top, bottom] = layout.children
  top.size = 47
  top.tabs[0]!.viewIds.push('msa-HBB')
  bottom.size = 53
  return `?config=${UCSC_HG38_CONFIG}&session=encoded-${deflateSync(
    JSON.stringify(session),
  ).toString('base64url')}`
}

const PANELS = [
  { id: 'protein-HBB-2hhb', view: 1, pill: 'WILD TYPE' },
  { id: 'protein-HBB-2hbs', view: 2, pill: 'SICKLE' },
] as const

const molstar = (id: string) =>
  `[data-testid="view-container-${id}"] [data-testid="protein-view-molstar"]`

export const proteinHbbE6vMsaSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'protein/hbb_e6v_msa',
    url: hbbMsaSession(),
    readySelector: `body:has([data-testid="msa_canvas"])${PANELS.map(
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
    viewportWidth: VIEW_WIDTH,
    viewportHeight: 1500,
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
          ['B', 'msa-HBB'],
          ['C', PANELS[0].id],
          ['D', PANELS[1].id],
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
        dx: 90,
        dy: 200,
      },
    ],
  },
]
