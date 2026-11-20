import { PARK_CURSOR, sessionSpec } from '../screenshot-spec-helpers.ts'
import { PORTAL_CONFIG } from './genomes_pangenome.ts'
import {
  GRAPH_DRAWN,
  graphTrack,
  local,
  referencePositionColor,
} from './graph-fixtures.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

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
    geneGlyphMode: 'representative',
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
    labels: { name: { show: false }, description: { show: false } },
    height: 100,
    encoding: { color: { value: referencePositionColor(domain) } },
  }
}

function kiv2WalksGraphTrack(pane: Record<string, unknown> = {}) {
  return graphTrack(LANES_TRACK, {
    subgraphHaplotypes: KIV2_HAPLOTYPES,
    layoutMode: 'force',
    encoding: {
      color: {
        field: 'position',
        scale: {
          domainMin: KIV2_BUBBLE_REGION.start,
          domainMax: KIV2_BUBBLE_REGION.end,
        },
      },
    },
    // At proportional length the 11-105 kb private copies set the frame.
    bubbleSpread: 'compress',
    // Halos and route chips cover the loops they name.
    layers: { bubbles: false },
    paneHeight: 400,
    ...pane,
  })
}

// GRCh38 and two of the lanes track's haplotypes; of the three, HG00133 has
// the most sequence off GRCh38's path.
const KIV2_THREADS = [
  'GRCh38#0#chr6',
  'HG00097#1#JBIRDD010000043.1',
  'HG00133#1#CM090050.1',
]

const threads = (walks: string[]) => walks.map(walk => ({ walk }))

// The key's button that lists the haplotypes to highlight.
const HAPLOTYPE_BUTTON: Annotation[] = [
  {
    type: 'box',
    pad: 2,
    anchor: { selector: '[data-testid="graph-haplotype-switch"]' },
  },
]

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
          kiv2WalksGraphTrack({
            walkLayers: threads(KIV2_THREADS),
            heightMode: 'fit',
            paneHeight: 520,
          }),
        ],
      },
    ],
  }),
  readySelector: GRAPH_DRAWN,
  readyTimeout: 240000,
  viewportWidth: 1400,
  viewportHeight: 1010,
  tooltip: 'hide',
  actions: [{ type: 'waitForSelector', selector: WALK_READOUT }, PARK_CURSOR],
  annotations: HAPLOTYPE_BUTTON,
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

const C4_WINDOW = 'chr6:31,980,000-32,050,000'
// GRCh38 and two of the lanes track's haplotypes. In the walk file both skip
// chr6:32,017,404-32,023,863, the HERV-K in C4B, and HG00128 alone walks
// 26.4 kb the other two do not, a third C4-CYP21-TNX module.
const C4_THREADS = [
  'GRCh38#0#chr6',
  'HG00128#1#CM090080.1',
  'HG00133#1#CM090050.1',
]
const C4_MATRIX_ROWS = ['HG00128 HP1', 'HG00133 HP1']

// The Graph launch's variant matrix, narrowed to the highlighted haplotypes.
function c4MatrixRows() {
  return {
    trackId: 'hprc2_wave_grch38',
    rows: { field: 'haplotype', kept: C4_MATRIX_ROWS, sort: C4_MATRIX_ROWS },
    height: 130,
  }
}

function c4ThreadsSpec(
  name: string,
  viewportHeight: number,
  pane: Record<string, unknown>,
  annotations?: Annotation[],
): ScreenshotSpec {
  return {
    mode: 'url',
    name,
    url: sessionSpec(PORTAL_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: C4_WINDOW,
          tracks: [
            hg38GeneLane(60),
            c4MatrixRows(),
            graphTrack(LANES_TRACK, {
              layoutMode: 'force',
              walkLayers: threads(C4_THREADS),
              ...pane,
            }),
          ],
        },
      ],
    }),
    readySelector: GRAPH_DRAWN,
    readyTimeout: 240000,
    viewportWidth: 1400,
    viewportHeight,
    tooltip: 'hide',
    actions: [{ type: 'waitForAppSettled', timeout: 180000 }, PARK_CURSOR],
    ...(annotations ? { annotations } : {}),
  }
}

const c4WalkThreadsSpec = c4ThreadsSpec(
  'pangenome/hprc_c4_threads',
  962,
  { heightMode: 'fit', paneHeight: 480 },
  HAPLOTYPE_BUTTON,
)

const c4WalkPanelsSpec = c4ThreadsSpec('pangenome/hprc_c4_panels', 1022, {
  facet: 'walk',
  paneHeight: 540,
})

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
  c4WalkThreadsSpec,
  c4WalkPanelsSpec,
  kiv2WalkRowsSpec,
  nntHalosSpec,
]
