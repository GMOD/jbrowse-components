// Candidates for the JBrowse 2 v5 paper's HPRC figure, which uses
// hprc_lanes_graph_stacked_force: eight haplotype lanes, read from the graph's
// walk file, and the graph of the same CFH window in one view.
import { displaySettled } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { GRAPH_DRAWN, graphTrack } from './graph-fixtures.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

// The hprc demo config, its graph plugin pinned at 10.6.0, which draws the paper's figure.
const CONFIG = 'test_data/graphgenomeview/paper_hprc.json'
const SEGMENTS_TRACK = 'hprc_minigraph_segments'
const LANES_TRACK = 'hprc_v2_1_walk_lanes'

const CFHR_WINDOW = 'chr1:196,640,000-196,900,000'

// Both have to have finished: the lanes' display phase and the graph's cut.
// `body:has(A) B` is an AND.
const BOTH_READY = `body:has(${displaySettled('multiway-synteny-display')}) ${GRAPH_DRAWN}`

const view = (
  layoutMode: 'auto' | 'force',
  lanesHeight: number,
  genesHeight: number,
  paneHeight = 600,
  lanePlacement: 'above' | 'overlay' = 'above',
) => ({
  type: 'LinearGenomeView',
  assembly: 'hg38',
  loc: CFHR_WINDOW,
  tracks: [
    {
      trackId: 'hg38_ncbiRefSeq_ucsc',
      geneGlyphMode: 'representative',
      displayMode: 'compact',
      height: genesHeight,
    },
    {
      trackId: LANES_TRACK,
      type: 'MultiWaySyntenyDisplay',
      rows: {
        sort: [
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
      labels: { lanes: { placement: lanePlacement } },
      legend: { show: false },
    },
    graphTrack(SEGMENTS_TRACK, {
      layoutMode,
      layoutEngine: 'stress',
      paneHeight,
      encoding: { color: { field: 'position' } },
      layers: { lengths: true },
      key: 'overlay',
      extent: 'view',
    }),
  ],
})

// The backbone segment the 84.7 kb deletion rejoins. s621558, where it leaves,
// merges into its neighbours when the cut folds.
const DELETION_NODE = 's621574'
// left of the deletion's middle, so the label centres in the lanes' gap
const DELETION_LOCUS = 'chr1:196,778,000'

const session = (
  layoutMode: 'auto' | 'force',
  lanesHeight = 460,
  genesHeight = 70,
  paneHeight = 600,
  lanePlacement: 'above' | 'overlay' = 'above',
) =>
  sessionSpec(CONFIG, {
    views: [
      view(layoutMode, lanesHeight, genesHeight, paneHeight, lanePlacement),
    ],
  })

// The lanes are range requests against the hosted walk file, and the graph
// cuts its subgraph from the segments track's tabix indexes.
const gates = {
  readySelector: BOTH_READY,
  readyTimeout: 240000,
  tooltip: 'hide',
} as const

const CALLOUT_FONT = 18

const callouts: Annotation[] = [
  {
    type: 'text',
    text: '84.7 kb deletion',
    fontSize: CALLOUT_FONT,
    anchor: { trackId: LANES_TRACK, loc: DELETION_LOCUS, fracY: 0.75 },
  },
  {
    type: 'text',
    text: '84.7 kb deletion',
    fontSize: CALLOUT_FONT,
    anchor: { graphNode: DELETION_NODE, alignX: 'left', alignY: 'top' },
    dx: -270,
    dy: -130,
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
    url: session('force', 280, 50, 416, 'overlay'),
    // the paper prints it at its full text width
    viewportWidth: 930,
    viewportHeight: 1046,
    hideSelectors: ['[data-testid="graph-layout-switch"]'],
    ...gates,
    annotations: callouts,
  },
]
