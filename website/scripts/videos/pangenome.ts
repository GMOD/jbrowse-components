// The graph tours, on the pangenome pages: the ROUTE that turns a segments
// lane into the graph, the layout RE-LAYOUT, and the HPRC browse page's route
// from the HPRC page itself.
//
// The two E. coli pages each have one tour that starts from a session holding
// none of the page's data, because getting a graph into JBrowse IS the
// difficulty there: the adapter reads four files off one prefix, so the
// file-or-URL workflow has no extension to guess an adapter from and pasting the
// config is the route. The HPRC browse page starts where its reader does, on
// the hosted page's launch.
import { menuCascade, sessionSpec } from '../screenshot-spec-helpers.ts'
import { HPRC_PAGE, MHC_GRAPH_LINK } from '../specs/genomes_pangenome.ts'
import {
  PGGB_SEGMENTS_TRACK_JSON,
  pggbVideoFixtures,
} from '../specs/graph-ecoli.ts'
import { GRAPH_DRAWN, graphCutDrawn } from '../specs/graph-fixtures.ts'
import { hprcClusterFixtures, hprcVideoFixtures } from '../specs/graph-hprc.ts'
import { cactusVideoFixtures } from '../specs/pangenome_cactus.ts'
import { LOCATION_BOX, cascade, displayReady, trackMenu } from './shared.ts'

import type { VideoSpec, VideoStep } from '../video-spec-types.ts'

const {
  config: PGGB_CONFIG,
  genesTrack,
  segmentsTrack,
  segmentsTrackId,
  locusWindow,
  tourWindow: PGGB_TOUR_WINDOW,
  rowsWindow,
  rowsLocus,
  locusSession,
  pangenomeConfig: PGGB_PANGENOME_CONFIG,
  strainLaunchNode: PGGB_STRAIN_NODE,
  strainGraph: PGGB_STRAIN_GRAPH,
  tierTrack: PGGB_TIER_TRACK_CONF,
  tierTrackId: PGGB_TIER_TRACK,
  tierWindow: PGGB_TIER_WINDOW,
  tierCut: PGGB_TIER_CUT,
  tierIs5Node: PGGB_TIER_IS5_NODE,
  tierLaneColor: PGGB_TIER_LANE_COLOR,
} = pggbVideoFixtures

// The graph alone, on the five-assembly config, which is the state a reader is
// in when they have a subgraph open and want the donor rather than a projection
// of it: the node menu offers only assemblies the session has.
const pggbStrainStart = sessionSpec(PGGB_PANGENOME_CONFIG, {
  sessionTracks: [segmentsTrack],
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'K12',
      loc: rowsWindow,
      tracks: [PGGB_STRAIN_GRAPH],
    },
  ],
})

// K12 with its genes and nothing of the graph, 20 kb out from the IS5 element:
// the state a reader of `### Browsing the whole graph by locus` is in before the
// page's fence has gone anywhere.
//
// The segments track is ABSENT rather than hidden, and it has to be:
// `doPasteConfigSubmit` rejects a `trackId` the session already holds rather
// than merging it, so a tour filmed against the figures' session could not add
// the track the figures use. What that buys back is the live link, which then
// opens the empty session instead of the finished one, so a reader who has
// watched the route can walk it.
const pggbTourStart = sessionSpec(PGGB_CONFIG, {
  sessionTracks: [genesTrack],
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'K12',
      loc: PGGB_TOUR_WINDOW,
      tracks: [
        { trackId: 'K12_genes', type: 'LinearBasicDisplay', height: 70 },
      ],
    },
  ],
})

// The same shape on the Minigraph-Cactus graph, which is the whole of what
// pangenome_cactus had no tour for: the page's graph section ended on a figure
// of a subgraph and a sentence naming the menu path that draws one.
const cactusTourStart = sessionSpec(cactusVideoFixtures.config, {
  sessionTracks: [cactusVideoFixtures.genesTrack],
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'K12',
      loc: cactusVideoFixtures.tourWindow,
      tracks: [
        { trackId: 'K12_genes', type: 'LinearBasicDisplay', height: 70 },
      ],
    },
  ],
})

