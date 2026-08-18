// The graph tours, on the two pangenome pages. Three of the four shapes the
// corpus films start here: the launch ROUTE, the layout RE-LAYOUT, and the WHOLE
// SESSION that opens pangenome_hprc.
import { menuCascade, sessionSpec } from '../screenshot-spec-helpers.ts'
import { pggbVideoFixtures } from '../specs/graph-ecoli.ts'
import {
  TOOLBAR_READY,
  referencePositionColor,
} from '../specs/graph-fixtures.ts'
import {
  HPRC_SEGMENTS_TRACK_JSON,
  TOUR_MHC_LOCUS,
  TOUR_NODE,
  hprcClusterFixtures,
  hprcTourSession,
} from '../specs/graph-hprc.ts'
import { LOCATION_BOX, displayReady, trackMenu } from './shared.ts'

import type { VideoSpec } from '../video-spec-types.ts'

const {
  config: PGGB_CONFIG,
  genesTrack,
  segmentsTrack,
  segmentsTrackId,
  locus,
  locusWindow,
  rowsLocus,
  rowsWindow,
  locusSession,
  pangenomeConfig: PGGB_PANGENOME_CONFIG,
  strainLaunchNode: PGGB_STRAIN_NODE,
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

// A linear view of the pggb graph's own segments over the IS5 element, with no
// graph pane: the state a reader is in before they cut one, which is what makes
// the launch route filmable at all.
const pggbLinearOnly = sessionSpec(PGGB_CONFIG, {
  sessionTracks: [genesTrack, segmentsTrack],
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'K12',
      loc: locusWindow,
      tracks: [
        { trackId: 'K12_genes', type: 'LinearBasicDisplay', height: 70 },
        {
          trackId: segmentsTrackId,
          type: 'LinearBasicDisplay',
          // labels off: at this density they are hundreds of overlapping
          // integer ids, the same setting the page's own figures use
          showLabels: 'none',
          height: 50,
          color: referencePositionColor(locus),
        },
      ],
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
const GENES_READY = displayReady('hg38_ncbiRefSeq_ucsc-LinearBasicDisplay')
const SEGMENTS_READY = displayReady(`${SEGMENTS_TRACK}-LinearBasicDisplay`)
// Sample rows have arrived: the labels, not just the toolbar, since the layout
// runs after the graph loads and the toolbar is up before there is a row to
// label.
const ROWS_DRAWN = `body:has([data-testid="graph-row-label"]) ${LAYOUT_SELECT}`

export const pangenomeVideos: VideoSpec[] = [
  // THE ROUTE. Every graph pane in pangenome_ecoli.md was cut this way and the
  // page can only say so in a sentence; this is the sentence happening. It ends
  // on the graph rather than on the menu, so the last thing in the frame is the
  // thing the route is for.
  {
    name: 'pangenome/pggb_subgraph_launch',
    description:
      'Cutting a graph out of a locus: the pggb segments track, its launch menu, and the subgraph that comes back',
    url: pggbLinearOnly,
    viewportWidth: 1280,
    // Sized to the state the tour ENDS in, which is the linear view plus the
    // graph pane the launch adds: the run reports 365px of app at the first
    // frame and 1053px at the last, and a video has one frame for both. The
    // page background above that last number is the cost of filming a launch,
    // and it is the cheaper half of the trade — a frame sized to the opening
    // cuts the graph the tour exists to show.
    viewportHeight: 1060,
    readySelector: trackMenu(segmentsTrackId),
    settleMs: 3000,
    steps: [
      {
        type: 'click',
        selector: trackMenu(segmentsTrackId),
        say: 'Track menu',
        hold: 700,
      },
      { type: 'waitForText', text: 'Launch view' },
      { type: 'click', text: 'Launch view', say: 'Launch view', hold: 700 },
      { type: 'waitForText', text: 'Graph genome view (this region)' },
      {
        type: 'click',
        text: 'Graph genome view (this region)',
        say: 'Graph genome view (this region)',
      },
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
  // THE RE-LAYOUT, on the 460 bp the page draws both ways. The still pair is
  // pangenome/pggb_locus_sample_rows; what it cannot carry is that the two
  // drawings are the same nodes, which is the whole of what the dropdown does.
  // Switched there and back, so the correspondence is seen twice and the clip
  // ends in the layout the surrounding prose is about.
  {
    name: 'pangenome/pggb_layout_switch',
    description:
      'The same 460 bp of the pggb graph in both layouts: sample rows, force-directed, and back',
    url: locusSession('samplerows', {
      region: rowsLocus,
      window: rowsWindow,
      mafLane: true,
    }),
    viewportWidth: 1280,
    // Sized to the FORCE drawing, which is the tour's tallest state and not one
    // of its ends: the run reports 802px of app in sample rows at both the first
    // frame and the last, and 1242px in between. A frame sized to either end
    // cuts the drawing the switch was filmed to show.
    viewportHeight: 1250,
    readySelector: ROWS_DRAWN,
    readyTimeout: 120000,
    settleMs: 5000,
    steps: [
      { type: 'click', selector: LAYOUT_SELECT, say: 'Layout', hold: 800 },
      { type: 'waitForText', text: 'Force-directed layout' },
      {
        type: 'click',
        text: 'Force-directed layout',
        say: 'Force-directed layout',
      },
      {
        type: 'waitForSelector',
        selector: TOOLBAR_READY,
        timeout: 120000,
        cut: true,
      },
      { type: 'delay', ms: 3000 },
      { type: 'click', selector: LAYOUT_SELECT, say: 'Layout', hold: 800 },
      { type: 'waitForText', text: 'Sample rows' },
      { type: 'click', text: 'Sample rows', say: 'Sample rows' },
      {
        type: 'waitForSelector',
        selector: ROWS_DRAWN,
        timeout: 120000,
        cut: true,
      },
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
    viewportWidth: 1280,
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
      { type: 'click', text: 'File', say: 'File', hold: 700 },
      { type: 'waitForText', text: 'Open track...' },
      { type: 'click', text: 'Open track...', say: 'Open track...' },
      { type: 'waitForText', text: 'Enter track data' },
      // The workflow select, by the option it is showing. Only one element
      // carries that text until the menu opens, and by then the item this
      // clicks next is the only one carrying its own.
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
      // config a keystroke at a time through a controlled MUI field, which is
      // both slower than a paste and a different action from the one being
      // documented; cutting it leaves the box empty, then full, which is what
      // pasting looks like. The caption from the step above stands through it.
      {
        type: 'type',
        selector: PASTE_BOX,
        value: HPRC_SEGMENTS_TRACK_JSON,
        cut: true,
      },
      // the filled box, held long enough to be read as the page's own block
      { type: 'delay', ms: 2600 },
      { type: 'click', text: 'Submit', say: 'Submit' },
      // Submit dismisses the widget itself (finishAddTrack), so the drawer
      // closing is the app's answer rather than a step.
      {
        type: 'waitForSelector',
        selector: SEGMENTS_READY,
        timeout: 180000,
        cut: true,
      },
      { type: 'delay', ms: 2600 },
      // The locus. Also the step that makes the launch below deterministic —
      // the drawer took ~400 px off the view while it was open, and an LGV
      // keeps its bp-per-pixel across a resize, so the window standing now is
      // wider than the one the session opened at.
      {
        type: 'type',
        selector: LOCATION_BOX,
        value: TOUR_MHC_LOCUS,
        clear: true,
        say: TOUR_MHC_LOCUS,
      },
      { type: 'press', key: 'Enter' },
      { type: 'delay', ms: 1500 },
      {
        type: 'waitForSelector',
        selector: SEGMENTS_READY,
        timeout: 180000,
      },
      { type: 'delay', ms: 1800 },
      {
        type: 'click',
        selector: trackMenu(SEGMENTS_TRACK),
        say: 'Track menu',
        hold: 700,
      },
      { type: 'waitForText', text: 'Launch view' },
      { type: 'click', text: 'Launch view', say: 'Launch view', hold: 700 },
      { type: 'waitForText', text: 'Graph genome view (this region)' },
      {
        type: 'click',
        text: 'Graph genome view (this region)',
        say: 'Graph genome view (this region)',
      },
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
  // per assembly the session carries. There is no `Launch view` cascade on a
  // node, which is the thing the page used to say and the reason this tour is
  // worth more than the sentence it replaces: a reader hunting for a submenu
  // that is not there gives up on the route entirely.
  {
    name: 'pangenome/pggb_out_to_strain',
    description:
      "A CFT073 allele opened on CFT073's own coordinates: right-click the node, take its Open in entry, and read the deletion from the donor's side",
    url: pggbGraphOnly,
    viewportWidth: 1280,
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
    viewportWidth: 1280,
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
