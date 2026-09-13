// The graph drawn as a graph, for the two "reading the shape" tutorials: HPRC
// KIV-2 in pangenome_graph_reading and the mouse Dock2 bubble in
// pangenome_graph_nested. Every figure here is the force-directed layout with
// the plugin's bubble halos on it, because that is what the pages are about:
// the graph view showing what a line cannot, with each bubble named where it
// sits in the drawing.
//
// Kept apart from graph-hprc.ts and graph-nonhuman.ts for the reason those two
// are apart: this module's subject is one plugin device across two species,
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

// The same 130 kb window pangenome/hprc_lpa_kiv2 draws, so a reader of part 1
// meets the locus they already know. LPA's own start is in frame so the gene
// lane labels it.
const LPA_WINDOW = 'chr6:160,525,000-160,655,000'
const LPA_REGION = {
  refName: 'chr6',
  assemblyName: 'hg38',
  start: 160525000,
  end: 160655000,
}
// The KIV-2 bubble's own interval, which the eight-haplotype GBZ cut was made
// on (pangenome/hprc_kiv2_gbz_walks, part 3), and the domain both the linear
// lane and the graph paint their ramp over.
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
      hprcBubblesLane(70),
      hprcSegmentsLane(LPA_REGION),
    ],
  }
}

// The window as the plugin now opens it: force-directed, seeded along the
// reference so it reads left to right under the linear view, with every bubble
// the index holds haloed along its own nodes and labelled by what it is. The
// kringle array is the knot of loops; the deletions and the insertion are the
// small halos on the backbone.
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

const kiv2HalosSpec: ScreenshotSpec = {
  mode: 'url',
  name: 'pangenome/graph_kiv2_halos',
  url: KIV2_HALOS_URL,
  readySelector: TOOLBAR_READY,
  readyTimeout: 120000,
  settleMs: 5000,
  viewportWidth: 1400,
  viewportHeight: 1020,
  hideTooltip: true,
}

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
  viewportHeight: 1100,
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
    paneHeight: 400,
  }
}

function kiv2WalksLinearView() {
  return {
    type: 'LinearGenomeView',
    assembly: 'hg38',
    loc: KIV2_BUBBLE_WINDOW,
    tracks: [
      hg38GeneLane(60),
      hprcBubblesLane(60),
      hprcSegmentsLane(KIV2_BUBBLE_REGION),
    ],
  }
}

// The eight-haplotype cut of the bubble, with walks: node width is how many of
// the nine haplotypes carry the node, so the reference is fat and each
// haplotype's private array copies are the thin loops. The array comes out as
// one bubble whose route lengths are the haplotypes' own.
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
}

// One walk lifted out, twice: HG00133, whose private copies are then the one
// full loop and whose readout states its excess over GRCh38, and GRCh38 itself,
// whose readout states the reference length and whose lift leaves every
// private loop a ghost. Side by side, so the control is in the same frame.
// The menu item is picked by its value rather than its text: the route chips
// on the drawing carry the same haplotype names, so a text match is ambiguous.
function liftWalk(sample: string) {
  const item = `li[data-value^="${sample}"]`
  return [
    { type: 'click' as const, selector: WALK_SELECT },
    { type: 'waitForSelector' as const, selector: item },
    { type: 'click' as const, selector: item },
    { type: 'waitForSelector' as const, selector: WALK_READOUT },
    { type: 'delay' as const, ms: 3000 },
  ]
}

const kiv2LiftedSpec: ScreenshotSpec = {
  mode: 'url',
  name: 'pangenome/graph_kiv2_walk_lifted',
  url: sessionSpec(HPRC_CONFIG, {
    views: [kiv2WalksGraphView()],
  }),
  readySelector: TOOLBAR_READY,
  readyTimeout: 240000,
  settleMs: 8000,
  viewportWidth: 760,
  viewportHeight: 560,
  hideTooltip: true,
  stageColumns: 2,
  stages: [
    {
      actions: liftWalk('HG00133'),
      annotations: [{ type: 'box', anchor: { selector: WALK_READOUT } }],
    },
    {
      actions: liftWalk('GRCh38'),
      annotations: [{ type: 'box', anchor: { selector: WALK_READOUT } }],
    },
  ],
}

// ---------------------------------------------------------------------------
// Mouse, the Dock2 intron bubble
// ---------------------------------------------------------------------------

// The densest bubble in the mouse graph that fits one cut
// (pangenome/mouse_dock2, pangenome_nonhuman): one index row of 524 segments
// inside a Dock2 intron.
const DOCK2_WINDOW = 'chr11:34,516,044-34,560,497'
const DOCK2_REGION = {
  refName: 'chr11',
  assemblyName: 'mm39',
  start: 34516044,
  end: 34560497,
}

// Nnt, the page's control: a window whose one large allele is a plain
// insertion, so it should halo as one insertion and nothing should nest.
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

function mouseGraphView(region: typeof DOCK2_REGION, paneHeight: number) {
  return {
    type: 'GraphGenomeView',
    loadedTrackId: 'mouse_minigraph_segments',
    loadedRegion: region,
    layoutMode: 'force',
    colorScheme: 'reference-position',
    paneHeight,
  }
}

// The whole cut, one halo: the index knows this window as a single bubble of
// 524 segments, so the halo runs along all of it and the label says superbubble.
const dock2HalosSpec: ScreenshotSpec = {
  mode: 'url',
  name: 'pangenome/graph_mouse_dock2_halos',
  url: sessionSpec(NONHUMAN_CONFIG, {
    views: [
      mouseLinearView(DOCK2_WINDOW, DOCK2_REGION),
      mouseGraphView(DOCK2_REGION, 620),
    ],
  }),
  readySelector: TOOLBAR_READY,
  readyTimeout: 300000,
  settleMs: 15000,
  viewportWidth: 1400,
  viewportHeight: 1100,
  hideTooltip: true,
}

// The superbubble opened twice. Each pop cuts the bubble's segments out of the
// graph on screen, lays them out afresh and derives the bubbles inside from the
// layering, so the second frame's halos are ones no index row ever described,
// and the third is one of those opened in turn.
function popFirst() {
  return [
    { type: 'delay' as const, ms: 1500 },
    { type: 'click' as const, selector: FIRST_HALO_LABEL },
    { type: 'waitForAppSettled' as const },
    { type: 'delay' as const, ms: 6000 },
  ]
}

const dock2PopsSpec: ScreenshotSpec = {
  mode: 'url',
  name: 'pangenome/graph_mouse_dock2_pops',
  url: sessionSpec(NONHUMAN_CONFIG, {
    views: [mouseGraphView(DOCK2_REGION, 560)],
  }),
  readySelector: TOOLBAR_READY,
  readyTimeout: 300000,
  settleMs: 15000,
  viewportWidth: 1400,
  viewportHeight: 700,
  hideTooltip: true,
  stages: [
    { actions: popFirst() },
    {
      actions: popFirst(),
      annotations: [{ type: 'box', anchor: { selector: BACK_BUTTON } }],
    },
  ],
}

// The control: Nnt's window haloed. Its one large allele is an insertion the
// other strains carry and the reference lacks, and it halos as one insertion
// with nothing inside it to open.
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
}

export const graphReadingSpecs: ScreenshotSpec[] = [
  kiv2HalosSpec,
  kiv2PoppedSpec,
  kiv2WalksSpec,
  kiv2LiftedSpec,
  dock2HalosSpec,
  dock2PopsSpec,
  nntHalosSpec,
]
