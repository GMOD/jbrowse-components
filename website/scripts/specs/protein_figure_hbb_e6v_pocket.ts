import { deflateSync } from 'node:zlib'

import { UCSC_HG38_CONFIG } from '../screenshot-spec-helpers.ts'
import { PARK_CURSOR } from '../screenshot-spec-types.ts'
import { readSession } from './protein_variants.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'
import type { ViewJson } from './protein_variants.ts'

// The sickle contact in two colors through all three views: magenta for the
// plug (codon 6, alignment column 6, Val6) and teal for the pocket on the next
// molecule (codons 85 and 88, their columns, Phe85 and Leu88). Helix A, which
// protein/hbb_e6v_msa colors, would be a third color competing with the two
// sides of the contact, so this variant leaves it out.
const VAL6 = '#d1007a'
const POCKET = '#009696'
const GREY = '#c9ced6'
const NEIGHBOR = '#86cbc5'

// Mature numbering throughout, Val1 as 1. HBB is on the minus strand: exon 1's
// CDS ends at the ATG's A, 5227021, and exon 2's first whole codon is Met-
// counting codon 32, ending at 5226798. 0-based, half-open.
function codon(m: number) {
  const end = m < 30 ? 5227021 - 3 * m : 5226798 - 3 * (m - 31)
  return { start: end - 3, end }
}
const WINDOWS = [
  [1, 13],
  [80, 92],
] as const
// 5' UTR and the Met codon, which the tree and the row names sit over
const TREE_BP = 26
const REGIONS = [
  { start: codon(13).start, end: codon(1).end + TREE_BP },
  { start: codon(92).start, end: codon(80).end },
]
const LOC = REGIONS.map(r => `chr11:${r.start + 1}-${r.end}[rev]`).join(' ')

// The genome view's two regions abut, so the alignment's two windows abut too
// once react-msaview hides every column outside them. Both views are 990px
// inside the panel's border, and the alignment's first column starts 7px past
// the label column: the 5px resize handle and 2px measured off a capture.
const VIEW_WIDTH = 1000
const WINDOW_BP = REGIONS.reduce((sum, r) => sum + r.end - r.start, 0)
const BP_PX = (VIEW_WIDTH - 10) / WINDOW_BP
const LABEL_GUTTER = 7
const ROW_HEIGHT = 22

// UniProt Swiss-Prot beta globins, mature residues 1-13 and 80-92, read off a
// global alignment to human P68871 (BLOSUM62). Over the 155 reviewed
// mammalian entries named plain "Hemoglobin subunit beta", aligned:
//   6: E 113, D 21, A 13, G 4, S 1, deleted 3
//   85: F 140, Y 13 (camelids, moles, rhino, sloth, tenrec, a bat), deleted 2
//   88: L 153, deleted 2
// The twelve rows keep that shape: E or D at 6 bar Mouse's Ala, which stands
// for murine rodents, elephants, hyrax and tenrec, and Camel carries Tyr85.
const ROWS = [
  ['Human', 'P68871', 'VHLTPEEKSAVTA', 'NLKGTFATLSELH'],
  ['Macaque', 'P02026', 'VHLTPEEKNAVTT', 'NLKGTFAQLSELH'],
  ['Colobus', 'P19885', 'VHLTPDEKAAVTA', 'NLKGTFAQLSELH'],
  ['Mouse', 'P02088', 'VHLTDAEKAAVSC', 'SLKGTFASLSELH'],
  ['Rabbit', 'P02057', 'VHLSSEEKSAVTA', 'NLKGTFAKLSELH'],
  ['Bat', 'P11758', 'VHLTADEKAAVSG', 'NLKGTFASLSELH'],
  ['Dog', 'P60524', 'VHLTAEEKSLVSG', 'NLKGTFAKLSELH'],
  ['Walrus', 'P68046', 'VHLTADEKAAVTA', 'NLKGTFAKLSELH'],
  ['Horse', 'P02062', 'VQLSGEEKAAVLA', 'NLKGTFAALSELH'],
  ['Pig', 'P02067', 'VHLSAEEKEAVLG', 'NLKGTFAKLSELH'],
  ['Camel', 'P68231', 'VHLSGDEKNAVHG', 'NLKGTYAKLSELH'],
  ['Dolphin', 'P18990', 'VHLTGEEKSAVTA', 'DLKGTFAALSELH'],
] as const