// BOTH TIERS OVER ONE WINDOW. At 100 kb the graph track is past its segments
// track's `coarse` handover, so it draws the tier the track names, one node per
// bubble, under the tier lane of the same bubbles. The tour's whole move is
// zooming the linear view in without a coordinate being typed, and the graph
// re-cutting from the segments once it passes the handover.
//
// The tier lane carries pggb_bubble_tier's own ramp over the same region, and
// the graph's ramp is pinned to it, so the bubble the figure arrows keeps its
// colour when the tour lands on it, and the still and the clip are one window
// rather than two.
const pggbTierStart = sessionSpec(PGGB_CONFIG, {
  sessionTracks: [genesTrack, PGGB_TIER_TRACK_CONF, segmentsTrack],
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'K12',
      loc: PGGB_TIER_WINDOW,
      tracks: [
        { trackId: 'K12_genes', type: 'LinearBasicDisplay', height: 70 },
        {
          trackId: PGGB_TIER_TRACK,
          type: 'LinearBasicDisplay',
          showLabels: 'none',
          height: 50,
          color: PGGB_TIER_LANE_COLOR,
        },
        PGGB_TIER_CUT,
      ],
    },
  ],
})

const {
  haplotype: HAPLOTYPE,
  haplotypeNode: HAPLOTYPE_NODE,
  launchedZoomOut,
  c4Window: HPRC_C4_WINDOW,
  mhcWindow: HPRC_MHC_WINDOW,
} = hprcVideoFixtures

// What the add-track tours drive, named here because a menu label and a testid read
// as noise inline and each has a reason to be the one it is.
const GRAPH_WORKFLOW = 'Add pangenome graph track'
const URL_INPUT = '[data-testid="urlInput"]'
const SAMPLE_INPUT = '[data-testid="graph-sample-input"]'
const TRACK_NAME_INPUT = '[data-testid="graph-track-name-input"]'
const HIGHLIGHT_ITEM = 'Highlight in hg38'
const HAPLOTYPE_GENES_LABEL = 'CAT genes (NA20809 haplotype 2, HPRC release 2)'
const WORDMARK = '[aria-label="JBrowse"]'

// GETTING A GRAPH INTO A SESSION, which is the opening of both E. coli graph
// tours and one route rather than two: **File → Open track... → Add pangenome
// graph track**, the form, **Submit**. Written once so the two pages cannot
// document two different ways in, which is the failure a reader hits hardest
// -- following a route on one page and finding the labels renamed on the next.
//
// Every field is read off the page's own fence (check-paste-configs holds the
// two texts together), so what the tour types is what the page prints.
//
// It ends AT Submit rather than after it: `finishAddTrack` dismisses the widget
// itself, so the drawer closing is the app's answer, and what to wait on for the
// track landing is the caller's own display id.
function addGraphTrackSteps(json: string): VideoStep[] {
  const conf = JSON.parse(json) as {
    name: string
    assemblyNames: string[]
    adapter: { uri: string; assemblyNameToPanSN?: Record<string, string> }
  }
  const sample = conf.adapter.assemblyNameToPanSN?.[conf.assemblyNames[0]!]
  return [
    {
      type: 'click',
      text: 'File',
      say: 'Add the graph track from Open track...',
      hold: 700,
    },
    { type: 'waitForText', text: 'Open track...' },
    { type: 'click', text: 'Open track...' },
    { type: 'waitForText', text: 'Enter track data' },
    // The workflow select, by the option it is showing. Only one element
    // carries that text until the menu opens, and by then the item this clicks
    // next is the only one carrying its own.
    {
      type: 'click',
      text: 'Add a track from file or URL',
      hold: 700,
    },
    { type: 'waitForText', text: GRAPH_WORKFLOW },
    { type: 'click', text: GRAPH_WORKFLOW },
    { type: 'waitForSelector', selector: URL_INPUT },
    {
      type: 'type',
      selector: URL_INPUT,
      value: `${conf.adapter.uri}.segs.bed.gz`,
    },
    ...(sample
      ? [{ type: 'type', selector: SAMPLE_INPUT, value: sample } as VideoStep]
      : []),
    {
      type: 'type',
      selector: TRACK_NAME_INPUT,
      value: conf.name,
      clear: true,
    },
    // the filled form, held long enough to be read against the page's own block
    { type: 'delay', ms: 2000 },
    { type: 'click', text: 'Submit' },
  ]
}

