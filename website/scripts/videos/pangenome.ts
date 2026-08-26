// The graph tours, on the three pangenome pages. Three of the four shapes the
// corpus films start here: the launch ROUTE, the layout RE-LAYOUT, and the WHOLE
// SESSION that opens pangenome_hprc.
//
// Each of the three pages now has one tour that starts from a session holding
// none of the page's data, because getting a graph into JBrowse IS the
// difficulty on all three: the adapter reads four files off one prefix, so the
// file-or-URL workflow has no extension to guess an adapter from and pasting the
// config is the route. The two E. coli tours and the HPRC one walk the same four
// moves — paste, navigate, launch, read — on three different graphs.
import { menuCascade, sessionSpec } from '../screenshot-spec-helpers.ts'
import {
  PGGB_SEGMENTS_TRACK_JSON,
  pggbVideoFixtures,
} from '../specs/graph-ecoli.ts'
import { GRAPH_DRAWN, TOOLBAR_READY } from '../specs/graph-fixtures.ts'
import {
  HPRC_SEGMENTS_TRACK_JSON,
  TOUR_MHC_LOCUS,
  TOUR_NODE,
  hprcClusterFixtures,
  hprcTourSession,
} from '../specs/graph-hprc.ts'
import { cactusVideoFixtures } from '../specs/pangenome_cactus.ts'
import { LOCATION_BOX, displayReady, trackMenu } from './shared.ts'

import type { VideoSpec, VideoStep } from '../video-spec-types.ts'

const {
  config: PGGB_CONFIG,
  genesTrack,
  segmentsTrack,
  segmentsTrackId,
  locusWindow,
  tourWindow: PGGB_TOUR_WINDOW,
  rowsLocus,
  rowsWindow,
  locusSession,
  pangenomeConfig: PGGB_PANGENOME_CONFIG,
  strainLaunchNode: PGGB_STRAIN_NODE,
  tierTrack: PGGB_TIER_TRACK_CONF,
  tierTrackId: PGGB_TIER_TRACK,
  tierWindow: PGGB_TIER_WINDOW,
  tierRegion: PGGB_TIER_REGION,
  tierIs5Node: PGGB_TIER_IS5_NODE,
  tierLaneColor: PGGB_TIER_LANE_COLOR,
} = pggbVideoFixtures

// The graph alone, on the five-assembly config, which is the state a reader is
// in when they have a subgraph open and want the donor rather than a projection
// of it. Pinned by id so the menu clicks scope to the graph rather than to the
// linear view the launch adds under it.
const pggbGraphOnly = sessionSpec(PGGB_PANGENOME_CONFIG, {
  sessionTracks: [segmentsTrack],
  views: [
    {
      id: 'pggb_launch_graph',
      type: 'GraphGenomeView',
      loadedTrackId: segmentsTrackId,
      loadedRegion: rowsLocus,
      layoutMode: 'force',
      colorScheme: 'stable-rank',
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
// of a subgraph and a sentence naming the menu path that cuts one.
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

// BOTH TIERS OVER ONE WINDOW, which is the state the section's "read together"
// sentence describes and has no picture of. 100 kb is 60x what the fine index
// can draw, so the segments lane opens on its own density gate while the tier
// lane draws eleven bubbles and the pane below draws them as a graph -- and the
// tour's whole move is getting the linear view from the first state to the
// second without a coordinate being typed.
//
// The tier lane carries pggb_bubble_tier's own ramp over the same region, so the
// bubble the figure arrows keeps its colour when the tour lands on it, and the
// still and the clip are one window rather than two.
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
        // Tall enough for the too-large banner the lane opens with, which is a
        // row of text and a Force load button rather than the one row of blocks
        // it holds once the tour has landed.
        {
          trackId: segmentsTrackId,
          type: 'LinearBasicDisplay',
          showLabels: 'none',
          height: 70,
        },
      ],
    },
    {
      type: 'GraphGenomeView',
      loadedTrackId: PGGB_TIER_TRACK,
      loadedRegion: PGGB_TIER_REGION,
      // 'auto' IS the anchored layout, and it is the figure's: a tier is a chain
      // of backbone and bubble, so there is no shape for a force solver to find
      // and an anchored row puts each bubble under its own coordinate.
      layoutMode: 'auto',
      colorScheme: 'reference-position',
    },
  ],
})