// P68871 after Met. The genome highlights reach the alignment through this
// row, which the tree leaves out, so it is never drawn: every drawn row is
// gapped outside the two windows, and the columns it alone fills are all gaps
// among the drawn rows, which react-msaview hides.
const HUMAN =
  'VHLTPEEKSAVTALWGKVNVDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAVMGNPKVKAHGKKVLGAFSDGLAHLDNLKGTFATLSELHCDKLHVDPENFRLLGNVLVCVLAHHFGKEFTPPVQAAYQKVVAGVANALAHKYH'
const QUERY = 'HBB'

function windowed(residues: readonly string[]) {
  let row = ''
  for (const [i, [first]] of WINDOWS.entries()) {
    row = row.padEnd(first - 1, '-') + residues[i]
  }
  return row.padEnd(HUMAN.length, '-')
}

// The NCBI Taxonomy lineages of the twelve taxids, topology only, as in
// protein/hbb_e6v_msa
const SPECIES_TREE =
  '(((Human,(Macaque,Colobus)),(Mouse,Rabbit)),(Bat,(Dog,Walrus),Horse,(Pig,Camel,Dolphin)));'

// HbS is an allele, not a species, so it sits outside the tree as a text track
// over the alignment: a dot wherever it matches the Human row under it
const HBS = 'Human, sickle (HbS)'
const HBS_ROW = `${'·'.repeat(5)}V`.padEnd(HUMAN.length, '·')

function msaView(feature: object) {
  return {
    id: 'msa-HBB',
    type: 'MsaView',
    displayName: 'HBB residues 1-13 and 80-92 across mammals (UniProt)',
    height: (ROWS.length + 1) * ROW_HEIGHT + 30,
    connectedViewId: 'lgv-HBB',
    connectedFeature: feature,
    querySeqName: QUERY,
    querySeqOffset: 1,
    data: {
      msa: [
        `>${QUERY}\n${HUMAN}`,
        ...ROWS.map(([name, , ...w]) => `>${name}\n${windowed(w)}`),
      ].join('\n'),
      tree: SPECIES_TREE,
    },
    allowedGappyness: 99,
    columnTracks: [
      {
        id: 'hbs',
        name: HBS,
        kind: 'text',
        data: HBS_ROW,
        encoding: { color: { domain: ['V'], range: [VAL6] } },
      },
    ],
    colorSchemeName: 'none',
    showBranchLen: false,
    drawNodeBubbles: false,
    treeOrder: 'input',
    labelsAlignRight: true,
    treeAreaWidth: Math.round(TREE_BP * BP_PX - LABEL_GUTTER),
    treeWidth: 120,
    colWidth: 3 * BP_PX,
    rowHeight: ROW_HEIGHT,
    turnedOffTracks: { conservation: true, 'property-conservation': true },
  }
}

const highlight = (m: number, color: string, label: string) => ({
  assemblyName: 'hg38',
  refName: 'chr11',
  ...codon(m),
  color,
  label,
})

// The session's highlights band each codon and its column, and keep their
// labels for the live link. The figure turns the labels off: react-msaview
// writes a label over the top row's cell, which would hide Human's Glu6, and
// the callouts below name the bands at print size instead.
const HIGHLIGHTS = [
  highlight(6, 'rgba(209,0,122,0.16)', 'E6V'),
  highlight(85, 'rgba(0,150,150,0.18)', 'Phe85'),
  highlight(88, 'rgba(0,150,150,0.18)', 'Leu88'),
]

