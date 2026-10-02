// Candidates for the JBrowse 2 v5 paper's HPRC figure: the eight gbz-base
// haplotype lanes and the graph of the SAME CFH window in one view, the graph as
// the bottom track, rather than the lane stack alone.
//
// The paper uses the force layout (hprc_lanes_graph_stacked_force); the others
// differ only in the frame and the graph's layout.
import { displaySettled } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { GRAPH_DRAWN, graphTrack } from './graph-fixtures.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

const CONFIG = encodeURIComponent('https://jbrowse.org/demos/hprc/config.json')
const SEGMENTS_TRACK = 'hprc_minigraph_segments'
const LANES_TRACK = 'hprc_v2_1_gbz_lanes'

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
      height: lanesHeight,
    },
    graphTrack(SEGMENTS_TRACK, {
      layoutMode,
      paneHeight: 600,
      colorScheme: 'reference-position',
    }),
  ],
})

const BACKBONE_NODE = 's621556'
const UPSTREAM_NODE = 's621552'
const DELETION_LOCUS = 'chr1:196,810,000'

const session = (
  layoutMode: 'auto' | 'force',
  lanesHeight = 460,
  genesHeight = 70,
) =>
  sessionSpec(CONFIG, {
    views: [view(layoutMode, lanesHeight, genesHeight)],
  })

// The gbz read is a chain of range requests against two hosted files, and the
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
    anchor: { track: LANES_TRACK, locus: DELETION_LOCUS, fracY: 0.56 },
  },
  {
    type: 'text',
    text: '66.3 kb segment',
    leader: true,
    fontSize: 20,
    anchor: { graphNode: BACKBONE_NODE },
    dx: 60,
    dy: 150,
  },
  {
    type: 'text',
    text: 'upstream of the window',
    leader: true,
    fontSize: 20,
    anchor: { graphNode: UPSTREAM_NODE },
    dx: 40,
    dy: -120,
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
    url: session('force', 460, 50),
    viewportWidth: 1500,
    viewportHeight: 1410,
    ...gates,
    annotations: callouts,
  },
]