// The layout dropdown's own row, which is the same element in every graph view.
const LAYOUT_SELECT = '[data-testid="graph-layout-select"]'

// What the HPRC tour drives, named here because a menu label and a testid read
// as noise inline and each has a reason to be the one it is.
const SEGMENTS_TRACK = 'hprc_minigraph_segments'
const PASTE_WORKFLOW = 'Add track from pasted JSON'
const PASTE_BOX = 'textarea[placeholder^="Paste track config"]'
const HIGHLIGHT_ITEM = 'Highlight in hg38'

// GETTING A GRAPH INTO A SESSION, which is the opening of all three graph tours
// and one route rather than three: **File → Open track... → Add track from
// pasted JSON**, the config, **Submit**. Written once so the three pages cannot
// document three different ways in, which is the failure a reader hits hardest
// -- following a route on one page and finding the labels renamed on the next.
//
// It ends AT Submit rather than after it: `finishAddTrack` dismisses the widget
// itself, so the drawer closing is the app's answer, and what to wait on for the
// track landing is the caller's own display id.
function pasteTrackSteps(json: string): VideoStep[] {
  return [
    { type: 'click', text: 'File', say: 'File', hold: 700 },
    { type: 'waitForText', text: 'Open track...' },
    { type: 'click', text: 'Open track...', say: 'Open track...' },
    { type: 'waitForText', text: 'Enter track data' },
    // The workflow select, by the option it is showing. Only one element
    // carries that text until the menu opens, and by then the item this clicks
    // next is the only one carrying its own.
    {
      type: 'click',
      text: 'Add a track from file or URL',
      say: 'Choose how to add a track',
      hold: 700,
    },
    { type: 'waitForText', text: PASTE_WORKFLOW },
    { type: 'click', text: PASTE_WORKFLOW, say: PASTE_WORKFLOW },
    { type: 'waitForSelector', selector: PASTE_BOX },
    // OFF CAMERA, because what a reader does here is paste. `type` sends the
    // config a keystroke at a time through a controlled MUI field, which is both
    // slower than a paste and a different action from the one being documented;
    // cutting it leaves the box empty, then full, which is what pasting looks
    // like. The caption from the step above stands through it.
    { type: 'type', selector: PASTE_BOX, value: json, cut: true },
    // the filled box, held long enough to be read as the page's own block
    { type: 'delay', ms: 2600 },
    { type: 'click', text: 'Submit', say: 'Submit' },
  ]
}

// NARROWING BY TYPING, which every paste tour does next and none of them could
// skip. The drawer took ~400 px off the linear view while it was open and an LGV
// keeps its bp-per-pixel across a resize, so the window standing once the widget
// dismisses is wider than the one the session opened at -- and a launch reads
// `dynamicBlocks`, so without this the cut is whatever the drawer left behind.
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

// THE LAUNCH, off the segments lane's own menu: the cascade whose existence is
// the point of indexing the graph this way, since the item appears for any track
// whose adapter can cut a subgraph and needs no graph track in the view.
function launchGraphSteps(trackId: string): VideoStep[] {
  return [
    {
      type: 'click',
      selector: trackMenu(trackId),
      say: 'Track menu',
      hold: 700,
    },
    { type: 'waitForText', text: 'Launch' },
    { type: 'click', text: 'Launch', say: 'Launch', hold: 700 },
    { type: 'waitForText', text: 'Graph genome view (this region)' },
    {
      type: 'click',
      text: 'Graph genome view (this region)',
      say: 'Graph genome view (this region)',
    },
  ]
}
const GENES_READY = displayReady('hg38_ncbiRefSeq_ucsc-LinearBasicDisplay')
const SEGMENTS_READY = displayReady(`${SEGMENTS_TRACK}-LinearBasicDisplay`)
// The two E. coli pages open on K12's genes and nothing else, and each waits on
// its own pasted lane afterwards. A pasted config with no `displayId` gets
// `<trackId>-<displayType>` (packages/core/src/util/tracks.ts), which is the one
// id both a bare config and a `displayDefaults` one land on.
const K12_GENES_READY = displayReady('K12_genes-LinearBasicDisplay')
const PGGB_SEGMENTS_READY = displayReady(
  `${segmentsTrackId}-LinearBasicDisplay`,
)
const CACTUS_SEGMENTS_READY = displayReady(
  `${cactusVideoFixtures.segmentsTrackId}-LinearBasicDisplay`,
)
// Sample rows have arrived: the labels, not just the toolbar, since the layout
// runs after the graph loads and the toolbar is up before there is a row to
// label.
const ROWS_DRAWN = `body:has([data-testid="graph-row-label"]) ${LAYOUT_SELECT}`
// And the force drawing has replaced them. TOOLBAR_READY cannot say this on a
// pane that was already drawn: `data-geometry-vertices` is non-empty from the
// sample-rows layout onwards, so it is satisfied the instant the dropdown is
// picked. The row labels going away is the re-layout itself.
const FORCE_DRAWN = `body:has(${GRAPH_DRAWN}):not(:has([data-testid="graph-row-label"])) ${LAYOUT_SELECT}`