// 2HBS holds two sickle tetramers at the fiber contact: Val6 of chain H (EFGH)
// in the pocket Phe85 and Leu88 make on chain B (ABCD). A session highlight
// lands on every listed chain that has its residue, so chains lists H alone and
// its filter stops at residue 84: the teal highlights would otherwise put
// spheres on H's own Phe85 and Leu88, the wrong side of the contact. The rest
// of H draws as one-residue cartoon marks, every other chain as a chain mark.
const cartoon = (site: string, color: string) => ({
  site,
  mark: 'cartoon',
  encoding: { color: { value: color } },
})
const spheres = (site: string, color: string) => ({
  site,
  mark: 'spheres',
  encoding: { color: { value: color } },
})
const H_DRAWN = 84
const MARKS = [
  ...['A', 'B', 'C', 'D'].map(chain => cartoon(`${chain}:*`, NEIGHBOR)),
  ...['E', 'F', 'G'].map(chain => cartoon(`${chain}:*`, GREY)),
  ...Array.from({ length: 146 - H_DRAWN }, (_, i) =>
    cartoon(`H:${H_DRAWN + 1 + i}`, GREY),
  ),
  spheres('H:6', VAL6),
  spheres('B:85', POCKET),
  spheres('B:88', POCKET),
]

// /var/tmp/hero2/bin/hbb_e6v_roll.py rolls the close-up a quarter turn, so the
// Val6 tetramer sits below its neighbour as in the zoom-out, which
// hbb_e6v_overview.py frames along the close-up's line of sight.
const CLOSE_UP_UP = [-0.567, -0.7703, -0.2919]
const OVERVIEW_CAMERA = {
  position: [23.267, 109.785, -107.268],
  target: [22.954, 48.829, 40.691],
  up: [-0.5671, -0.7611, -0.3148],
  mode: 'orthographic',
}
const PROTEIN_HEIGHT = 430

function sickle(view: ViewJson, id: string, displayName: string) {
  return {
    ...view,
    id,
    displayName,
    height: PROTEIN_HEIGHT,
    color: {
      ...(view.color as object),
      domain: [1.5, 2.5, 3.5],
      range: [GREY, VAL6, NEIGHBOR, POCKET],
      labels: ['hemoglobin', 'Val6', 'neighboring hemoglobin', 'Phe85, Leu88'],
    },
    marks: MARKS,
    structures: (view.structures as object[]).map(s => ({
      ...s,
      chains: ['H'],
      filter: [{ field: 'residue', lte: H_DRAWN }],
    })),
  }
}

const OVERVIEW_ID = 'protein-HBB-2hbs-overview'
const CLOSE_UP_ID = 'protein-HBB-2hbs'

function pocketSession() {
  const session = readSession('hbb_e6v.session.json')
  const [lgv, , sickleView] = session.views as [ViewJson, ViewJson, ViewJson]
  const structure = (sickleView.structures as { feature: object }[])[0]!
  session.views = [
    {
      ...lgv,
      loc: LOC,
      tracks: [
        {
          trackId: 'hbb-mane',
          type: 'LinearBasicDisplay',
          height: 100,
          mark: { height: 20 },
        },
      ],
    },
    msaView(structure.feature),
    {
      ...sickle(
        sickleView,
        OVERVIEW_ID,
        'Sickle hemoglobin, two molecules (PDB 2HBS)',
      ),
      camera: OVERVIEW_CAMERA,
    },
    {
      ...sickle(
        sickleView,
        CLOSE_UP_ID,
        'Sickle hemoglobin contact (PDB 2HBS)',
      ),
      camera: { ...(sickleView.camera as object), up: CLOSE_UP_UP },
    },
  ]
  session.sessionTracks = session.sessionTracks?.filter(
    t => (t as { trackId: string }).trackId === 'hbb-mane',
  )
  session.highlights = HIGHLIGHTS
  const panel = (id: string, size: number, viewIds: string[]) => ({
    id: `panel-${id}`,
    size,
    activeTabId: `tab-${id}`,
    tabs: [{ id: `tab-${id}`, viewIds }],
  })
  const json = {
    ...session,
    highlightLabelsVisible: false,
    activePanelId: 'panel-top',
    layout: {
      id: 'branch-root',
      direction: 'column',
      size: 1,
      children: [
        panel('top', 54, ['lgv-HBB', 'msa-HBB']),
        {
          id: 'branch-bottom',
          direction: 'row',
          size: 46,
          children: [
            panel('2hbs-overview', 50, [OVERVIEW_ID]),
            panel('2hbs', 50, [CLOSE_UP_ID]),
          ],
        },
      ],
    },
  }
  return `?config=${UCSC_HG38_CONFIG}&session=encoded-${deflateSync(
    JSON.stringify(json),
  ).toString('base64url')}`
}

