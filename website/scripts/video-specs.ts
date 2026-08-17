// The motion tours: what generate-video.ts films, in the same declarative shape
// screenshot-specs.ts uses for the stills.
//
// A video earns its place only where the STILL CANNOT SAY IT. Three shapes
// qualify on the pangenome pages and nothing else so far:
//
//   A ROUTE. `Track menu -> Launch view -> Graph genome view (this region)` is
//   how every graph on those pages was made, and the tutorials describe it in
//   prose because a screenshot of an open cascade is a picture of a menu. The
//   film is the click path and the graph arriving at the end of it.
//
//   A RE-LAYOUT. The Layout dropdown redraws the same nodes a second way, and
//   the A/B still (pangenome/pggb_locus_sample_rows) can only put the two
//   drawings side by side. Which node in the left panel is which node in the
//   right is exactly what a pair of stills cannot state, and what watching them
//   move states for free.
//
//   A WHOLE SESSION. `hprc_end_to_end` opens on an hg38 with one gene track and
//   ends holding an allele's coordinates. What it carries that the two above do
//   not is where a page's JSON fences GO: a config block says what to paste and
//   nothing about the form it is pasted into, so a reader working out whether
//   any of this reaches their own graph is reading about an app they have never
//   seen.
//
// Everything else those pages need is a still and should stay one: a figure is
// searchable, diffable, annotatable and readable at a glance, and none of that
// survives being turned into a video.
//
// The sessions come from the spec modules rather than being written again here.
// A tour whose track config had drifted from the figures' would document a route
// through an app the rest of the page is not showing.
import { CODE_BASE } from '../src/lib/code-base.ts'
import { menuCascade, sessionSpec } from './screenshot-spec-helpers.ts'
import { pggbVideoFixtures } from './specs/graph-ecoli.ts'
import {
  TOOLBAR_READY,
  referencePositionColor,
} from './specs/graph-fixtures.ts'
import {
  HPRC_SEGMENTS_TRACK_JSON,
  TOUR_MHC_LOCUS,
  TOUR_NODE,
  hprcClusterFixtures,
  hprcTourSession,
} from './specs/graph-hprc.ts'

import type { ScreenshotAction } from './screenshot-spec-types.ts'

export interface VideoStep extends ScreenshotAction {
  // One short line held in the frame's lower left while this step plays, in the
  // app's own words: a menu path, a control's label. It names what is being
  // done, the way a diagram's labels name its nodes.
  //
  // Use it where the app does not say it itself. A click lands in a quarter of a
  // second and a reader watching a cursor cross a toolbar has no way back to
  // which item it took, where a still has the whole cascade on the page at once.
  say?: string
  // Scroll the page to this offset, filmed, before the step's own action runs.
  // 'bottom' goes as far as the document does.
  //
  // The one motion in a tour that belongs to the reader: a launch adds a whole
  // view below the one it was launched from, and a window that held the first
  // does not hold both.
  scrollTo?: number | 'bottom'
  // ms to hold the finished frame before the next step runs. The default reads
  // a menu opening; raise it where the result needs looking at.
  hold?: number
  // Take the camera off while this step's wait runs, and put it back when the
  // wait is over.
  //
  // For the steps that are genuinely slow: a subgraph cut refetches the tabix
  // index and hands a force layout to the remote FMMM engine, which is seconds
  // of spinner. A film of a spinner is not a film of anything, and speeding the
  // whole clip up to hide it makes every cursor movement look like a glitch.
  // The camera stays on for PRE_CUT_MS first, so the click is seen to start work
  // rather than teleporting to its result.
  cut?: boolean
}

