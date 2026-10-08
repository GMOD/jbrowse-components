// Candidates for the JBrowse 2 v5 paper's HPRC figure: eight haplotype lanes
// and the graph of the SAME CFH window in one view, the graph as the bottom
// track, rather than the lane stack alone.
//
// The paper uses the force layout (hprc_lanes_graph_stacked_force); the others
// differ only in the frame and the graph's layout. The lanes read the PIF of
// the same eight haplotypes' walks, unpacked offline from the release 2 GFA
// (the hprc_multiway demo's track), rather than gbz-base at view time. The
// hprc demo config has no PIF track, so it rides along as a session track and
// takes its gene gutters from that config's per-haplotype gene tracks.
import { displaySettled } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { GRAPH_DRAWN, graphTrack } from './graph-fixtures.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

const CONFIG = encodeURIComponent('https://jbrowse.org/demos/hprc/config.json')
const SEGMENTS_TRACK = 'hprc_minigraph_segments'
const LANES_TRACK = 'hprc_multiway'

const HAPLOTYPES = [
  'HG01109.1',
  'HG01123.1',
  'HG01960.1',
  'HG02055.1',
  'HG00097.1',
  'HG00099.1',
  'HG00128.1',
  'HG00133.1',
]
const PIF_ASSEMBLIES = ['hg38', ...HAPLOTYPES]
const LANES_PIF_TRACK = {
  type: 'SyntenyTrack',
  trackId: LANES_TRACK,
  name: 'HPRC haplotypes vs GRCh38 (hg38 + 8 haplotypes, unpacked from the v2.1 GFA)',
  assemblyNames: PIF_ASSEMBLIES,
  adapter: {
    type: 'MultiGenomeIndexedPAFAdapter',
    uri: 'https://jbrowse.org/demos/hprc_multiway/hprc_multiway_gfa.pif.gz',
    csi: true,
    assemblyNames: PIF_ASSEMBLIES,
    assemblyNameToPanSN: Object.fromEntries([
      ['hg38', 'GRCh38#0'],
      ...HAPLOTYPES.map(h => [h, `${h.split('.')[0]}#1`]),
    ]),
  },
}

// The window the eight-lane CFH figure drew before part 3 moved it to the HPRC
// page's launch.
const CFHR_WINDOW = 'chr1:196,640,000-196,900,000'

// Both have to have finished: the lanes' display phase and the graph's cut.
// `body:has(A) B` is an AND.
const BOTH_READY = `body:has(${displaySettled('multiway-synteny-display')}) ${GRAPH_DRAWN}`

const view = (
  layoutMode: 'auto' | 'force',
  lanesHeight: number,
  genesHeight: number,
  paneHeight = 600,
  inlineLaneNames = false,
) => ({
  type: 'LinearGenomeView',
  assembly: 'hg38',
  loc: CFHR_WINDOW,
  tracks: [
    {
      trackId: 'hg38_ncbiRefSeq_ucsc',
      type: 'LinearBasicDisplay',
      geneGlyphMode: 'longestCoding',
      displayMode: 'compact',
      height: genesHeight,
    },
    {
      trackId: LANES_TRACK,
      type: 'MultiWaySyntenyDisplay',
      rows: {
        domain: [
          'HG00097.1',
          'HG00099.1',
          'HG00128.1',
          'HG00133.1',
          'HG01109.1',
          'HG01123.1',
          'HG01960.1',
          'HG02055.1',
        ],
      },
      height: lanesHeight,
      inlineLaneNames,
    },
    graphTrack(SEGMENTS_TRACK, {
      layoutMode,
      paneHeight,
      colorScheme: 'reference-position',
    }),
  ],
})

const DELETION_NODE = 's621558'
const DELETION_LOCUS = 'chr1:196,810,000'

const session = (
  layoutMode: 'auto' | 'force',
  lanesHeight = 460,
  genesHeight = 70,
  paneHeight = 600,
  inlineLaneNames = false,
) =>
  sessionSpec(CONFIG, {
    sessionTracks: [LANES_PIF_TRACK],
    views: [
      view(layoutMode, lanesHeight, genesHeight, paneHeight, inlineLaneNames),
    ],
  })

// The lanes are range requests against the hosted PIF and its CSI, and the
// graph cuts its subgraph from the segments track's tabix indexes.
const gates = {
  readySelector: BOTH_READY,
  readyTimeout: 240000,
  hideTooltip: true,
} as const

const callouts: Annotation[] = [
  {
    type: 'text',
    text: '84.7 kb deletion',
    fontSize: 20,
    anchor: { trackId: LANES_TRACK, loc: DELETION_LOCUS, fracY: 0.56 },
  },
  {
    type: 'text',
    text: '84.7 kb deletion',
    leader: true,
    fontSize: 20,
    anchor: { graphNode: DELETION_NODE },
    dx: -230,
    dy: 95,
  },
]

export const paperHprcWorkspaceSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'paper/hprc_lanes_graph_anchored',
    url: session('auto', 440),
    viewportWidth: 1900,
    viewportHeight: 1410,
    ...gates,
  },
  {
    mode: 'url',
    name: 'paper/hprc_lanes_graph_stacked',
    url: session('auto'),
    viewportWidth: 1500,
    viewportHeight: 1430,
    ...gates,
  },
  {
    mode: 'url',
    name: 'paper/hprc_lanes_graph_stacked_force',
    url: session('force', 280, 50, 380, true),
    viewportWidth: 1500,
    viewportHeight: 1010,
    ...gates,
    annotations: callouts,
  },
]
