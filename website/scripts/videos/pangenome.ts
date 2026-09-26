// The graph tours, on the pangenome pages: the launch ROUTE, the layout
// RE-LAYOUT, and the HPRC browse page's route from the HPRC page itself.
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
import { GRAPH_DRAWN, TOOLBAR_READY } from '../specs/graph-fixtures.ts'
import { hprcClusterFixtures, hprcVideoFixtures } from '../specs/graph-hprc.ts'
import { cactusVideoFixtures } from '../specs/pangenome_cactus.ts'
import { LOCATION_BOX, RUBBERBAND, displayReady, trackMenu } from './shared.ts'

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
  tierLgvId: PGGB_TIER_LGV,
  tierCut: PGGB_TIER_CUT,
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

// BOTH TIERS OVER ONE WINDOW. 100 kb is 60x what the fine index can draw, so
// the segments lane opens on its own density gate, the tier lane draws eleven
// bubbles, and the graph below follows the linear view on the tier the
// segments track names under `coarse`. The tour's whole move is zooming the
// linear view in without a coordinate being typed, and the graph re-cutting
// from the segments as it follows.
//
// The tier lane carries pggb_bubble_tier's own ramp over the same region, so the
// bubble the figure arrows keeps its colour when the tour lands on it, and the
// still and the clip are one window rather than two.
const pggbTierStart = sessionSpec(PGGB_CONFIG, {
  sessionTracks: [genesTrack, PGGB_TIER_TRACK_CONF, segmentsTrack],
  views: [
    {
      type: 'LinearGenomeView',
      id: PGGB_TIER_LGV,
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
      ...PGGB_TIER_CUT,
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
const FOLLOW_STATUS = '[data-testid="graph-follow-status"]'

const {
  haplotype: HAPLOTYPE,
  haplotypeNode: HAPLOTYPE_NODE,
  haplotypeGenesDisplay: HAPLOTYPE_GENES_DISPLAY,
  launchedZoomOut,
  c4Window: HPRC_C4_WINDOW,
  mhcWindow: HPRC_MHC_WINDOW,
  tierSession,
  tierGraphViewId: TIER_GRAPH_VIEW,
  mhcBubbleNode: MHC_BUBBLE,
  segmentsTrackName: SEGMENTS_TRACK_NAME,
  mhcSelection: MHC_SELECTION,
} = hprcVideoFixtures

// What the add-track tours drive, named here because a menu label and a testid read
// as noise inline and each has a reason to be the one it is.
const GRAPH_WORKFLOW = 'Add pangenome graph track'
const URL_INPUT = '[data-testid="urlInput"]'
const SAMPLE_INPUT = '[data-testid="graph-sample-input"]'
const TRACK_NAME_INPUT = '[data-testid="graph-track-name-input"]'
const HIGHLIGHT_ITEM = 'Highlight in hg38'

// The form mints the trackId from the name (`makeTrackId`: the slug plus a
// timestamp), so a tour finds the track it added by the slug alone.
function formTrackSlug(json: string) {
  const { name } = JSON.parse(json) as { name: string }
  return name.trim().toLowerCase().replaceAll(' ', '_')
}

const formTrackMenu = (json: string) =>
  `[data-testid="track_menu_icon"][data-trackid^="${formTrackSlug(json)}-"]`

const formDisplayReady = (json: string) =>
  `[data-display-id^="${formTrackSlug(json)}-"][data-display-id$="-LinearBasicDisplay"][data-display-phase="ready"]`

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
function launchGraphSteps(menu: string): VideoStep[] {
  return [
    {
      type: 'click',
      selector: menu,
      say: 'Cut the window on screen out as a subgraph',
      hold: 700,
    },
    { type: 'waitForText', text: 'Launch' },
    { type: 'click', text: 'Launch', hold: 700 },
    { type: 'waitForText', text: 'Graph genome view (this region)' },
    {
      type: 'click',
      text: 'Graph genome view (this region)',
    },
  ]
}
const GENES_READY = displayReady('hg38_ncbiRefSeq_ucsc-LinearBasicDisplay')
const PGGB_FORM_READY = formDisplayReady(PGGB_SEGMENTS_TRACK_JSON)
const CACTUS_FORM_READY = formDisplayReady(
  cactusVideoFixtures.segmentsTrackJson,
)
// The two E. coli pages open on K12's genes and nothing else, and each waits on
// its own pasted lane afterwards. A pasted config with no `displayId` gets
// `<trackId>-<displayType>` (packages/core/src/util/tracks.ts), which is the one
// id both a bare config and a `displayDefaults` one land on.
const K12_GENES_READY = displayReady('K12_genes-LinearBasicDisplay')
const PGGB_SEGMENTS_READY = displayReady(
  `${segmentsTrackId}-LinearBasicDisplay`,
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
// A SECOND graph pane has drawn. The tier tour opens with the tier pane
// already drawn, so GRAPH_DRAWN is satisfied before the fine cut exists; each
// view's container carries its id, and the tier pane's is pinned by the spec,
// so the new pane is the drawn one that is not it.
const FINE_GRAPH_DRAWN = `[data-testid^="view-container-"]:not([data-testid="view-container-${TIER_GRAPH_VIEW}"]) ${GRAPH_DRAWN}`
// The rubberband's `Graph genome view (this selection)` is a submenu here, one
// entry per track that can cut the window, because the session holds two: the
// tier the pane above was cut from and the fine index. Both by testid, since
// the segments track's name is also its lane's label in the view above.
const SELECTION_SUBMENU =
  '[data-testid="cascading-submenu-graph_genome_view_(this_selection)"]'
const SELECTION_FINE_ENTRY = `[data-testid="cascading-menuitem-${SEGMENTS_TRACK_NAME.toLowerCase().replaceAll(/\s+/g, '_')}"]`

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
      "A pggb graph from a K12 session that has none of it: add the page's track through the graph form, narrow to the IS5 element, and cut the window on screen as a subgraph",
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
    steps: [
      ...addGraphTrackSteps(PGGB_SEGMENTS_TRACK_JSON),
      {
        type: 'waitForSelector',
        selector: PGGB_FORM_READY,
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
        selector: PGGB_FORM_READY,
        timeout: 120000,
      },
      { type: 'delay', ms: 1800 },
      ...launchGraphSteps(formTrackMenu(PGGB_SEGMENTS_TRACK_JSON)),
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
      "The Minigraph-Cactus graph into an empty K12 session and back out as a subgraph: add the page's track through the graph form, narrow to the IS1 element past flhD, and launch the graph view",
    url: cactusTourStart,
    // Same trade as the pggb tour above, and the same numbers: the run reports
    // 276px of app at the first frame and 1103px at the last, because the two
    // tours build the same three things at the same default heights and the
    // graph pane fills what is left.
    viewportHeight: 1110,
    readySelector: K12_GENES_READY,
    readyTimeout: 120000,
    steps: [
      ...addGraphTrackSteps(cactusVideoFixtures.segmentsTrackJson),
      {
        type: 'waitForSelector',
        selector: CACTUS_FORM_READY,
        timeout: 180000,
        cut: true,
      },
      { type: 'delay', ms: 2600 },
      ...navigateSteps(cactusVideoFixtures.locusWindow),
      {
        type: 'waitForSelector',
        selector: CACTUS_FORM_READY,
        timeout: 120000,
      },
      { type: 'delay', ms: 1800 },
      ...launchGraphSteps(formTrackMenu(cactusVideoFixtures.segmentsTrackJson)),
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
  // for, and `showInLinearView` navigates the connected linear view rather than
  // adding one, so the whole route is a hover and two clicks, and the reader
  // never types a coordinate. The graph follows that view in and re-cuts from
  // the segments once the zoom passes the track's `coarse` handover. That is
  // also why this is not a second filming of `pggb_subgraph_launch`: no paste,
  // no location box, no launch.
  //
  // THE OPENING FRAME IS THE DENSITY GATE ON PURPOSE, which is the one place
  // that message is the state the page describes rather than an accident: the
  // section is titled "when the window is wider than the graph can draw", and
  // 100 kb of a graph cut every ~17 bp is 60x the fine index's own width. The
  // tour navigates IN, and the banner going away is what the last step waits on.
  {
    name: 'pangenome/tier_to_fine',
    description:
      "The coarse tier's IS5 bubble taken down to the segments: hover the node for the K12 span it collapses, then take its Open in K12 entry, which lands the linear view on that span while the following graph re-cuts from the segments",
    url: pggbTierStart,
    // Measured on the static tier pane, which sized to its two rank rows; the
    // fine cut the tour now ends on can carry more, so re-read the run's
    // content report before trusting this.
    viewportHeight: 810,
    readySelector: TOOLBAR_READY,
    readyTimeout: 120000,
    // Long, because the opening frame has to have SETTLED INTO its banner: the
    // segments lane measures the fetch it is refusing, and a shorter settle
    // films an empty lane that fills with a warning a second later.
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
        say: 'Hover a node for the segments it collapses',
        hold: 3200,
      },
      {
        type: 'rightclick',
        anchor: { view: 1, graphNode: PGGB_TIER_IS5_NODE },
        say: "Open the bubble's span in the linear view",
        hold: 900,
      },
      { type: 'waitForText', text: 'Open in K12' },
      { type: 'click', text: 'Open in K12' },
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
      {
        type: 'waitForSelector',
        selector: `${FOLLOW_STATUS}::-p-text(coarse tier)`,
        hidden: true,
        timeout: 120000,
      },
      { type: 'waitForAppSettled' },
      // the pointer off the canvas, or the graph's hover tooltip stands over the
      // frame the poster is taken from
      { type: 'hover', selector: '[aria-label="JBrowse"]' },
      {
        type: 'delay',
        ms: 2500,
        say: 'The graph follows the view down to the segments',
      },
    ],
    tailMs: 3000,
  },
  // THE RE-LAYOUT, on the 460 bp pangenome/pggb_locus_sample_rows draws in
  // Sample rows. The clip carries what a still cannot: that the force drawing
  // is the same nodes, which is the whole of what the dropdown does.
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
    steps: [
      // The pointer off the overview's cytoband strip, where the camera parks
      // it: the view writes the position under the pointer into its own title
      // bar, and the opening frame carried a coordinate chip for a locus 1.3 Mb
      // from anywhere this tour goes.
      { type: 'hover', selector: '[aria-label="JBrowse"]' },
      // the rows held still long enough to be read against the MAF lane above
      // them, which is what the paragraph before the embed is about
      { type: 'delay', ms: 2500 },
      {
        type: 'click',
        selector: LAYOUT_SELECT,
        say: 'Re-lay the same rows out with the force engine',
        hold: 800,
      },
      { type: 'waitForText', text: 'Force-directed layout' },
      { type: 'click', text: 'Force-directed layout' },
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
  // session it opens: the graph following the linear view to C4 and out to the
  // bubble tier over the whole chromosome, then back to MHC class II and one
  // allele taken out to the haplotype that contributed it.
  {
    name: 'pangenome/hprc_browse',
    description:
      'HPRC release 2 from its genomes.jbrowse.org page: the HLA / MHC graph launch, the graph following the linear view to C4 and out to the bubble tier across chromosome 6, and one allele highlighted in hg38 and opened on the haplotype that contributed it',
    url: HPRC_PAGE,
    noSession: true,
    readyText: 'Whole chromosome',
    readyTimeout: 120000,
    viewportHeight: 1300,
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
        selector: TOOLBAR_READY,
        timeout: 240000,
        cut: true,
      },
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'delay',
        ms: 3000,
        say: 'MHC class II, the graph anchored under the linear view',
      },
      {
        type: 'type',
        selector: LOCATION_BOX,
        value: HPRC_C4_WINDOW,
        clear: true,
        say: 'Type the C4 window, and the graph follows',
      },
      { type: 'press', key: 'Enter' },
      { type: 'waitForAppSettled', timeout: 180000, cut: true },
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      { type: 'delay', ms: 3000, say: 'C4, cut again under the linear view' },
      {
        type: 'type',
        selector: LOCATION_BOX,
        value: 'chr6',
        clear: true,
        say: 'Out to the whole chromosome',
      },
      { type: 'press', key: 'Enter' },
      { type: 'waitForAppSettled', timeout: 240000, cut: true },
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
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
      { type: 'waitForAppSettled', timeout: 180000, cut: true },
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      { type: 'delay', ms: 2500, say: 'The segments again' },
      {
        type: 'rightclick',
        anchor: { view: 1, graphNode: HAPLOTYPE_NODE },
        say: 'Right-click the allele under HLA-DRB5',
        hold: 900,
      },
      { type: 'waitForText', text: HIGHLIGHT_ITEM },
      { type: 'click', text: HIGHLIGHT_ITEM },
      { type: 'delay', ms: 2500 },
      {
        type: 'rightclick',
        anchor: { view: 1, graphNode: HAPLOTYPE_NODE },
        say: `Open in ${HAPLOTYPE}`,
        hold: 900,
      },
      { type: 'waitForText', text: `Open in ${HAPLOTYPE}` },
      { type: 'click', text: `Open in ${HAPLOTYPE}` },
      {
        type: 'waitForSelector',
        selector: displayReady(HAPLOTYPE_GENES_DISPLAY),
        timeout: 180000,
        cut: true,
      },
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'delay',
        ms: 2500,
        say: 'NA20809 haplotype 2, on its own chromosome 6',
      },
      ...launchedZoomOut(6).map((step, i) =>
        i === 0 ? { ...step, say: 'Zoom out for its neighbours' } : step,
      ),
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
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
    steps: [
      {
        type: 'rightclick',
        anchor: { view: 0, graphNode: PGGB_STRAIN_NODE },
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
  // THE LADDER ON THE HUMAN GRAPH: the bubble tier over a region, down to a
  // bubble, down to the fine index. pangenome/tier_to_fine films the first rung
  // on E. coli; here the tier is two megabases of the MHC, the bubble is the
  // class II one, and the tour goes on to the fine cut, which is the rung the
  // page states in one sentence and pictures at neither end. Why the tier is
  // not the whole chromosome the figure draws is at hprcTierSession.
  //
  // What the clip shows that the prose can only assert: the fine cut arrives
  // as a SECOND pane under the tier's, because the session opens the tier pane
  // without the follow, which is the state Pin leaves on the HPRC page.
  {
    name: 'pangenome/hprc_tier_to_fine',
    description:
      'The HPRC bubble tier over the MHC taken down to segment resolution: the class II node opened in the linear view, then a drag across that span cut again from the fine index',
    url: tierSession(),
    // Sized to the state the tour ENDS in: the linear view, the two-row tier
    // pane, and the force pane the fine cut adds under both, which arrives at
    // the plugin's full pane height since nothing in a launch can pin it. Off
    // the run's own tallest-frame report at 1300.
    viewportHeight: 1490,
    readySelector: TOOLBAR_READY,
    readyTimeout: 300000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'delay',
        ms: 2500,
        say: 'The MHC, one node per bubble',
      },
      // the hover also syncs a band into the linear view above, so the frame
      // says where on the chromosome the bubble is before anything is clicked
      {
        type: 'hover',
        anchor: { view: 1, graphNode: MHC_BUBBLE },
        say: 'Hover the MHC class II bubble',
        hold: 3200,
      },
      {
        type: 'rightclick',
        anchor: { view: 1, graphNode: MHC_BUBBLE },
        say: 'Open in hg38',
        hold: 900,
      },
      { type: 'waitForText', text: 'Open in hg38' },
      { type: 'click', text: 'Open in hg38' },
      // the navigation and the refetch it starts, then the gene lane's own paint
      { type: 'waitForAppSettled', timeout: 180000 },
      { type: 'waitForSelector', selector: GENES_READY, timeout: 180000 },
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'delay',
        ms: 2500,
        say: "The linear view lands on the bubble's own span",
      },
      {
        type: 'drag',
        fromAnchor: { locus: MHC_SELECTION.start, band: RUBBERBAND },
        toAnchor: { locus: MHC_SELECTION.end, band: RUBBERBAND },
        say: 'Drag across the scale bar',
        hold: 900,
      },
      { type: 'waitForSelector', selector: SELECTION_SUBMENU },
      {
        type: 'click',
        selector: SELECTION_SUBMENU,
        say: 'Graph genome view (this selection)',
        hold: 1200,
      },
      { type: 'waitForSelector', selector: SELECTION_FINE_ENTRY },
      {
        type: 'click',
        selector: SELECTION_FINE_ENTRY,
        say: 'Cut it from the fine index',
      },
      {
        type: 'waitForSelector',
        selector: FINE_GRAPH_DRAWN,
        timeout: 180000,
        cut: true,
      },
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'delay',
        ms: 3000,
        say: 'The same window, one node per segment',
      },
    ],
    tailMs: 3500,
  },
]