export const pangenomeVideos: VideoSpec[] = [
  // THE ROUTE, FROM NOTHING. Every graph pane in pangenome_ecoli.md was cut this
  // way and the page can only say so in a sentence; this is the sentence
  // happening, from a session that does not have the graph yet.
  //
  // It used to start with the segments lane already in the view and film the
  // launch alone, which left the step before it — the one a reader is actually
  // stuck on, since nothing in the file-or-URL workflow can produce this track —
  // as a fence on the page and nothing more. The launch is still the payoff and
  // the clip still ends on the graph, so the last thing in the frame is the
  // thing the route is for.
  {
    name: 'pangenome/pggb_subgraph_launch',
    description:
      "A pggb graph from a K12 session that has none of it: paste the page's track config, narrow to the IS5 element, and cut the window on screen as a subgraph",
    url: pggbTourStart,
    // Sized to the state the tour ENDS in, which is the linear view plus the
    // graph pane the launch adds: the run reports 276px of app at the first
    // frame and 1103px at the last, and a video has one frame for both. The
    // page background over that first number is the cost of filming a launch,
    // and it is the cheaper half of the trade — a frame sized to the opening
    // cuts the graph the tour exists to show.
    //
    // It grew by 50px when the tour started pasting the track rather than
    // opening with it: a pasted config takes the display's default height where
    // the old session pinned the lane at 50, and pinning it back would mean a
    // `displays` array in the fence a reader copies.
    viewportHeight: 1110,
    // The gene lane, since it is the only thing in the opening session. The
    // track menu this tour used to gate on belongs to a track that does not
    // exist yet.
    readySelector: K12_GENES_READY,
    readyTimeout: 120000,
    settleMs: 3000,
    steps: [
      ...pasteTrackSteps(PGGB_SEGMENTS_TRACK_JSON),
      {
        type: 'waitForSelector',
        selector: PGGB_SEGMENTS_READY,
        timeout: 180000,
        cut: true,
      },
      // the lane the fence produced, at the width it was pasted at: a base-level
      // graph is a node every ~17 bp, so what arrives is a mat, and that is the
      // reason the next step is a narrowing rather than a launch
      { type: 'delay', ms: 2600 },
      ...navigateSteps(locusWindow),
      {
        type: 'waitForSelector',
        selector: PGGB_SEGMENTS_READY,
        timeout: 120000,
      },
      { type: 'delay', ms: 1800 },
      ...launchGraphSteps(segmentsTrackId),
      {
        type: 'waitForSelector',
        selector: TOOLBAR_READY,
        timeout: 120000,
        cut: true,
      },
      { type: 'delay', ms: 2000 },
    ],
    tailMs: 2500,
  },
  // THE SAME ROUTE ON THE OTHER BUILDER, and the only tour on pangenome_cactus.
  // That page walks a reader through `cactus-pangenome`, six linear projections
  // and an offline index, and then hands them a figure of a subgraph with one
  // sentence naming the menu path that cuts one.
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
      "The Minigraph-Cactus graph into an empty K12 session and back out as a subgraph: paste the page's track config, narrow to the IS1 element past flhD, and launch the graph view",
    url: cactusTourStart,
    // Same trade as the pggb tour above, and the same numbers: the run reports
    // 276px of app at the first frame and 1103px at the last, because the two
    // tours build the same three things at the same default heights and the
    // graph pane fills what is left.
    viewportHeight: 1110,
    readySelector: K12_GENES_READY,
    readyTimeout: 120000,
    settleMs: 3000,
    steps: [
      ...pasteTrackSteps(cactusVideoFixtures.segmentsTrackJson),
      {
        type: 'waitForSelector',
        selector: CACTUS_SEGMENTS_READY,
        timeout: 180000,
        cut: true,
      },
      { type: 'delay', ms: 2600 },
      ...navigateSteps(cactusVideoFixtures.locusWindow),
      {
        type: 'waitForSelector',
        selector: CACTUS_SEGMENTS_READY,
        timeout: 120000,
      },
      { type: 'delay', ms: 1800 },
      ...launchGraphSteps(cactusVideoFixtures.segmentsTrackId),
      {
        type: 'waitForSelector',
        selector: TOOLBAR_READY,
        timeout: 120000,
        cut: true,
      },
      { type: 'delay', ms: 2000 },
    ],
    tailMs: 2500,
  },
  // THE LADDER, which the page states in one sentence and pictures at neither
  // end: `pggb_bubble_tier` is the coarse still, `pggb_subgraph_launch` ends on
  // the fine cut, and how a reader gets from one to the other is nowhere.
  //
  // The move is the NODE'S OWN MENU. A tier node knows the K12 span it stands
  // for, and `showInLinearView` navigates the CONNECTED linear view rather than
  // adding one -- with a single K12 view in the session the plugin pairs with it
  // by assembly -- so the whole route is a hover and two clicks, and the reader
  // never types a coordinate. That is also why this is not a second filming of
  // `pggb_subgraph_launch`: no paste, no location box, no launch.
  //
  // THE OPENING FRAME IS THE DENSITY GATE ON PURPOSE, which is the one place
  // that message is the state the page describes rather than an accident: the
  // section is titled "when the window is wider than the graph can draw", and
  // 100 kb of a graph cut every ~17 bp is 60x the fine index's own width. The
  // tour navigates IN, and the banner going away is what the last step waits on.
  {
    name: 'pangenome/tier_to_fine',
    description:
      "The coarse tier's IS5 bubble taken down to the fine index: hover the node for the K12 span it collapses, then take its Open in K12 entry, which lands the linear view on that span",
    url: pggbTierStart,
    // The app is the same height at both ends -- the tour navigates a view
    // rather than adding one, and the anchored pane sizes to its two rank rows
    // whatever the window says -- so this is a frame with slack in it rather
    // than a compromise between two states. The slack is for the caption chip,
    // which is fixed off the frame's bottom and would otherwise sit over the
    // graph pane's own rows.
    viewportHeight: 810,
    readySelector: TOOLBAR_READY,
    readyTimeout: 120000,
    // Long, because the opening frame has to have SETTLED INTO its banner: the
    // segments lane measures the fetch it is refusing, and a shorter settle
    // films an empty lane that fills with a warning a second later.
    settleMs: 9000,
    steps: [
      // the pointer off the overview's cytoband strip, where the camera parks it
      { type: 'hover', selector: '[aria-label="JBrowse"]' },
      // The graph's own tooltip, which is the page's "hover a node for the
      // segments it collapsed" sentence happening -- and the hover also syncs a
      // band into the linear view above, so the frame says where in the 100 kb
      // the bubble is before anything has been clicked.
      {
        type: 'hover',
        anchor: { view: 1, graphNode: PGGB_TIER_IS5_NODE },
        say: 'Hover the bubble',
        hold: 3200,
      },
      {
        type: 'rightclick',
        anchor: { view: 1, graphNode: PGGB_TIER_IS5_NODE },
        say: 'Right-click the bubble',
        hold: 900,
      },
      { type: 'waitForText', text: 'Open in K12' },
      {
        type: 'click',
        text: 'Open in K12',
        say: 'Open in K12 — around this node',
      },
      // The banner going away is the app's own answer, and the display's ready
      // phase is not: a gated display reports ready while it is refusing to
      // fetch, so waiting on that alone would put the camera back on the lane
      // before it had drawn a block.
      {
        type: 'waitForText',
        text: 'Too many features',
        hidden: true,
        timeout: 120000,
      },
      {
        type: 'waitForSelector',
        selector: PGGB_SEGMENTS_READY,
        timeout: 120000,
      },
      // the pointer off the canvas, or the graph's hover tooltip stands over the
      // frame the poster is taken from
      { type: 'hover', selector: '[aria-label="JBrowse"]' },
      { type: 'delay', ms: 2500 },
    ],
    tailMs: 3000,
  },
  // THE RE-LAYOUT, on the 460 bp the page draws both ways. The still pair is
  // pangenome/pggb_locus_sample_rows; what it cannot carry is that the two
  // drawings are the same nodes, which is the whole of what the dropdown does.
  //
  // IT ENDS ON THE FORCE DRAWING, and it used to switch back. The two states
  // are 440px apart and one frame has to hold both, so whichever one the clip
  // is left standing in is the one the tail and the poster carry: switching
  // back put a third of every ending frame under page background. Ending on
  // the taller state moves that slack to the OPENING, where it is four seconds
  // rather than the tail's six and a half and is not the frame the poster comes
  // from — the trade pggb_subgraph_launch and pggb_out_to_strain above already
  // take on this page. Seeing the correspondence twice was not worth the poster.
  {
    name: 'pangenome/pggb_layout_switch',
    description:
      'The same 460 bp of the pggb graph in both layouts: sample rows through the Layout dropdown to force-directed',
    url: locusSession('samplerows', {
      region: rowsLocus,
      window: rowsWindow,
      mafLane: true,
    }),
    // Sized to the FORCE drawing, which is the state the tour ends in: the run
    // reports 802px of app in sample rows at the first frame and 1242px at the
    // last. The drawing is a backbone with the alternate routes hanging off it
    // and it uses every one of those pixels, so this is not a frame to give
    // back — a viewport sized to the opening cuts the payoff in half.
    viewportHeight: 1250,
    readySelector: ROWS_DRAWN,
    readyTimeout: 120000,
    settleMs: 5000,
    steps: [
      // The pointer off the overview's cytoband strip, where the camera parks
      // it: the view writes the position under the pointer into its own title
      // bar, and the opening frame carried a coordinate chip for a locus 1.3 Mb
      // from anywhere this tour goes.
      { type: 'hover', selector: '[aria-label="JBrowse"]' },
      // the rows held still long enough to be read against the MAF lane above
      // them, which is what the paragraph before the embed is about
      { type: 'delay', ms: 2500 },
      { type: 'click', selector: LAYOUT_SELECT, say: 'Layout', hold: 800 },
      { type: 'waitForText', text: 'Force-directed layout' },
      {
        type: 'click',
        text: 'Force-directed layout',
        say: 'Force-directed layout',
      },
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
  // THE WHOLE PAGE IN ONE SESSION. Every other tour here starts in an app that
  // already has the data; this one starts in hg38 with its genes and nothing
  // else, and the first thing it does is put HPRC's graph into the session
  // through the form a reader would use.
  //
  // It opens pangenome_hprc rather than sitting in the section it illustrates,
  // and it is the only clip on that page: the sections it walks through are
  // "Load the graph", "Open a locus as a graph", "The Layout dropdown" and
  // "From a node back to a coordinate", which is most of the page's working
  // route. A second clip of the Layout dropdown alone stood in that third
  // section until this one existed, and it was the same subgraph making the
  // same move a screen further down.
  {
    name: 'pangenome/hprc_end_to_end',
    description:
      "HPRC release 2's graph from a pasted track config to an allele read off the drawing: paste, navigate, cut a subgraph, anchor it, and take one node back to its GRCh38 interval",
    url: hprcTourSession(),
    // Sized to the FORCE drawing, which is the tour's tallest state and neither
    // of its ends. The run reports 276px of app at the first frame (one gene
    // lane), 1103px at its tallest, and 723px at the last, because the anchored
    // layout the tour finishes in is seven rank rows where the force pane takes
    // the plugin's whole MAX_CANVAS_HEIGHT.
    //
    // The pane is not a free parameter here the way it is in a figure: the
    // graph view is created by the menu item, so nothing in this spec can write
    // the `paneHeight` a session snapshot can. So the choice is a frame with
    // page background under its short states or a frame that clips the force
    // drawing, and the drawing is what the launch was filmed for.
    viewportHeight: 1120,
    readySelector: GENES_READY,
    readyTimeout: 120000,
    settleMs: 4000,
    steps: [
      ...pasteTrackSteps(HPRC_SEGMENTS_TRACK_JSON),
      // Submit dismisses the widget itself (finishAddTrack), so the drawer
      // closing is the app's answer rather than a step.
      {
        type: 'waitForSelector',
        selector: SEGMENTS_READY,
        timeout: 180000,
        cut: true,
      },
      { type: 'delay', ms: 2600 },
      ...navigateSteps(TOUR_MHC_LOCUS),
      {
        type: 'waitForSelector',
        selector: SEGMENTS_READY,
        timeout: 180000,
      },
      { type: 'delay', ms: 1800 },
      ...launchGraphSteps(SEGMENTS_TRACK),
      {
        type: 'waitForSelector',
        selector: TOOLBAR_READY,
        timeout: 180000,
        cut: true,
      },
      { type: 'delay', ms: 2500 },
      // The re-layout, on the human graph: every x becomes a GRCh38 coordinate,
      // so each allele drops under the place it attaches and the drawing lines
      // up with the segments lane above it.
      { type: 'click', selector: LAYOUT_SELECT, say: 'Layout', hold: 800 },
      { type: 'waitForText', text: 'Anchored' },
      { type: 'click', text: 'Anchored', say: 'Anchored' },
      {
        type: 'waitForSelector',
        selector: TOOLBAR_READY,
        timeout: 180000,
        cut: true,
      },
      { type: 'delay', ms: 2500 },
      // And back to a coordinate. The node is NAMED rather than pointed at, so
      // a cut that comes back different fails the run instead of right-clicking
      // empty canvas. What the item writes into the linear view is the
      // reference segment this allele attaches across, not the allele's own
      // length — which is why the clip ends holding both panes.
      {
        type: 'rightclick',
        anchor: { view: 1, graphNode: TOUR_NODE },
        say: 'Right-click a node',
        hold: 900,
      },
      { type: 'waitForText', text: HIGHLIGHT_ITEM },
      { type: 'click', text: HIGHLIGHT_ITEM, say: HIGHLIGHT_ITEM },
      { type: 'delay', ms: 2000 },
    ],
    // THE FORCE DRAWING, not the last frame. A poster is what a reader sees
    // before pressing play, and the default (the state the tour ends in) is the
    // anchored layout, which fills two thirds of a frame sized for the pane
    // above it — so the still standing in for the whole tour would be a strip
    // of app over page background. This is the clip's own fullest frame, in the
    // seconds between the launch landing and the Layout dropdown opening.
    posterAt: 30,
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
      "A CFT073 allele opened on CFT073's own coordinates: right-click the node, take its Open in entry, and read the deletion from the donor's side",
    url: pggbGraphOnly,
    // Sized to the state the tour ENDS in: the graph pane plus the linear view
    // the launch adds under it. The run reports 736px of app at the first frame
    // and 994px at the last, so the opening state carries page background under
    // it — the cost of filming a launch, the same trade pggb_subgraph_launch
    // takes and for the same reason.
    viewportHeight: 1000,
    readySelector: TOOLBAR_READY,
    readyTimeout: 120000,
    settleMs: 8000,
    steps: [
      {
        type: 'rightclick',
        anchor: { view: 0, graphNode: PGGB_STRAIN_NODE },
        say: 'Right-click the CFT073 allele',
        hold: 900,
      },
      { type: 'waitForText', text: 'Open in CFT073' },
      { type: 'click', text: 'Open in CFT073', say: 'Open in CFT073' },
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
    settleMs: 8000,
    steps: [
      {
        type: 'click',
        selector: trackMenu(hprcClusterFixtures.trackId),
        say: 'Track menu',
        hold: 700,
      },
      ...menuCascade(['Clustering', 'Cluster rows by genotype...']),
      {
        type: 'click',
        text: 'Cluster rows by genotype...',
        say: 'Clustering → Cluster rows by genotype...',
      },
      { type: 'waitForText', text: 'Run clustering' },
      { type: 'delay', ms: 1500 },
      { type: 'click', text: 'Run clustering', say: 'Run clustering' },
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
