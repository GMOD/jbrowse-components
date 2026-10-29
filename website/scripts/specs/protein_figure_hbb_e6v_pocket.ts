import { deflateSync } from 'node:zlib'

import { UCSC_HG38_CONFIG } from '../screenshot-spec-helpers.ts'
import { PARK_CURSOR } from '../screenshot-spec-types.ts'
import {
  GWAS_SUBSET,
  GWAS_SUBSET_TRACK,
  readSession,
} from './protein_variants.ts'

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
// the label column: the 5px resize handle and 2px measured off a capture. The
// label column rounds down, since columns overflowing by over half a pixel
// turn on react-msaview's scrollbar and minimap.
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
    displayName: 'HBB across mammals (UniProt)',
    height: (ROWS.length + 1) * ROW_HEIGHT + 50,
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
    treeAreaWidth: Math.floor(TREE_BP * BP_PX - LABEL_GUTTER),
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

// hbb_e6v_overview.py frames the zoom-out along the close-up's line of sight,
// brought in to 0.75 of its distance to fill the shorter panel and moved 9 Å
// along its up vector, so the molecules sit clear of the panel's pill.
// Both take this up vector, the line of sight crossed with the up that
// /var/tmp/hero2/bin/hbb_e6v_roll.py gave them, so in the landscape panels the
// two molecules sit side by side.
const SIDE_BY_SIDE_UP = [0.8236, -0.525, -0.2145]
const OVERVIEW_CAMERA = {
  position: [30.444, 89.821, -72.209],
  target: [30.366, 44.104, 38.76],
  up: SIDE_BY_SIDE_UP,
  mode: 'orthographic',
}

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

// The tutorial's rs334 records, narrowed to the two the figure tells: the
// disease, and malaria, which one copy protects against. The PheCode suffix
// would run the anemia label across the seam, and the malaria paper's author,
// a consortium, truncates. Magenta, as part of the plug's chain.
const PHECODE_282 = ' (PheCode 282)'
const GWAS_TRACK = {
  ...GWAS_SUBSET_TRACK,
  name: 'GWAS Catalog at rs334',
  displayDefaults: {
    filter: [
      "jexl:feature.name == 'rs334'",
      `jexl:feature.trait in ['Malaria', 'Hereditary hemolytic anemias${PHECODE_282}']`,
      "jexl:feature.pValue in ['4E-69', '1E-323']",
    ],
    // The labels print at about 4 pt in the figure, which names the two records
    // in a callout instead. The live link can turn them back on.
    labels: {
      name: {
        show: false,
        field: `jexl:replace(feature.trait, '${PHECODE_282}', '')`,
      },
      description: {
        show: false,
        field:
          "jexl:'p=' + feature.pValue + ', ' + substring(feature.pubDate, 0, 4)",
      },
    },
  },
}
const GWAS_HEIGHT = 80

