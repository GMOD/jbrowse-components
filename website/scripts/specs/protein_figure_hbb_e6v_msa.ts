import { deflateSync } from 'node:zlib'

import { UCSC_HG38_CONFIG } from '../screenshot-spec-helpers.ts'
import { PARK_CURSOR } from '../screenshot-spec-types.ts'
import { readSession } from './protein_variants.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'
import type { ViewJson } from './protein_variants.ts'

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

// UniProt puts every entry's Globin domain from His2 (residue 3 counting Met)
// and P68871's helix A from Pro5. The plugin's own source, NCBI CDD, starts
// its domain at Glu7, which would leave Glu6 outside it.
const GLOBIN = { name: 'Globin domain', color: '#c9a227' }
const HELIX_A = { name: 'Helix A', color: '#6b4f0e' }
const FEATURES = [
  ...ROWS.map(([row]) => ({ row, start: 3, end: 13, ...GLOBIN })),
  { row: 'Human', start: 6, end: 13, ...HELIX_A },
]

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
    features: FEATURES,
    colorSchemeName: 'none',
    drawTree: false,
    treeOrder: 'input',
    labelsAlignRight: true,
    treeAreaWidth: Math.round(19 * BP_PX - LABEL_GUTTER),
    colWidth: 3 * BP_PX,
    rowHeight: 22,
    domainFill: false,
    showDomainLegend: false,
    turnedOffTracks: { conservation: true, 'property-conservation': true },
  }
}

// 2HBS holds two sickle tetramers at the fiber contact: Val6 of chain H (EFGH)
// in the pocket Phe85 and Leu88 make on chain B (ABCD). The neighbour draws in
// its own color as cartoon marks, so chains lists the Val6 tetramer alone.
const NEIGHBOR = '#86cbc5'
const POCKET = '#009696'
const VAL6 = '#d1007a'
const neighborMarks = [
  ...['A', 'B', 'C', 'D'].map(chain => ({
    site: `${chain}:*`,
    mark: 'cartoon',
    encoding: { color: { value: NEIGHBOR } },
  })),
  { site: 'H:6', mark: 'spheres', encoding: { color: { value: VAL6 } } },
  ...['B:85', 'B:88'].map(site => ({
    site,
    mark: 'spheres',
    encoding: { color: { value: POCKET } },
  })),
]

// /var/tmp/hero2/bin/hbb_e6v_roll.py rolls both close-ups a quarter turn, so
// the Val6 tetramer sits below its neighbour as in the zoom-out, which
// hbb_e6v_overview.py frames along the close-up's line of sight.
const CLOSE_UP_UP = {
  '2hhb': [0.572, -0.7048, -0.4196],
  '2hbs': [-0.567, -0.7703, -0.2919],
}
const OVERVIEW_CAMERA = {
  position: [23.267, 109.785, -107.268],
  target: [22.954, 48.829, 40.691],
  up: [-0.5671, -0.7611, -0.3148],
  mode: 'orthographic',
}

function sickle(view: ViewJson, id: string, displayName: string) {
  const structures = view.structures as object[]
  return {
    ...view,
    id,
    displayName,
    color: {
      ...(view.color as object),
      range: ['#c9ced6', VAL6, NEIGHBOR],
      labels: ['hemoglobin', 'Val6', 'neighboring hemoglobin'],
    },
    marks: neighborMarks,
    structures: structures.map(s => ({ ...s, chains: ['E', 'F', 'G', 'H'] })),
  }
}

function hbbMsaSession() {
  const session = readSession('hbb_e6v.session.json')
  const [, wild, sickleView] = session.views as [ViewJson, ViewJson, ViewJson]
  const structure = (wild.structures as { feature: object }[])[0]!
  const camera = (view: ViewJson, up: number[]) => ({
    ...(view.camera as object),
    up,
  })
  session.views[1] = { ...wild, camera: camera(wild, CLOSE_UP_UP['2hhb']) }
  session.views[2] = {
    ...sickle(
      sickleView,
      'protein-HBB-2hbs',
      'Sickle hemoglobin contact (PDB 2HBS)',
    ),
    camera: camera(sickleView, CLOSE_UP_UP['2hbs']),
  }
  session.views.push(msaView(structure.feature), {
    ...sickle(
      sickleView,
      'protein-HBB-2hbs-overview',
      'Sickle hemoglobin, two molecules (PDB 2HBS)',
    ),
    camera: OVERVIEW_CAMERA,
  })
  const layout = session.layout as unknown as {
    children: [
      { size: number; tabs: { viewIds: string[] }[] },
      { size: number; children: object[] },
    ]
  }
  const [top, bottom] = layout.children
  top.size = 45
  top.tabs[0]!.viewIds.push('msa-HBB')
  bottom.size = 55
  const [wildPanel, sicklePanel] = bottom.children
  bottom.children = [
    { ...wildPanel, size: 33 },
    {
      id: 'panel-2hbs-overview',
      size: 34,
      activeTabId: 'tab-2hbs-overview',
      tabs: [
        { id: 'tab-2hbs-overview', viewIds: ['protein-HBB-2hbs-overview'] },
      ],
    },
    { ...sicklePanel, size: 33 },
  ]
  return `?config=${UCSC_HG38_CONFIG}&session=encoded-${deflateSync(
    JSON.stringify(session),
  ).toString('base64url')}`
}

const PANELS = [
  { id: 'protein-HBB-2hhb', view: 1, pill: 'WILD TYPE' },
  { id: 'protein-HBB-2hbs-overview', view: 4, pill: 'SICKLE, TWO MOLECULES' },
  { id: 'protein-HBB-2hbs', view: 2, pill: 'SICKLE CONTACT' },
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
        fontSize: 26,
        maxWidth: 520,
        anchor: {
          selector: molstar(p.id),
          alignX: 'left' as const,
          alignY: 'top' as const,
        },
        dx: 14,
        dy: 42,
      })),
      ...(
        [
          ['A', 'lgv-HBB'],
          ['B', 'msa-HBB'],
          ['C', PANELS[0].id],
          ['D', PANELS[1].id],
          ['E', PANELS[2].id],
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
          { label: GLOBIN.name, color: GLOBIN.color },
          { label: HELIX_A.name, color: HELIX_A.color },
        ],
        anchor: {
          selector: '[data-testid="view-container-msa-HBB"]',
          alignX: 'left',
          alignY: 'top',
        },
        dx: 40,
        dy: 110,
      },
      {
        type: 'box',
        color: '#333',
        strokeWidth: 3,
        pad: 18,
        anchor: { residue: 'H:6', view: PANELS[1].view },
        fromAnchor: { residue: 'B:88', view: PANELS[1].view },
      },
      {
        type: 'text',
        text: 'Phe85 and Leu88 of the neighboring hemoglobin',
        fontSize: 24,
        maxWidth: 260,
        color: POCKET,
        leader: true,
        anchor: { residue: 'B:85', view: PANELS[2].view },
        dx: -60,
        dy: 230,
      },
    ],
  },
]