export interface VideoSpec {
  // Output basename under website/static/media, directories allowed:
  // `pangenome/pggb_subgraph_launch` -> static/media/pangenome/pggb_subgraph_launch.mp4
  name: string
  // Session URL, the same form as a screenshot spec's: a query string served
  // against the local jbrowse-web build, or an absolute url.
  url: string
  // Capture viewport in CSS px. Filmed at deviceScaleFactor 2, so app text
  // survives being played back in a docs column.
  viewportWidth?: number
  viewportHeight?: number
  // Gates before the camera starts. Everything a tour opens with loads off
  // camera, so the first frame is the app ready rather than the app loading.
  readySelector?: string
  readyTimeout?: number
  settleMs?: number
  steps: VideoStep[]
  // Seconds into the finished clip to take the <video poster> from. Defaults to
  // the last frame, which is the state the tour ends in.
  posterAt?: number
  // Still frame held after the last step, so the end state can be read before
  // the clip ends.
  tailMs?: number
  // One line for `pnpm video --list`, and the sentence the doc embed's caption
  // is written from.
  description: string
}

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
const LOCATION_BOX = 'input[placeholder="Search for location"]'
const HIGHLIGHT_ITEM = 'Highlight in hg38'
// A display by its own id rather than by type: `feature-display` is the testid
// every canvas feature lane shares, so the gene lane already standing would
// satisfy it and the tour would carry on before the segments it just added had
// fetched anything. `<trackId>-<displayType>` is what a config with no explicit
// `displayId` gets (packages/core/src/util/tracks.ts), which is exactly the
// case here — the pasted block declares no display.
const displayReady = (displayId: string) =>
  `[data-display-id="${displayId}"][data-display-phase="ready"]`
const GENES_READY = displayReady('hg38_ncbiRefSeq_ucsc-LinearBasicDisplay')
const SEGMENTS_READY = displayReady(`${SEGMENTS_TRACK}-LinearBasicDisplay`)
// Sample rows have arrived: the labels, not just the toolbar, since the layout
// runs after the graph loads and the toolbar is up before there is a row to
// label.
const ROWS_DRAWN = `body:has([data-testid="graph-row-label"]) ${LAYOUT_SELECT}`

export const videoSpecs: VideoSpec[] = [
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
    readySelector: `[data-testid="track_menu_icon"][data-trackid="${segmentsTrackId}"]`,
    settleMs: 3000,
    steps: [
      {
        type: 'click',
        selector: `[data-testid="track_menu_icon"][data-trackid="${segmentsTrackId}"]`,
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
        selector: `[data-testid="track_menu_icon"][data-trackid="${SEGMENTS_TRACK}"]`,
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
        selector: `[data-testid="track_menu_icon"][data-trackid="${hprcClusterFixtures.trackId}"]`,
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

// The track configs a tour TYPES into the app, paired with the page that prints
// them, for `check-paste-configs`.
//
// A tour that films a config being pasted documents the page only while the two
// texts are one text, and nothing about either makes them so: the tour's is a
// template literal in a spec module and the page's is a fence in markdown. A
// reworded `name`, a rehosted `uri`, one slot added to the block a reader
// copies — any of those moves one copy and leaves the other filming a config
// the page no longer prints, and the film is the half nobody re-reads.
//
// A tour reading its config through ECOLI_DEMO_BASE would need the check to
// know that; none does yet, and the check says so rather than guessing.
export const pastedTrackConfigs = [
  {
    video: 'pangenome/hprc_end_to_end',
    doc: 'tutorials/pangenome_hprc.md',
    json: HPRC_SEGMENTS_TRACK_JSON,
  },
]

// video name -> the live session the tour was filmed in, so a reader who has
// just watched the route taken can take it themselves.
//
// The same treatment a figure gets (screenshotLiveUrls), and for the stronger
// reason: a still shows a state, and a film shows a route, which is only worth
// watching if the reader can then walk it. Every url here is the spec's own, so
// the link cannot drift from what was filmed.
export const videoLiveUrls: Record<string, string> = Object.fromEntries(
  videoSpecs.map(spec => [
    spec.name,
    spec.url.startsWith('http') ? spec.url : `${CODE_BASE}${spec.url}`,
  ]),
)