// The genome view and the alignment take the left column, the two structures
// stack in the right, each column as tall as the left one's views need. The
// GWAS track's header adds 40px over its height, and the genome view hides its
// location bar, which the ruler's coordinates stand in for. A structure
// panel's tab, title and color key take 124px over its view.
const APP_BAR_PX = 50
const LOCATION_BAR_PX = 44
const LEFT_PX = 678 + GWAS_HEIGHT + 40 - LOCATION_BAR_PX
const STRUCTURES_WIDTH = 520
// the column divider takes 3px off the left column, measured off a capture
const DIVIDER_PX = 3
const FRAME_WIDTH = VIEW_WIDTH + DIVIDER_PX + STRUCTURES_WIDTH
const PROTEIN_HEIGHT = Math.floor(LEFT_PX / 2) - 124
const VIEWPORT_HEIGHT = APP_BAR_PX + LEFT_PX

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
      hideHeader: true,
      tracks: [
        {
          trackId: 'hbb-mane',
          type: 'LinearBasicDisplay',
          height: 112,
          mark: { height: 20 },
        },
        {
          trackId: GWAS_SUBSET,
          type: 'LinearBasicDisplay',
          height: GWAS_HEIGHT,
          encoding: { color: { value: VAL6 } },
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
      camera: { ...(sickleView.camera as object), up: SIDE_BY_SIDE_UP },
    },
  ]
  session.sessionTracks = [
    ...(session.sessionTracks ?? []).filter(
      t => (t as { trackId: string }).trackId === 'hbb-mane',
    ),
    GWAS_TRACK,
  ]
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
    activePanelId: 'panel-left',
    layout: {
      id: 'branch-root',
      direction: 'row',
      size: 1,
      children: [
        panel('left', VIEW_WIDTH + DIVIDER_PX, ['lgv-HBB', 'msa-HBB']),
        {
          id: 'branch-right',
          direction: 'column',
          size: STRUCTURES_WIDTH,
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

// Callouts read at 8 pt with the figure printed 7 in wide, the size
// grant_callout_sizes.ts suggests: font px = pt * frame width / print width in
// pt. At 11 pt the wider frame's pills would overrun the gene track.
const PRINT_PT = 7 * 72
const FONT = Math.round((8 * FRAME_WIDTH) / PRINT_PT)

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

// The anchor is the whole codon, so the leader aims at its centre. The pill
// hangs just to one side, since the head stops 14px short of the target along
// the leader and only a steep leader keeps that gap inside the codon.
const codonLabel = (m: number, text: string, color: string, dx: number) => ({
  type: 'text' as const,
  text,
  color,
  fontSize: FONT,
  leader: true,
  anchor: {
    loc: `chr11:${codon(m).start + 1}-${codon(m).end}`,
    view: 0,
    trackId: 'hbb-mane',
    fracY: 0.12,
  },
  dx,
  dy: 70,
})

// A lone position anchors the zero-width point before it: region 1's start,
// which the [rev] view draws at its right edge, the seam where the genome view
// and the alignment both skip codons 14-79. The pill sits on the seam as
// SNCA's does, the line running down into it. Between the E band and the Phe85
// pill there is no room for a leader's shaft, nor to centre the pill, so it
// hangs left of centre to clear Phe85.
const seamLabel = {
  type: 'text' as const,
  text: 'codons 14–79\nnot shown',
  color: '#777777',
  fontSize: FONT,
  anchor: {
    loc: `chr11:${REGIONS[0]!.start + 1}`,
    view: 0,
    trackId: 'hbb-mane',
    fracY: 0.12,
  },
  dx: -99,
  dy: 55,
}

// The two records stack at codon 6 in one row each, so one magenta pill beside
// them names both.
const gwasLabel = {
  type: 'text' as const,
  text: 'Hemolytic anemias, p = 1E-323\nMalaria, p = 4E-69',
  color: VAL6,
  fontSize: FONT,
  anchor: {
    loc: `chr11:${codon(6).start + 1}-${codon(6).end}`,
    view: 0,
    trackId: GWAS_SUBSET,
    fracY: 0,
  },
  dx: 40,
  dy: 34,
}

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
      '[data-testid="lgv-mini-controls"]',
      '[data-testid="hidden_columns_chip"]',
      `[aria-label="Hide ${HBS} track"]`,
      `[aria-label="${HBS} track menu"]`,
      '[data-testid="view-container-msa-HBB"] .MuiPaper-root:has(> button[title="Expand key"])',
    ],
    tooltip: 'hide',
    viewportWidth: FRAME_WIDTH,
    viewportHeight: VIEWPORT_HEIGHT,
    actions: [
      { type: 'waitForAppSettled' },
      PARK_CURSOR,
      { type: 'delay', ms: 800 },
    ],
    annotations: [
      pill(OVERVIEW_ID, 'SICKLE HEMOGLOBINS STICK'),
      pill(CLOSE_UP_ID, 'ZOOMED IN'),
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
        fontSize: 20,
        radius: 13,
        anchor: {
          selector: `[data-testid="view-container-${id}"]`,
          alignX: 'left' as const,
          alignY: 'top' as const,
        },
        dx: 16,
        dy: 13,
      })),
      codonLabel(6, 'E6V', VAL6, 2),
      seamLabel,
      codonLabel(85, 'Phe85', POCKET, -2),
      codonLabel(88, 'Leu88', POCKET, 2),
      {
        type: 'box',
        color: '#222',
        strokeWidth: 5,
        pad: 24,
        anchor: { residue: 'H:6', view: OVERVIEW_VIEW },
        fromAnchor: { residue: 'B:88', view: OVERVIEW_VIEW },
      },
      gwasLabel,
      residueLabel('B:85', 'Phe85, Leu88', POCKET, -60, 100),
      residueLabel('H:6', 'Val6', VAL6, 60, -90),
    ],
  },
]