// NARROWING BY TYPING, which every form tour does next and none of them could
// skip. The drawer took ~400 px off the linear view while it was open and an LGV
// keeps its bp-per-pixel across a resize, so the window standing once the widget
// dismisses is wider than the one the session opened at -- and the graph cuts
// the view's window, so without this the cut is whatever the drawer left behind.
function navigateSteps(window: string): VideoStep[] {
  return [
    {
      type: 'type',
      selector: LOCATION_BOX,
      value: window,
      clear: true,
      say: window,
    },
    { type: 'press', key: 'Enter' },
    { type: 'delay', ms: 1500 },
  ]
}

// A radio row of the graph's own menu leaves the cascade standing over the
// drawing it changed. One click on the root menu's backdrop takes every level,
// and the wordmark then blurs the menu icon, whose tooltip outlives the menu.
const leaveTheMenu = (row: string): VideoStep[] => [
  { type: 'click', selector: '.MuiBackdrop-root', hold: 0 },
  { type: 'waitForSelector', selector: row, hidden: true },
  { type: 'click', selector: WORDMARK, hold: 0 },
  { type: 'waitForText', text: 'Track settings', hidden: true },
]

// The two E. coli pages open on K12's genes and nothing else, and each waits on
// its own pasted lane afterwards. A pasted config with no `displayId` gets
// `<trackId>-<displayType>` (packages/core/src/util/tracks.ts), which is the one
// id both a bare config and a `displayDefaults` one land on.
const K12_GENES_READY = displayReady('K12_genes-LinearBasicDisplay')
// Sample rows have arrived: the labels, since the layout runs after the cut
// lands and a row needs its label.
const ROWS_DRAWN = `body:has([data-testid="graph-row-label"]) ${GRAPH_DRAWN}`
// And the force drawing has replaced them: the row labels going away is the
// re-layout itself.
const FORCE_LAYOUT_ROW = cascade('menuitem', 'Force-directed layout')
const FORCE_DRAWN = `body:not(:has([data-testid="graph-row-label"])) [data-testid="linear-graph-display"][data-layout="force"][data-node-count]`

