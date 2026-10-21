import {
  PARK_CURSOR,
  sessionSpec,
  trackMenuIcon,
} from '../screenshot-spec-helpers.ts'
import { PORTAL_CONFIG } from './genomes_pangenome.ts'
import {
  GRAPH_DRAWN,
  graphTrack,
  local,
  referencePositionColor,
} from './graph-fixtures.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

const NONHUMAN_CONFIG = local(
  'test_data/graphgenomeview/pangenome_nonhuman.json',
)

const LANES_TRACK = 'hprc_v2_1_walk_lanes'
const WALK_READOUT = '[data-testid="graph-walk-readout"]'

// The linear lane and the graph both ramp their color over this interval.
const KIV2_BUBBLE_WINDOW = 'chr6:160,616,002-160,646,753'
const KIV2_BUBBLE_REGION = {
  refName: 'chr6',
  assemblyName: 'hg38',
  start: 160616002,
  end: 160646753,
}
// The haplotypes the HPRC page config's lanes track names.
const KIV2_HAPLOTYPES = [
  'HG00097.1',
  'HG00099.1',
  'HG00128.1',
  'HG00133.1',
  'HG01109.1',
  'HG01123.1',
  'HG01960.1',
  'HG02055.1',
]

function hg38GeneLane(height: number) {
  return {
    trackId: 'hg38_ncbiRefSeq_ucsc',
    geneGlyphMode: 'longestCoding',
    displayMode: 'compact',
    height,
  }
}

function hprcBubblesLane(height: number) {
  return {
    trackId: 'hprc_minigraph_bubbles',
    type: 'LinearBasicDisplay',
    height,
  }
}

function hprcSegmentsLane(domain: { start: number; end: number }) {
  return {
    trackId: 'hprc_minigraph_segments',
    type: 'LinearBasicDisplay',
    showLabels: 'none',
    height: 100,
    color: referencePositionColor(domain),
  }
}

function kiv2WalksGraphTrack(pane: Record<string, unknown> = {}) {
  return graphTrack(LANES_TRACK, {
    subgraphHaplotypes: KIV2_HAPLOTYPES,
    layoutMode: 'force',
    color: {
      field: 'position',
      domainMin: KIV2_BUBBLE_REGION.start,
      domainMax: KIV2_BUBBLE_REGION.end,
    },
    // At proportional length the 11-105 kb private copies set the frame.
    bubbleSpread: 'compress',
    // Halos and route chips cover the loops they name.
    layers: { bubbles: false },
    paneHeight: 400,
    ...pane,
  })
}

const HG00133_ITEM = '[data-testid^="cascading-menuitem-hg00133"]'

const kiv2WalksSpec: ScreenshotSpec = {
  mode: 'url',
  name: 'pangenome/graph_kiv2_walks',
  url: sessionSpec(PORTAL_CONFIG, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc: KIV2_BUBBLE_WINDOW,
        tracks: [
          hg38GeneLane(40),
          hprcBubblesLane(50),
          { ...hprcSegmentsLane(KIV2_BUBBLE_REGION), height: 70 },
          kiv2WalksGraphTrack(),
        ],
      },
    ],
  }),
  readySelector: GRAPH_DRAWN,
  readyTimeout: 240000,
  viewportWidth: 1400,
  viewportHeight: 910,
  tooltip: 'hide',
  clicksChange: "lift HG00133's walk out of the graph",
  actions: [
    trackMenuIcon(LANES_TRACK),
    {
      type: 'hover',
      selector: '[data-testid="cascading-submenu-haplotypes"]',
    },
    { type: 'waitForSelector', selector: HG00133_ITEM },
    { type: 'click', selector: HG00133_ITEM },
    // a radio row leaves both menu levels standing
    { type: 'press', key: 'Escape' },
    { type: 'press', key: 'Escape' },
    { type: 'waitForSelector', selector: HG00133_ITEM, hidden: true },
    { type: 'click', selector: 'body' },
    PARK_CURSOR,
    { type: 'waitForSelector', selector: WALK_READOUT },
  ],
  annotations: [
    { type: 'box', anchor: { selector: WALK_READOUT } },
    {
      type: 'text',
      text: 'HG00133 walks this loop',
      fontSize: 18,
      leader: true,
      anchor: { graphNode: '165812967' },
      dx: 120,
      // under the legend stack, whose strip rows push the readout down
      dy: 80,
    },
  ],
}

// `uniform` keeps GRCh38's bar the legend's shared-sequence blue.
const kiv2WalkRowsSpec: ScreenshotSpec = {
  mode: 'url',
  name: 'pangenome/graph_kiv2_walk_rows',
  url: sessionSpec(PORTAL_CONFIG, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc: KIV2_BUBBLE_WINDOW,
        tracks: [
          hg38GeneLane(50),
          hprcBubblesLane(80),
          kiv2WalksGraphTrack({
            layoutMode: 'walkrows',
            color: 'uniform',
            subgraphHaplotypes: [],
            // At depth width GRCh38's nodes swell and thin by carriage.
            size: 12,
            paneHeight: 300,
          }),
        ],
      },
    ],
  }),
  readySelector: GRAPH_DRAWN,
  readyTimeout: 240000,
  viewportWidth: 1400,
  viewportHeight: 740,
  tooltip: 'hide',
  actions: [{ type: 'waitForAppSettled', timeout: 180000 }],
  annotations: [
    {
      type: 'box',
      anchor: { trackId: 'hprc_minigraph_bubbles', loc: KIV2_BUBBLE_WINDOW },
      pad: 3,
    },
    {
      type: 'text',
      text: 'the KIV-2 array, which each bar below walks across',
      fontSize: 18,
      maxWidth: 520,
      textAlign: 'end',
      anchor: {
        trackId: 'hprc_minigraph_bubbles',
        loc: KIV2_BUBBLE_WINDOW,
        alignX: 'right',
        fracY: 0,
        dx: -48,
        dy: 44,
      },
    },
  ],
}

const NNT_WINDOW = 'chr13:119,440,000-119,600,000'

// s130043141+ is the Nnt allele C57BL/6J lacks.
const nntHalosSpec: ScreenshotSpec = {
  mode: 'url',
  name: 'pangenome/graph_mouse_nnt_halos',
  url: sessionSpec(NONHUMAN_CONFIG, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'mm39',
        loc: NNT_WINDOW,
        tracks: [
          {
            trackId: 'mm39_ncbiRefSeq_ucsc',
            height: 48,
          },
          {
            trackId: 'mouse_minigraph_bubbles',
            type: 'LinearBasicDisplay',
            height: 52,
          },
          graphTrack('mouse_minigraph_segments', {
            layoutMode: 'force',
            color: { field: 'position' },
            paneHeight: 420,
            layers: { bubbles: true },
          }),
        ],
      },
    ],
  }),
  readySelector: GRAPH_DRAWN,
  readyTimeout: 300000,
  viewportWidth: 1400,
  viewportHeight: 830,
  tooltip: 'hide',
  annotations: [
    {
      type: 'text',
      text: 'Sequence the other strains have and C57BL/6J lacks: its Nnt deletion',
      fontSize: 17,
      maxWidth: 330,
      leader: true,
      anchor: { graphNode: 's130043141+' },
      dx: 160,
      dy: 40,
    },
  ],
}

export const graphReadingSpecs: ScreenshotSpec[] = [
  kiv2WalksSpec,
  kiv2WalkRowsSpec,
  nntHalosSpec,
]
