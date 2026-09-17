// The graph drawn as a graph, for the two "reading the shape" tutorials: HPRC
// KIV-2 in pangenome_graph_reading and the mouse Nnt locus in pangenome_mouse. Every figure here is the force-directed layout,
// because that is what the pages are about: the graph view showing what a line
// cannot.
//
// Kept apart from graph-hprc.ts and graph-mouse-cattle.ts for the reason those
// two are apart: this module's subject is one plugin device across two species,
// not one species' loci.
import { sessionSpec } from '../screenshot-spec-helpers.ts'
import {
  TOOLBAR_READY,
  local,
  referencePositionColor,
} from './graph-fixtures.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

const HPRC_CONFIG = local('test_data/graphgenomeview/hprc.json')
const NONHUMAN_CONFIG = local(
  'test_data/graphgenomeview/pangenome_nonhuman.json',
)

// The label the halo overlay puts on each bubble is the click target that opens
// it. The overlay lists the biggest bubble first, so the first label in the DOM
// is the window's largest bubble whatever the window.
const FIRST_HALO_LABEL = '[data-testid="graph-bubble-halo-label"]'
const WALK_SELECT = '[data-testid="graph-walk-select"]'
const WALK_READOUT = '[data-testid="graph-walk-readout"]'
const BACK_BUTTON = '[data-testid="graph-unpop-bubble"]'

// ---------------------------------------------------------------------------
// HPRC, the LPA KIV-2 window
// ---------------------------------------------------------------------------

// The 130 kb window pangenome/hprc_lpa_kiv2 draws, which opens part 4. LPA's
// own start is in frame so the gene lane labels it.
const LPA_WINDOW = 'chr6:160,525,000-160,655,000'
const LPA_REGION = {
  refName: 'chr6',
  assemblyName: 'hg38',
  start: 160525000,
  end: 160655000,
}
// The KIV-2 bubble's own interval, which the eight-haplotype GBZ cut was made
// on, and the domain both the linear lane and the graph paint their ramp over.
const KIV2_BUBBLE_WINDOW = 'chr6:160,616,002-160,646,753'
const KIV2_BUBBLE_REGION = {
  refName: 'chr6',
  assemblyName: 'hg38',
  start: 160616002,
  end: 160646753,
}
const KIV2_GBZ_WALKS_GFA =
  'https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.kiv2.eight-haplotypes.gfa'

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

function kiv2LinearView() {
  return {
    type: 'LinearGenomeView',
    assembly: 'hg38',
    loc: LPA_WINDOW,
    tracks: [
      hg38GeneLane(70),
      hprcBubblesLane(95),
      hprcSegmentsLane(LPA_REGION),
    ],
  }
}

// The window part 4 opens on, force-directed and haloed; the popped figure
// clicks the array's label here.
const KIV2_HALOS_URL = sessionSpec(HPRC_CONFIG, {
  views: [
    kiv2LinearView(),
    {
      type: 'GraphGenomeView',
      loadedTrackId: 'hprc_minigraph_segments',
      loadedRegion: LPA_REGION,
      layoutMode: 'force',
      colorScheme: 'reference-position',
      paneHeight: 480,
    },
  ],
})

// The array's label clicked: the graph becomes the 29 segments the bubble row
// names, laid out the same way, with the button back to the window. The popped
// graph derives its own bubble from its layering, since no index row describes
// the inside of a bubble.
const kiv2PoppedSpec: ScreenshotSpec = {
  mode: 'url',
  name: 'pangenome/graph_kiv2_popped',
  url: KIV2_HALOS_URL,
  actions: [
    { type: 'delay', ms: 1500 },
    { type: 'click', selector: FIRST_HALO_LABEL },
    { type: 'waitForSelector', selector: BACK_BUTTON, timeout: 120000 },
    { type: 'waitForAppSettled' },
    { type: 'delay', ms: 4000 },
  ],
  readySelector: TOOLBAR_READY,
  readyTimeout: 120000,
  settleMs: 5000,
  viewportWidth: 1400,
  viewportHeight: 1125,
  hideTooltip: true,
  annotations: [{ type: 'box', anchor: { selector: BACK_BUTTON } }],
}

function kiv2WalksGraphView() {
  return {
    type: 'GraphGenomeView',
    displayName: 'KIV-2 from the GBZ, eight haplotypes',
    gfaLocation: { uri: KIV2_GBZ_WALKS_GFA },
    layoutMode: 'force',
    referencePath: 'GRCh38',
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
  }
}

function kiv2WalksLinearView() {
  return {
    type: 'LinearGenomeView',
    assembly: 'hg38',
    loc: KIV2_BUBBLE_WINDOW,
    tracks: [
      hg38GeneLane(40),
      hprcBubblesLane(50),
      { ...hprcSegmentsLane(KIV2_BUBBLE_REGION), height: 70 },
    ],
  }
}