export const pangenomeVideos: VideoSpec[] = [
  // THE ROUTE, FROM NOTHING. Every graph in pangenome_ecoli.md is drawn this
  // way and the page can only say so in a sentence; this is the sentence
  // happening, from a session that does not have the graph yet: the track added
  // through the graph form, the window narrowed, the lane redrawn as the graph.
  {
    name: 'pangenome/pggb_subgraph_launch',
    description:
      "A pggb graph from a K12 session that has none of it: add the page's track through the graph form, which opens as the graph of the window, then narrow to the IS5 element and it cuts again",
    url: pggbTourStart,
    // The frame of the clip on the page, which was filmed through the
    // standalone graph view; re-size it off the run's content report when
    // the tour is re-filmed.
    viewportHeight: 1110,
    // The gene lane, since it is the only thing in the opening session.
    readySelector: K12_GENES_READY,
    readyTimeout: 120000,
    steps: [
      ...addGraphTrackSteps(PGGB_SEGMENTS_TRACK_JSON),
      {
        type: 'waitForSelector',
        selector: GRAPH_DRAWN,
        timeout: 180000,
        cut: true,
      },
      { type: 'hover', selector: WORDMARK, hold: 0 },
      {
        type: 'delay',
        ms: 2600,
        say: 'The track opens as the graph of the window',
      },
      ...navigateSteps(locusWindow),
      { type: 'waitForAppSettled', timeout: 120000, cut: true },
      {
        type: 'waitForSelector',
        selector: GRAPH_DRAWN,
        timeout: 120000,
      },
      { type: 'hover', selector: WORDMARK, hold: 0 },
      {
        type: 'delay',
        ms: 2000,
        say: 'Narrowed to the IS5 element, it cuts again',
      },
    ],
    tailMs: 2500,
  },
  // THE SAME ROUTE ON THE OTHER BUILDER, and the only tour on pangenome_cactus.
  // That page walks a reader through `cactus-pangenome`, six linear projections
  // and an offline index, and then hands them a figure of a subgraph with one
  // sentence naming the menu path that draws one.
  //
  // Filmed on the IS1 element past flhD, which is the locus the page's own graph
  // figure is taken at, so the clip and the figure are one window: K12 carries
  // the element and the other four strains take the edge past it. A
  // Minigraph-Cactus graph caps a segment at 1024 bp, so that private stretch
  // arrives as ONE node rather than the chain a pggb cut of the same event draws
  // — which is the difference between the two pages, arriving as a picture.
  {
    name: 'pangenome_cactus/subgraph_launch',
    description:
      "The Minigraph-Cactus graph into an empty K12 session and out as a graph: add the page's track through the graph form, which opens as the graph of the window, then narrow to the IS1 element past flhD and it cuts again",
    url: cactusTourStart,
    // The frame of the clip on the page, which was filmed through the
    // standalone graph view; re-size it off the run's content report when
    // the tour is re-filmed.
    viewportHeight: 1110,
    readySelector: K12_GENES_READY,
    readyTimeout: 120000,
    steps: [
      ...addGraphTrackSteps(cactusVideoFixtures.segmentsTrackJson),
      {
        type: 'waitForSelector',
        selector: GRAPH_DRAWN,
        timeout: 180000,
        cut: true,
      },
      { type: 'hover', selector: WORDMARK, hold: 0 },
      {
        type: 'delay',
        ms: 2600,
        say: 'The track opens as the graph of the window',
      },
      ...navigateSteps(cactusVideoFixtures.locusWindow),
      { type: 'waitForAppSettled', timeout: 120000, cut: true },
      {
        type: 'waitForSelector',
        selector: GRAPH_DRAWN,
        timeout: 120000,
      },
      { type: 'hover', selector: WORDMARK, hold: 0 },
      {
        type: 'delay',
        ms: 2000,
        say: 'Narrowed to the IS1 element, it cuts again',
      },
    ],
    tailMs: 2500,
  },
  // THE LADDER, which the page states in one sentence and pictures at neither
  // end: `pggb_bubble_tier` is the coarse still, `pggb_subgraph_launch` ends on
  // the fine cut, and how a reader gets from one to the other is nowhere.
  //
  // The move is the NODE'S OWN MENU. A tier node knows the K12 span it stands
  // for, and its `Open in K12` navigates the linear view the graph is a track
  // of, so the whole route is a hover and two clicks, and the reader never types
  // a coordinate. Once the zoom passes the segments track's `coarse` handover
  // the graph re-cuts from the segments. That is also why this is not a second
  // filming of `pggb_subgraph_launch`: no paste, no location box, no display
  // switch.
  {
    name: 'pangenome/tier_to_fine',
    description:
      "The coarse tier's IS5 bubble taken down to the segments: hover the node for the K12 span it collapses, then take its Open in K12 entry, which lands the linear view on that span while the graph re-cuts from the segments",
    url: pggbTierStart,
    // The frame of the clip on the page, which was filmed through the
    // standalone graph view; re-size it off the run's content report when
    // the tour is re-filmed.
    viewportHeight: 810,
    readySelector: graphCutDrawn('coarse'),
    readyTimeout: 120000,
    steps: [
      // the pointer off the overview's cytoband strip, where the camera parks it
      { type: 'hover', selector: WORDMARK },
      // The graph's own tooltip, which is the page's "hover a node for the
      // segments it collapsed" sentence happening -- and the hover also syncs a
      // band into the lanes above, so the frame says where in the 100 kb the
      // bubble is before anything has been clicked.
      {
        type: 'hover',
        anchor: { graphNode: PGGB_TIER_IS5_NODE },
        say: 'Hover a node for the segments it collapses',
        hold: 3200,
      },
      {
        type: 'rightclick',
        anchor: { graphNode: PGGB_TIER_IS5_NODE },
        say: "Open the bubble's span in the linear view",
        hold: 900,
      },
      { type: 'waitForText', text: 'Open in K12' },
      { type: 'click', text: 'Open in K12' },
      {
        type: 'waitForSelector',
        selector: graphCutDrawn('fine'),
        timeout: 120000,
      },
      { type: 'waitForAppSettled', timeout: 120000, cut: true },
      // the pointer off the canvas, or the graph's hover tooltip stands over the
      // frame the poster is taken from
      { type: 'hover', selector: WORDMARK },
      {
        type: 'delay',
        ms: 2500,
        say: 'Zoomed past the handover, the graph re-cuts from the segments',
      },
    ],
    tailMs: 3000,
  },
  // THE RE-LAYOUT, on the 460 bp pangenome/pggb_locus_sample_rows draws in
  // Sample rows. The clip carries what a still cannot: that the force drawing
  // is the same nodes, which is the whole of what the Layout menu does.
  //
  // IT ENDS ON THE FORCE DRAWING. The two states differ in height and one frame
  // has to hold both, so whichever one the clip is left standing in is the one
  // the tail and the poster carry: ending on the taller state moves the slack to
  // the OPENING, which is not the frame the poster comes from.
  {
    name: 'pangenome/pggb_layout_switch',
    description:
      "The same 460 bp of the pggb graph in both layouts: sample rows through the graph track's Layout menu to force-directed",
    url: locusSession('samplerows', {
      region: rowsLocus,
      window: rowsWindow,
      mafLane: true,
    }),
    // The frame of the clip on the page, which was filmed through the
    // standalone graph view; re-size it off the run's content report when
    // the tour is re-filmed.
    viewportHeight: 1250,
    readySelector: ROWS_DRAWN,
    readyTimeout: 120000,
    steps: [
      // The pointer off the overview's cytoband strip, where the camera parks
      // it: the view writes the position under the pointer into its own title
      // bar, and the opening frame carried a coordinate chip for a locus 1.3 Mb
      // from anywhere this tour goes.
      { type: 'hover', selector: WORDMARK },
      // the rows held still long enough to be read against the MAF lane above
      // them, which is what the paragraph before the embed is about
      { type: 'delay', ms: 2500 },
      {
        type: 'click',
        selector: trackMenu(segmentsTrackId),
        say: 'Re-lay the same rows out with the force engine',
        hold: 800,
      },
      { type: 'waitForSelector', selector: cascade('submenu', 'Layout') },
      { type: 'click', selector: cascade('submenu', 'Layout'), hold: 800 },
      { type: 'waitForSelector', selector: FORCE_LAYOUT_ROW },
      { type: 'click', selector: FORCE_LAYOUT_ROW, hold: 800 },
      ...leaveTheMenu(FORCE_LAYOUT_ROW),
      {
        type: 'waitForSelector',
        selector: FORCE_DRAWN,
        timeout: 120000,
        cut: true,
      },
      // long enough for the simulation to settle before the tail freezes on it,
      // since the last repaints of a run never reach the file
      { type: 'delay', ms: 3500 },
    ],
    tailMs: 3000,
  },
  // THE BROWSE PAGE'S ROUTE, from the HPRC page itself. The graph launch is a
  // target="_blank" link, so the tour follows it into the new tab and films the
  // session it opens: one linear view whose bottom track is the graph, re-cut as
  // the view goes to C4 and out to the bubble tier over the whole chromosome,
  // then back to MHC class II and one allele taken out to the haplotype that
  // contributed it.
  {
    name: 'pangenome/hprc_browse',
    description:
      'HPRC release 2 from its genomes.jbrowse.org page: the HLA / MHC graph launch, the graph track re-cut as the view goes to C4 and out to the bubble tier across chromosome 6, and one allele highlighted in hg38 and opened on the haplotype that contributed it',
    url: HPRC_PAGE,
    noSession: true,
    readyText: 'Whole chromosome',
    readyTimeout: 120000,
    viewportHeight: 1110,
    steps: [
      {
        type: 'hover',
        selector: MHC_GRAPH_LINK,
        say: 'Press graph on the HLA / MHC row',
        hold: 1500,
      },
      { type: 'click', selector: MHC_GRAPH_LINK, opensTab: true },
      {
        type: 'waitForSelector',
        selector: GRAPH_DRAWN,
        timeout: 240000,
        cut: true,
      },
      { type: 'hover', selector: WORDMARK, hold: 0 },
      {
        type: 'delay',
        ms: 3000,
        say: 'MHC class II, the graph anchored under the lanes',
      },
      {
        type: 'type',
        selector: LOCATION_BOX,
        value: HPRC_C4_WINDOW,
        clear: true,
        say: 'Type the C4 window, and the graph re-cuts',
      },
      { type: 'press', key: 'Enter' },
      { type: 'waitForAppSettled', timeout: 180000, cut: true },
      { type: 'hover', selector: WORDMARK, hold: 0 },
      { type: 'delay', ms: 3000, say: 'C4, cut again under the lanes' },
      {
        type: 'type',
        selector: LOCATION_BOX,
        value: 'chr6',
        clear: true,
        say: 'Out to the whole chromosome',
      },
      { type: 'press', key: 'Enter' },
      {
        type: 'waitForSelector',
        selector: graphCutDrawn('coarse'),
        timeout: 240000,
        cut: true,
      },
      { type: 'waitForAppSettled', timeout: 240000, cut: true },
      { type: 'hover', selector: WORDMARK, hold: 0 },
      {
        type: 'delay',
        ms: 3500,
        say: 'Chromosome 6 from the bubble tier, one node per bubble',
      },
      {
        type: 'type',
        selector: LOCATION_BOX,
        value: HPRC_MHC_WINDOW,
        clear: true,
        say: 'Back to MHC class II',
      },
      { type: 'press', key: 'Enter' },
      {
        type: 'waitForSelector',
        selector: graphCutDrawn('fine'),
        timeout: 180000,
        cut: true,
      },
      { type: 'waitForAppSettled', timeout: 180000, cut: true },
      { type: 'hover', selector: WORDMARK, hold: 0 },
      { type: 'delay', ms: 2500, say: 'The segments again' },
      {
        type: 'rightclick',
        anchor: { graphNode: HAPLOTYPE_NODE },
        say: 'Right-click the allele under HLA-DRB5',
        hold: 900,
      },
      { type: 'waitForText', text: HIGHLIGHT_ITEM },
      { type: 'click', text: HIGHLIGHT_ITEM },
      { type: 'delay', ms: 2500 },
      {
        type: 'rightclick',
        anchor: { graphNode: HAPLOTYPE_NODE },
        say: 'Now open it on the haplotype that contributed it',
        hold: 900,
      },
      { type: 'waitForText', text: `Open in ${HAPLOTYPE}` },
      { type: 'click', text: `Open in ${HAPLOTYPE}` },
      // The hosted app publishes no display phase, so the new view's own track
      // label is the gate, and hovering it brings the view into frame.
      {
        type: 'waitForText',
        text: HAPLOTYPE_GENES_LABEL,
        timeout: 180000,
        cut: true,
      },
      { type: 'hover', text: HAPLOTYPE_GENES_LABEL, hold: 0 },
      { type: 'delay', ms: 4000, cut: true },
      { type: 'hover', selector: WORDMARK, hold: 0 },
      {
        type: 'delay',
        ms: 2500,
        say: 'NA20809 haplotype 2, on its own chromosome 6',
      },
      ...launchedZoomOut(6).map((step, i) =>
        i === 0 ? { ...step, say: 'Zoom out for its neighbours' } : step,
      ),
      { type: 'hover', selector: WORDMARK, hold: 0 },
      { type: 'delay', ms: 3000 },
    ],
    tailMs: 3500,
  },
  // OUT OF THE GRAPH AND INTO THE STRAIN, which is the one route on the pggb
  // page whose result is a different assembly. pangenome/pggb_strain_launch is
  // the still, and it can only put the before and the after side by side; what
  // it cannot show is that the second view came out of the first one's node.
  //
  // The node menu is FLAT — `Node details`, then one `Open in <assembly>` row
  // per assembly the session carries. There is no `Launch` cascade on a
  // node, which is the thing the page used to say and the reason this tour is
  // worth more than the sentence it replaces: a reader hunting for a submenu
  // that is not there gives up on the route entirely.
  {
    name: 'pangenome/pggb_out_to_strain',
    description:
      "A CFT073 allele opened on CFT073's own coordinates: right-click the node in the graph track, take its Open in entry, and read the deletion from the donor's side",
    url: pggbStrainStart,
    // Sized to the state the tour ENDS in: the graph's view plus the linear
    // view the launch adds under it, so the opening state carries page
    // background under it. Re-measure off the run's content report.
    viewportHeight: 1000,
    readySelector: GRAPH_DRAWN,
    readyTimeout: 120000,
    steps: [
      {
        type: 'rightclick',
        anchor: { graphNode: PGGB_STRAIN_NODE },
        say: 'Open this allele on the CFT073 assembly',
        hold: 900,
      },
      { type: 'waitForText', text: 'Open in CFT073' },
      { type: 'click', text: 'Open in CFT073' },
      // Gate on the launched view's own gene lane, not on a delay: the launch
      // carries the session's annotation for the assembly it opens, and the
      // whole point of the clip is that CFT073 arrives carrying its own genes.
      {
        type: 'waitForText',
        text: 'CFT073 genes',
        timeout: 120000,
        cut: true,
      },
      { type: 'delay', ms: 3000 },
    ],
    tailMs: 3500,
  },
  // THE CALLSET REORDERING ITSELF. `## The variant callset` ends by saying that
  // clustering gathers the haplotypes carrying an allele into a block, and the
  // page has no picture of the move — the figure that shows the result
  // (maf_hprc_pangenome) arrives already clustered, so the block reads as a
  // property of the data rather than as something the reader asks for.
  //
  // 464 rows through an RPC is the heaviest thing filmed here, which is what the
  // long timeouts and the `cut` are for. The filter is already on the lane: the
  // tour's move is the clustering, and driving Edit filters too would mean
  // guessing at a dialog no spec drives yet.
  {
    name: 'pangenome/hprc_cluster_callset',
    description:
      "HPRC's 464 haplotypes clustered by genotype from the track menu, so the carriers of the MHC class II deletion gather into one block",
    url: hprcClusterFixtures.session,
    // The lane is a fixed 340 px and clustering adds a dendrogram beside it
    // rather than under it, so this tour is the rare one whose app height does
    // not move: the run reports 739px at the first frame, the last and its
    // tallest alike. 700 clipped the callset's bottom rows.
    viewportHeight: 750,
    readySelector: hprcClusterFixtures.ready,
    readyTimeout: 360000,
    steps: [
      {
        type: 'click',
        selector: trackMenu(hprcClusterFixtures.trackId),
        say: 'Cluster the 464 haplotypes by genotype',
        hold: 700,
      },
      ...menuCascade(['Clustering', 'Cluster rows by genotype...']),
      {
        type: 'click',
        text: 'Cluster rows by genotype...',
      },
      { type: 'waitForText', text: 'Run clustering' },
      { type: 'delay', ms: 1500 },
      { type: 'click', text: 'Run clustering' },
      // The dialog closing says the run started; the dendrogram says it landed.
      // Waiting on the first alone would put the camera back on a lane that has
      // not reordered yet.
      {
        type: 'waitForSelector',
        selector: hprcClusterFixtures.clustered,
        timeout: 360000,
        cut: true,
      },
      { type: 'delay', ms: 3000 },
    ],
    tailMs: 4000,
  },
]
