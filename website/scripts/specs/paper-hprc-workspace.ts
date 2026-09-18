// Candidates for the JBrowse 2 v5 paper's HPRC figure: the eight gbz-base
// haplotype lanes and the graph of the SAME CFH window in one tiled workspace,
// rather than the lane stack alone (pangenome/hprc_gbz_cfhr_lanes) or the
// two-haplotype synteny/graph pair specs/graph-hprc.ts stacks vertically
// (pangenome/hprc_cfhr_deletion).
//
// The paper uses the stacked force layout (hprc_lanes_graph_stacked_force); the
// others differ only in the split and the graph's layout.
import { displaySettled } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { GRAPH_DRAWN, referencePositionColor } from './graph-fixtures.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

const CONFIG = encodeURIComponent('https://jbrowse.org/demos/hprc/config.json')
const SEGMENTS_TRACK = 'hprc_minigraph_segments'
const LANES_TRACK = 'hprc_v2_1_gbz_lanes'

// The window pangenome/hprc_gbz_cfhr_lanes draws, so the lane half of the
// figure is the committed one and the graph is cut from the same coordinates.
const CFHR_WINDOW = 'chr1:196,640,000-196,900,000'
const CFHR_REGION = {
  refName: 'chr1',
  assemblyName: 'hg38',
  start: 196640000,
  end: 196900000,
}

// Both panels have to have finished: the lanes' display phase, the graph's
// geometry and the graph toolbar's paint. `:has()` chained is an AND, where a
// comma-separated list would be an OR that fires on whichever landed first.
const BOTH_READY = `body:has(${displaySettled('multiway-synteny-display')}):has(${GRAPH_DRAWN}) [data-testid="graph-layout-select"]`

const laneView = (lanesHeight: number, genesHeight: number) => ({
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
      trackId: SEGMENTS_TRACK,
      type: 'LinearBasicDisplay',
      showLabels: 'none',
      heightMode: 'grow',
      color: referencePositionColor(CFHR_REGION),
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
  ],
})

const GRAPH_VIEW = 'paper_cfhr_graph'

const BACKBONE_NODE = 's621556'
const BACKBONE_LOCUS = 'chr1:196,724,000'
const UPSTREAM_NODE = 's621552'
const DELETION_LOCUS = 'chr1:196,810,000'

const graphView = (layoutMode: 'auto' | 'force') => ({
  id: GRAPH_VIEW,
  type: 'GraphGenomeView',
  loadedTrackId: SEGMENTS_TRACK,
  loadedRegion: CFHR_REGION,
  layoutMode,
  colorScheme: 'reference-position',
})

const workspace = (
  layoutMode: 'auto' | 'force',
  direction: 'horizontal' | 'vertical',
  size: number,
  lanesHeight = 460,
  genesHeight = 70,
) =>
  sessionSpec(CONFIG, {
    views: [laneView(lanesHeight, genesHeight), graphView(layoutMode)],
    layout: {
      direction,
      children: [
        { views: [0], size },
        { views: [1], size: 100 - size },
      ],
    },
  })

// The gbz read is a chain of range requests against two hosted files, and the
// graph cuts its subgraph from the segments track's tabix indexes on attach.
const gates = {
  readySelector: BOTH_READY,
  readyTimeout: 240000,
  settleMs: 20000,
  hideTooltip: true,
} as const

const callouts: Annotation[] = [
  {
    type: 'text',
    text: '66.3 kb segment',
    leader: true,
    fontSize: 20,
    anchor: { track: SEGMENTS_TRACK, locus: BACKBONE_LOCUS, fracY: 0.85 },
    dx: 60,
    dy: -60,
  },
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
    anchor: { view: 1, graphNode: BACKBONE_NODE },
    dx: 60,
    dy: 150,
  },
  {
    type: 'text',
    text: 'upstream of the window',
    leader: true,
    fontSize: 20,
    anchor: { view: 1, graphNode: UPSTREAM_NODE },
    dx: 40,
    dy: -120,
  },
]

export const paperHprcWorkspaceSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'paper/hprc_lanes_graph_anchored',
    url: workspace('auto', 'horizontal', 58, 440),
    viewportWidth: 1900,
    viewportHeight: 980,
    ...gates,
  },
  {
    mode: 'url',
    name: 'paper/hprc_lanes_graph_stacked',
    url: workspace('auto', 'vertical', 68),
    viewportWidth: 1500,
    viewportHeight: 1300,
    ...gates,
  },
  {
    mode: 'url',
    name: 'paper/hprc_lanes_graph_stacked_force',
    url: workspace('force', 'vertical', 60, 460, 50),
    viewportWidth: 1500,
    viewportHeight: 1420,
    ...gates,
    annotations: callouts,
  },
]