// Callouts read at 11 pt with the figure printed 7 in wide, the rule
// grant_callout_sizes.ts sizes the renewal's figures by: font px = pt *
// frame width / print width in pt.
const PRINT_PT = 7 * 72
const FONT = Math.round((11 * VIEW_WIDTH) / PRINT_PT)

const OVERVIEW_VIEW = 2
const CLOSE_UP_VIEW = 3

const molstar = (id: string) =>
  `[data-testid="view-container-${id}"] [data-testid="protein-view-molstar"]`

const pill = (id: string, text: string) => ({
  type: 'text' as const,
  text,
  fontSize: FONT,
  anchor: {
    selector: molstar(id),
    alignX: 'left' as const,
    alignY: 'top' as const,
  },
  dx: 12,
  dy: FONT + 14,
})

const codonLabel = (m: number, text: string, color: string, dx: number) => ({
  type: 'text' as const,
  text,
  color,
  fontSize: FONT,
  leader: true,
  anchor: {
    loc: `chr11:${codon(m).start + 2}`,
    view: 0,
    trackId: 'hbb-mane',
    fracY: 0.12,
  },
  dx,
  dy: 50,
})

const residueLabel = (
  residue: string,
  text: string,
  color: string,
  dx: number,
  dy: number,
) => ({
  type: 'text' as const,
  text,
  color,
  fontSize: FONT,
  leader: true,
  anchor: { residue, view: CLOSE_UP_VIEW },
  dx,
  dy,
})

export const proteinHbbE6vPocketSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'protein/hbb_e6v_pocket',
    url: pocketSession(),
    readySelector: `body:has([data-testid="msa_canvas"])${[
      OVERVIEW_ID,
      CLOSE_UP_ID,
    ]
      .map(
        id =>
          `:has([data-testid="view-container-${id}"] [data-testid="protein-view-ready"])`,
      )
      .join('')}`,
    readyTimeout: 300000,
    hideSelectors: [
      '.msp-viewport-controls',
      '.msp-viewport-top-left-controls',
      '.msp-background-tasks',
      '.msp-highlight-info',
      '[data-testid="header-alignment-quality"]',
      '[data-testid="hidden_columns_chip"]',
      `[aria-label="Hide ${HBS} track"]`,
      `[aria-label="${HBS} track menu"]`,
      '[data-testid="view-container-msa-HBB"] .MuiPaper-root:has(> button[title="Expand key"])',
    ],
    tooltip: 'hide',
    viewportWidth: VIEW_WIDTH,
    viewportHeight: 1240,
    actions: [
      { type: 'waitForAppSettled' },
      PARK_CURSOR,
      { type: 'delay', ms: 800 },
    ],
    annotations: [
      pill(OVERVIEW_ID, 'SICKLE HEMOGLOBINS STICK'),
      pill(CLOSE_UP_ID, 'WHERE THEY STICK'),
      ...(
        [
          ['A', 'lgv-HBB'],
          ['B', 'msa-HBB'],
          ['C', OVERVIEW_ID],
          ['D', CLOSE_UP_ID],
        ] as const
      ).map(([text, id]) => ({
        type: 'circle' as const,
        text,
        fontSize: FONT,
        radius: 18,
        anchor: {
          selector: `[data-testid="view-container-${id}"]`,
          alignX: 'left' as const,
          alignY: 'top' as const,
        },
        dx: 18,
        dy: 16,
      })),
      codonLabel(6, 'E6V', VAL6, 40),
      codonLabel(85, 'Phe85', POCKET, -40),
      codonLabel(88, 'Leu88', POCKET, 40),
      {
        type: 'box',
        color: '#222',
        strokeWidth: 5,
        pad: 24,
        anchor: { residue: 'H:6', view: OVERVIEW_VIEW },
        fromAnchor: { residue: 'B:88', view: OVERVIEW_VIEW },
      },
      residueLabel('B:85', 'Phe85, Leu88', POCKET, 60, -120),
      residueLabel('H:6', 'Val6', VAL6, 70, 110),
    ],
  },
]