// The menu item is picked by its value rather than its text, which the
// readout beside the legend repeats.
const HG00133_ITEM = 'li[data-value^="HG00133"]'

// The eight-haplotype cut of the bubble with one walk lifted: node width is how
// many of the nine walks carry a node, HG00133's route keeps its ink while the
// other haplotypes' private loops fade, and the readout states its excess over
// GRCh38, under the linear view of the same window.
const kiv2WalksSpec: ScreenshotSpec = {
  mode: 'url',
  name: 'pangenome/graph_kiv2_walks',
  url: sessionSpec(HPRC_CONFIG, {
    views: [kiv2WalksLinearView(), kiv2WalksGraphView()],
  }),
  readySelector: TOOLBAR_READY,
  readyTimeout: 240000,
  settleMs: 8000,
  viewportWidth: 1400,
  viewportHeight: 1000,
  hideTooltip: true,
  actions: [
    { type: 'click', selector: WALK_SELECT },
    { type: 'waitForSelector', selector: HG00133_ITEM },
    { type: 'click', selector: HG00133_ITEM },
    { type: 'waitForSelector', selector: WALK_READOUT },
    { type: 'delay', ms: 3000 },
  ],
  annotations: [
    { type: 'box', anchor: { selector: WALK_SELECT } },
    { type: 'box', anchor: { selector: WALK_READOUT } },
    // a kringle-copy node 60% of the way along HG00133's walk
    {
      type: 'text',
      text: 'HG00133 walks this loop',
      fontSize: 18,
      leader: true,
      anchor: { view: 1, graphNode: '165812967' },
      dx: 120,
      dy: 0,
    },
  ],
}

const kiv2WalkRowsSpec: ScreenshotSpec = {
  mode: 'url',
  name: 'pangenome/graph_kiv2_walk_rows',
  url: sessionSpec(HPRC_CONFIG, {
    views: [
      kiv2WalksLinearView(),
      { ...kiv2WalksGraphView(), layoutMode: 'walkrows', paneHeight: 300 },
    ],
  }),
  readySelector: TOOLBAR_READY,
  readyTimeout: 240000,
  viewportWidth: 1400,
  viewportHeight: 780,
  hideTooltip: true,
  actions: [{ type: 'waitForAppSettled', timeout: 180000 }],
}

// ---------------------------------------------------------------------------
// Mouse, the Dock2 intron bubble
// ---------------------------------------------------------------------------

// Nnt, the page's first locus and its control: a window whose one large allele
// is a plain insertion, so it should halo as one insertion and nothing should
// nest.
const NNT_WINDOW = 'chr13:119,440,000-119,600,000'
const NNT_REGION = {
  refName: 'chr13',
  assemblyName: 'mm39',
  start: 119440000,
  end: 119600000,
}

function mouseLinearView(loc: string, domain: { start: number; end: number }) {
  return {
    type: 'LinearGenomeView',
    assembly: 'mm39',
    loc,
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
      {
        trackId: 'mouse_minigraph_segments',
        type: 'LinearBasicDisplay',
        showLabels: 'none',
        height: 110,
        color: referencePositionColor(domain),
      },
    ],
  }
}

function mouseGraphView(region: typeof NNT_REGION, paneHeight: number) {
  return {
    type: 'GraphGenomeView',
    loadedTrackId: 'mouse_minigraph_segments',
    loadedRegion: region,
    layoutMode: 'force',
    colorScheme: 'reference-position',
    paneHeight,
  }
}

// Nnt's window haloed. C57BL/6J is the reference and carries the deletion, so
// its one large allele halos as an insertion the other strains carry, with
// nothing inside it to open. s130043141+ is that allele.
const nntHalosSpec: ScreenshotSpec = {
  mode: 'url',
  name: 'pangenome/graph_mouse_nnt_halos',
  url: sessionSpec(NONHUMAN_CONFIG, {
    views: [
      mouseLinearView(NNT_WINDOW, NNT_REGION),
      mouseGraphView(NNT_REGION, 420),
    ],
  }),
  readySelector: TOOLBAR_READY,
  readyTimeout: 300000,
  settleMs: 10000,
  viewportWidth: 1400,
  viewportHeight: 880,
  hideTooltip: true,
  annotations: [
    {
      type: 'text',
      text: 'Sequence the other strains carry and C57BL/6J lacks: its Nnt deletion',
      fontSize: 17,
      maxWidth: 330,
      leader: true,
      anchor: { view: 1, graphNode: 's130043141+' },
      dx: 160,
      dy: 40,
    },
  ],
}

export const graphReadingSpecs: ScreenshotSpec[] = [
  kiv2PoppedSpec,
  kiv2WalksSpec,
  kiv2WalkRowsSpec,
  nntHalosSpec,
]
