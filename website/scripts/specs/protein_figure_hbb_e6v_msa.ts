import { readFileSync } from 'node:fs'
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

// Helix A is Thr4-Val18 of each beta chain in the HELIX records of 2HHB and
// 2HBS, residues 5-19 counting Met, so it fills the strip from Thr4 on and
// colors the same residues on the genome and the structures. hbb_helix_a/
// holds the genome placement, re-run from that directory with
//   npx domains2genome@2.3.0 hbb.gff3 helix_a.gff3 --out helix_a.bed
// where hbb.gff3 is NM_000518.5 sliced from
// https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz.
const HELIX = { name: 'Helix A', color: '#f28e2b' }
const HELIX_RESIDUES = [5, 19]
const FEATURES = ROWS.map(([row]) => ({ row, start: 5, end: 13, ...HELIX }))

function helixTrack() {
  const row = readFileSync(
    new URL('hbb_helix_a/helix_a.bed', import.meta.url),
    'utf8',
  )
    .split('\n')
    .find(line => line && !line.startsWith('#'))!
  const [refName, start, end, name, , strand] = row.split('\t')
  return {
    type: 'FeatureTrack',
    trackId: 'hbb-helix-a',
    name: 'Helix A (PDB 2HHB)',
    assemblyNames: ['hg38'],
    adapter: {
      type: 'FromConfigAdapter',
      features: [
        {
          uniqueId: 'helix-a',
          refName,
          start: Number(start),
          end: Number(end),
          strand: strand === '-' ? -1 : 1,
          name,
        },
      ],
    },
  }
}

interface ResidueColor {
  values: Record<string, number>
  range: string[]
  labels: string[]
}

// helix A takes the next color, under the variant's own
function withHelix(color: ResidueColor) {
  const helix = color.range.length + 1
  const [first, last] = HELIX_RESIDUES as [number, number]
  return {
    ...color,
    values: Object.fromEntries(
      Object.entries(color.values).map(([pos, value]) => [
        pos,
        value === 1 && +pos >= first && +pos <= last ? helix : value,
      ]),
    ),
    domain: color.range.map((_, i) => i + 1.5),
    range: [...color.range, HELIX.color],
    labels: [...color.labels, HELIX.name],
  }
}

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
    height: 304,
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
    showDomainLegend: false,
    turnedOffTracks: { conservation: true, 'property-conservation': true },
  }
}

// 2HBS holds two sickle tetramers at the fiber contact: Val6 of chain H (EFGH)
// in the pocket Phe85 and Leu88 make on chain B (ABCD). The neighbour draws in
// its own color as cartoon marks, so chains lists the Val6 tetramer alone.
// The other beta chain of each molecule's pair draws as a plain cartoon mark
// too, so the session's E6V highlight and its label land on the marked chain
// alone: Protein3d labels the copy nearest the viewer, which was out of frame.
const GREY = '#c9ced6'
const NEIGHBOR = '#86cbc5'
const POCKET = '#009696'
const VAL6 = '#d1007a'
const cartoon = (chain: string, color: string) => ({
  site: `${chain}:*`,
  mark: 'cartoon',
  encoding: { color: { value: color } },
})
const neighborMarks = [
  ...['A', 'B', 'C', 'D'].map(chain => cartoon(chain, NEIGHBOR)),
  cartoon('F', GREY),
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
    color: withHelix({
      ...(view.color as ResidueColor),
      range: [GREY, VAL6, NEIGHBOR],
      labels: ['hemoglobin', 'Val6', 'neighboring hemoglobin'],
    }),
    marks: neighborMarks,
    structures: structures.map(s => ({ ...s, chains: ['E', 'G', 'H'] })),
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
  session.views[1] = {
    ...wild,
    color: withHelix(wild.color as ResidueColor),
    marks: [...(wild.marks as object[]), cartoon('D', GREY)],
    structures: (wild.structures as object[]).map(s => ({
      ...s,
      chains: ['A', 'B', 'C'],
    })),
    camera: camera(wild, CLOSE_UP_UP['2hhb']),
  }
  session.sessionTracks = [...(session.sessionTracks ?? []), helixTrack()]
  const lgv = session.views[0] as { tracks: { trackId: string }[] }
  lgv.tracks = lgv.tracks.flatMap(track =>
    track.trackId === 'hbb-mane'
      ? [
          track,
          {
            trackId: 'hbb-helix-a',
            type: 'LinearBasicDisplay',
            height: 36,
            encoding: { color: { value: HELIX.color } },
          },
        ]
      : track.trackId === 'hbb-codon6'
        ? [{ ...track, height: 70 }]
        : [track],
  )
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
  top.size = 49.5
  top.tabs[0]!.viewIds.push('msa-HBB')
  bottom.size = 50.5
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
      `[data-testid="view-container-${PANELS[1].id}"] [data-testid="protein-view-highlight-labels"]`,
      '[data-testid="view-container-msa-HBB"] .MuiPaper-root:has(> button[title="Expand key"])',
    ],
    tooltip: 'hide',
    viewportWidth: VIEW_WIDTH,
    viewportHeight: 1560,
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
        entries: [{ label: HELIX.name, color: HELIX.color }],
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
        color: '#222',
        strokeWidth: 7,
        pad: 34,
        anchor: { residue: 'H:6', view: PANELS[1].view },
        fromAnchor: { residue: 'B:88', view: PANELS[1].view },
      },
      {
        type: 'text',
        text: 'Phe85 and Leu88 of the neighboring hemoglobin',
        fontSize: 24,
        maxWidth: 240,
        color: POCKET,
        leader: true,
        anchor: { residue: 'B:85', view: PANELS[2].view },
        dx: -36,
        dy: -120,
      },
    ],
  },
]
