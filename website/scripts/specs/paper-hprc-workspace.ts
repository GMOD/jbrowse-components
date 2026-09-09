// Candidates for the JBrowse 2 v5 paper's HPRC figure: the eight gbz-base
// haplotype lanes and the graph of the SAME CFH window in one tiled workspace,
// rather than the lane stack alone (pangenome/hprc_gbz_cfhr_lanes) or the
// two-haplotype synteny/graph pair specs/graph-hprc.ts stacks vertically
// (pangenome/hprc_cfhr_deletion).
//
// Three arrangements, differing only in the split and the graph's layout, so
// the paper can pick: side by side with the Bandage force layout, side by side
// with the anchored one, and stacked, where the graph's backbone sits under the
// lanes' own x axis on the same coordinates.
import { displaySettled } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { GRAPH_DRAWN, referencePositionColor } from './graph-fixtures.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

const CONFIG = encodeURIComponent('https://jbrowse.org/demos/hprc/config.json')
const SEGMENTS_TRACK = 'hprc_minigraph_segments'

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

const laneView = (lanesHeight: number) => ({
  type: 'LinearGenomeView',
  assembly: 'hg38',
  loc: CFHR_WINDOW,
  tracks: [
    {
      trackId: 'hg38_ncbiRefSeq_ucsc',
      type: 'LinearBasicDisplay',
      geneGlyphMode: 'longestCoding',
      displayMode: 'compact',
      height: 70,
    },
    {
      trackId: SEGMENTS_TRACK,
      type: 'LinearBasicDisplay',
      showLabels: 'none',
      heightMode: 'grow',
      color: referencePositionColor(CFHR_REGION),
    },
    {
      trackId: 'hprc_v2_1_gbz_lanes',
      type: 'MultiWaySyntenyDisplay',
      rowOrder: [
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
// The force layout's fit is on the node bounding box, and the size labels hang
// outside it, so "84.7 kb deletion" — the one edge the caption names — lands
// under the pane's left border at the fitted scale. One zoom-out brings it in.
const GRAPH_ZOOM_OUT = `[data-testid="view-container-${GRAPH_VIEW}"] [aria-label="Zoom out"]`

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
) =>
  sessionSpec(CONFIG, {
    views: [laneView(lanesHeight), graphView(layoutMode)],
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

export const paperHprcWorkspaceSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'paper/hprc_lanes_graph_force',
    url: workspace('force', 'horizontal', 60),
    viewportWidth: 1900,
    viewportHeight: 940,
    ...gates,
    actions: [
      { type: 'click', selector: GRAPH_ZOOM_OUT },
      { type: 'waitForAppSettled', timeout: 60000 },
      // The mouse stays where it clicked, so the button keeps its hover
      // background in the capture. Park it on the blank page below the graph
      // pane, where nothing reacts to a pointer.
      {
        type: 'hover',
        anchor: {
          selector: `[data-testid="view-container-${GRAPH_VIEW}"]`,
          alignX: 'center',
          alignY: 'bottom',
          dy: -30,
        },
      },
    ],
  },
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
    url: workspace('force', 'vertical', 55),
    viewportWidth: 1500,
    viewportHeight: 1600,
    ...gates,
  },
]
