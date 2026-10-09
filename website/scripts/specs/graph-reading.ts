// The graph drawn as a graph: HPRC KIV-2 on pangenome_hprc_repeats and the mouse Nnt
// locus on pangenome_mouse. Every figure here is the force-directed layout.
//
// Kept apart from graph-hprc.ts and graph-mouse-cattle.ts for the reason those
// two are apart: this module's subject is one plugin device across two species,
// not one species' loci.
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

// ---------------------------------------------------------------------------
// HPRC, the LPA KIV-2 window
// ---------------------------------------------------------------------------

// The 130 kb window pangenome/hprc_lpa_kiv2 draws on pangenome_hprc_repeats. LPA's
// own start is in frame so the gene lane labels it.
// The KIV-2 bubble's interval, which the view frames, and the domain both the
// linear lane and the graph paint their ramp over.
const KIV2_BUBBLE_WINDOW = 'chr6:160,616,002-160,646,753'
const KIV2_BUBBLE_REGION = {
  refName: 'chr6',
  assemblyName: 'hg38',
  start: 160616002,
  end: 160646753,
}
// The lanes the HPRC page config's haplotypes track names, which the graph track
// cuts its walks for.
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
    type: 'LinearBasicDisplay',
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
    colorScheme: 'reference-position',
    colorDomain: KIV2_BUBBLE_REGION,
    // the private array copies are 11 kb to 105 kb of sequence each; at
    // proportional length they set the frame and the flank is a dot
    bubbleSpread: 'compress',
    // No halos or route chips (review: "so much text annotations in the
    // graphgenomeviewer itself makes it hard to see"): nine chips stacked on
    // the loops covered the drawing they named.
    showBubbles: false,
    paneHeight: 400,
    ...pane,
  })
}

// The Walk submenu names each walk by its sample, which the readout beside the
// legend repeats.
const HG00133_ITEM = '[data-testid^="cascading-menuitem-hg00133"]'

// The eight-haplotype cut of the bubble with one walk lifted: node width is how
// many of the nine walks carry a node, HG00133's route keeps its ink while the
// other haplotypes' private loops fade, and the readout states its excess over
// GRCh38, under the lanes of the same window.
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
  hideTooltip: true,
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
    { type: 'delay', ms: 3000 },
  ],
  annotations: [
    { type: 'box', anchor: { selector: WALK_READOUT } },
    // a kringle-copy node 60% of the way along HG00133's walk
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

// One color scheme: `uniform` paints the GRCh38 bar the blue the legend gives
// shared sequence, where the reference-position ramp made it the one rainbow
// row. The linear view is all of LPA, so the array reads as a stretch of it.
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
            colorScheme: 'uniform',
            subgraphHaplotypes: [],
            // GRCh38's bar is the graph's own backbone nodes, the other rows
            // are flat bars; at depth width its nodes swelled and thinned by
            // carriage
            nodeWidth: 'uniform',
            contigThickness: 12,
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
  hideTooltip: true,
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

// ---------------------------------------------------------------------------
// Mouse, the Dock2 intron bubble
// ---------------------------------------------------------------------------

// Nnt, the page's first locus and its control: a window whose one large allele
// is a plain insertion, so it should halo as one insertion and nothing should
// nest.
const NNT_WINDOW = 'chr13:119,440,000-119,600,000'

// Nnt's window haloed. C57BL/6J is the reference and carries the deletion, so
// its one large allele halos as an insertion the other strains carry, with
// nothing inside it to open. s130043141+ is that allele.
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
            type: 'LinearBasicDisplay',
            height: 48,
          },
          {
            trackId: 'mouse_minigraph_bubbles',
            type: 'LinearBasicDisplay',
            height: 52,
          },
          graphTrack('mouse_minigraph_segments', {
            layoutMode: 'force',
            colorScheme: 'reference-position',
            paneHeight: 420,
            showBubbles: true,
          }),
        ],
      },
    ],
  }),
  readySelector: GRAPH_DRAWN,
  readyTimeout: 300000,
  viewportWidth: 1400,
  viewportHeight: 830,
  hideTooltip: true,
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
