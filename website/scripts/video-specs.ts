// The motion tours: what generate-video.ts films, in the same declarative shape
// screenshot-specs.ts uses for the stills.
//
// A video earns its place only where the STILL CANNOT SAY IT. Three shapes
// qualify, and they first earned it on the pangenome pages:
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
// The cancer pages then took the RE-LAYOUT twice, for the same reason the dog10k
// clustering tour did: each of their figures arrives in a state some menu item
// put it in, so the figure is the end of a route the page could only describe.
// A clip there is an OVERVIEW and the still stays -- the film carries how the
// frame was reached, the figure carries what is in it.
//
// The sessions come from the spec modules rather than being written again here.
// A tour whose track config had drifted from the figures' would document a route
// through an app the rest of the page is not showing.
import { displaySettled } from '@jbrowse/browser-test-utils'

import { CODE_BASE, RELEASED_CODE_BASE } from '../src/lib/code-base.ts'
import { menuCascade, sessionSpec } from './screenshot-spec-helpers.ts'
import { dog10kVideoFixtures } from './specs/dog10k.ts'
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
import { proteinTourFixtures } from './specs/msa.ts'
import { tcgaMutationVideoFixtures, tcgaVideoFixtures } from './specs/tcga.ts'

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

const {
  clusterCore: IGF1_CORE,
  drawnWindow: IGF1_WINDOW,
  matrixTrackId: IGF1_MATRIX,
  unclusteredSession: igf1Unclustered,
} = dog10kVideoFixtures

// The dendrogram exists only once the clustering RPC has returned, so it is both
// the gate the tour waits on and the visible half of what the route produced.
const DENDROGRAM = '[data-testid="tree_sidebar_dendrogram"]'
const IGF1_MATRIX_MENU = `[data-testid="track_menu_icon"][data-trackid="${IGF1_MATRIX}"]`

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
  // A ROUTE, and then the thing the route was for. The launch is four clicks
  // that every protein page describes in prose; what follows it is the half a
  // still cannot hold at all, because the connection between the two views is
  // only visible while something moves through it.
  //
  // Filmed on genomes.jbrowse.org's own hg38 config, so the menu, the dialog and
  // the plugin version are the ones a reader gets on the real site. Nothing here
  // is prepared: the config already loads protein3d, and AlphaFold and UniProt
  // are queried live during the clip.
  //
  // THE ONE TOUR THAT FILMS THE RELEASED APP rather than the local build, and
  // the layout is why. protein3d asks the session to split the new view off to
  // the right (`maybeLaunchSideBySide`), which needs two workspaces actions the
  // released session does not have, so the release stacks the two views full
  // width and main sits them side by side in half-width panes. Both are the
  // plugin working as written; only one is what a reader on genomes.jbrowse.org
  // gets. The stacked frame is also the one the clip's second half needs — the
  // residue a hover lands on is off the right edge of a half-width alignment
  // panel, so filming the local build shows the launch and then hides the thing
  // the launch was for.
  {
    name: 'proteins/genomes_protein_launch',
    description:
      'From a gene to its AlphaFold structure on genomes.jbrowse.org: the right-click launcher, the dialog resolving a UniProt entry, and the connected view answering a hover with a residue',
    url: `${RELEASED_CODE_BASE}${proteinTourFixtures.session}`,
    viewportWidth: 1280,
    // Provisional: sized from the run's own content report on the first film.
    viewportHeight: 1400,
    readyTimeout: 120000,
    // Long, because the readiness stack cannot see this app. Every display-level
    // gate in it keys on `data-display-phase` / `data-display-drawn`, and the
    // released build publishes neither attribute — so `waitForReady` returns
    // once the loading overlay clears and the tracks may still be fetching. The
    // first take that raced it right-clicked a gene lane that had not drawn and
    // failed on the launcher that never appeared.
    settleMs: 12000,
    steps: [
      // What the settle above cannot assert, asserted: no lane still says it is
      // loading. Cheap when it is already true, and when it is not, the run
      // fails here rather than on a right-click that lands in empty canvas.
      { type: 'waitForText', text: 'Loading', hidden: true, timeout: 90000 },
      {
        type: 'rightclick',
        anchor: {
          track: proteinTourFixtures.geneTrack,
          locus: 'chr17:7,676,000',
          // near the top of the band: `longestCoding` draws one gene row, so a
          // centered right-click lands on empty canvas and opens the view's own
          // menu with no feature items in it
          fracY: 0.2,
        },
        say: 'Right-click the gene',
        hold: 900,
      },
      { type: 'waitForText', text: 'Launch protein view' },
      {
        type: 'click',
        text: 'Launch protein view',
        say: 'Launch protein view',
      },
      // OFF CAMERA. The dialog opens empty and fills itself from three round
      // trips — UniProt ID mapping, the isoform's protein sequences, AlphaFold's
      // structure URL — and a film of a form filling in is a film of a spinner.
      // It comes back on the resolved dialog, which is what there is to read.
      {
        type: 'waitForSelector',
        selector: '[data-testid="protein-launch-button"]:not([disabled])',
        timeout: 180000,
        cut: true,
      },
      // held long enough to read the UniProt entry it picked and the isoform it
      // matched against the structure's own residues
      { type: 'delay', ms: 3500 },
      {
        type: 'click',
        selector: '[data-testid="protein-launch-button"]',
        say: 'Launch',
      },
      {
        type: 'waitForSelector',
        selector: '[data-testid="protein-view-ready"]',
        timeout: 300000,
        cut: true,
      },
      { type: 'delay', ms: 3000 },
      // In to the coding exons, so the hovers below are spread across the frame
      // instead of crowded into eighty pixels of it. Typed into the linear
      // view's own location box, which is what a reader zooming in would do.
      {
        type: 'type',
        selector: LOCATION_BOX,
        value: proteinTourFixtures.hoverWindow,
        clear: true,
        say: proteinTourFixtures.hoverWindow,
      },
      { type: 'press', key: 'Enter' },
      { type: 'delay', ms: 3000 },
      // THE PAYOFF. Each hover is a genomic position, and the protein view
      // answers with the residue it maps to: the readout above the alignment,
      // the column in it, and the residue picked out on the structure itself.
      {
        type: 'hover',
        anchor: {
          track: proteinTourFixtures.geneTrack,
          locus: proteinTourFixtures.codingLocus,
        },
        say: 'Hover a coding position',
        hold: 3000,
      },
      // The negative, and the one step whose caption names what is NOT
      // happening: an intron has no residue to map to, so the readout empties
      // instead of moving.
      //
      // Between the two coding hovers rather than after them, because "nothing
      // is highlighted" and "the tour has stopped" are the same frame. Coming
      // back to a coding position is what makes the empty one legible as an
      // answer.
      {
        type: 'hover',
        anchor: {
          track: proteinTourFixtures.geneTrack,
          locus: proteinTourFixtures.intronicLocus,
        },
        say: 'An intronic position maps to no residue',
        hold: 3000,
      },
      {
        type: 'hover',
        anchor: {
          track: proteinTourFixtures.geneTrack,
          locus: proteinTourFixtures.secondCodingLocus,
        },
        say: 'Back on the exon, and the residue is back',
        hold: 3500,
      },
    ],
    // Short, and a poster taken off a hover. Filming ends by clearing the
    // caption and parking the cursor, which un-hovers whatever the tour was
    // holding — so every frame after the last step is a connected view being
    // asked nothing, and both of these keep that out of the reader's way.
    posterAt: 36,
    tailMs: 1200,
  },
  // A ROUTE AND A RE-LAYOUT AT ONCE, and the one place in the three Dog10K
  // tutorials where a still is structurally short of the point.
  // dog10k_selection.md's own sentence is the argument for filming it: the page
  // says a session "can say that instead of performing it", because its figure
  // reaches the row order through `clusterRegion` + `runClustering` rather than
  // through the menu. So the page states an ordering it never shows being
  // produced, and the reader is asked to believe that clustering on genotypes
  // alone recovers the size split -- which is the page's result -- from a picture
  // in which the rows were already in that order when the app opened.
  //
  // What the clip adds over the figure is the BEFORE. The rows start in the VCF's
  // order, which is the order the panel was built in, so the swatch column opens
  // as three clean breed blocks; after the run it is interleaved, and the
  // recovery is visible as a change rather than as a claim about a static image.
  //
  // It also performs the page's "cluster on the core, then widen" advice, which
  // is the one instruction on that page a reader cannot check against any figure:
  // both windows look the same afterwards, so a still of either end says nothing
  // about which region the order came from. The tour runs the clustering at
  // IGF1_CORE, then types IGF1_WINDOW into the location box and the order holds,
  // because the display orders rows by name rather than re-deriving from what is
  // in view.
  {
    name: 'dog10k/igf1_cluster_route',
    description:
      'Clustering the IGF1 genotype matrix from the track menu: breed-ordered rows, the run over the differentiated core, and the order holding when the window widens',
    url: igf1Unclustered(IGF1_CORE),
    viewportWidth: 1280,
    // The matrix is a fixed 620 px whatever the window, and the tour neither adds
    // a view nor opens a drawer, so unlike the pangenome tours above there is no
    // tallest-state-in-the-middle to size for: the run reports 945px of app at
    // the first frame, the last and its tallest alike, because the dendrogram
    // column arrives beside the rows rather than under them.
    viewportHeight: 960,
    readySelector: displaySettled('variant-matrix-display'),
    readyTimeout: 180000,
    settleMs: 5000,
    steps: [
      // Two seconds on the opening state before anything is clicked. The whole
      // clip is a before/after and this is the before, which a reader who has
      // already scrolled past the clustered figure needs a moment to register.
      { type: 'delay', ms: 2000 },
      {
        type: 'click',
        selector: IGF1_MATRIX_MENU,
        say: 'Track menu',
        hold: 700,
      },
      { type: 'waitForText', text: 'Clustering' },
      { type: 'click', text: 'Clustering', say: 'Clustering', hold: 700 },
      { type: 'waitForText', text: 'Cluster rows by genotype...' },
      {
        type: 'click',
        text: 'Cluster rows by genotype...',
        say: 'Cluster rows by genotype...',
        hold: 900,
      },
      { type: 'waitForText', text: 'Run clustering' },
      { type: 'click', text: 'Run clustering', say: 'Run clustering' },
      // 167 rows over the core's columns, hclust in an RPC worker under a
      // software rasterizer. `cut` because a film of a spinner is not a film of
      // anything, and the camera comes back on the reordered rows.
      {
        type: 'waitForSelector',
        selector: DENDROGRAM,
        timeout: 240000,
        cut: true,
      },
      { type: 'delay', ms: 3000 },
      // The half the figure cannot state: the order was computed on the core and
      // survives the widening, so the block's edges can be read against the gene
      // track without the flank having diluted the columns that found them.
      {
        type: 'type',
        selector: LOCATION_BOX,
        value: IGF1_WINDOW,
        clear: true,
        say: IGF1_WINDOW,
      },
      { type: 'press', key: 'Enter' },
      {
        type: 'waitForSelector',
        selector: displaySettled('variant-matrix-display'),
        timeout: 180000,
        cut: true,
      },
    ],
    tailMs: 3500,
  },
  // A RE-LAYOUT on the cancer pages, and the one instruction tcga_cohort_cnv.md
  // gives that its figures cannot show. Both of that page's stack figures arrive
  // already clustered, so the reader never sees what the menu item did: 1104
  // tumors in barcode order, which encodes nothing, becoming blocks of shared
  // copy-number profile. Which row moved where is exactly what a before/after
  // still pair cannot state and what watching them sort states for free.
  //
  // Ends on the sorted stack with the dendrogram beside it, so the last frame is
  // the figure the page already prints.
  {
    name: 'tcga/cohort_cnv_clustering',
    description:
      "Sorting a TCGA-BRCA copy-number stack by profile: 1104 tumors in barcode order, the track menu's Clustering item, and the bands that come back",
    url: tcgaVideoFixtures.unclusteredErbb2,
    viewportWidth: 1280,
    // 906px of app at the first frame, the last and its tallest, per the run's
    // own content report, which is the whole clip: nothing here grows the app the
    // way a launch does, because a re-layout reorders the rows it already has.
    viewportHeight: 910,
    // The rows have to carry DATA before the camera starts, not just a first
    // paint: a tour that films clustering an empty canvas films nothing. The
    // stack is 1104 rows of a 5.7MB BED even at this window.
    readySelector: tcgaVideoFixtures.painted,
    readyTimeout: 300000,
    settleMs: 12000,
    steps: [
      // The holds are long by the pangenome tours' standard, and deliberately.
      // This clip exists to be FOLLOWED, so each state has to stay up long
      // enough to read: the track menu is a dozen items and the reader has to
      // find one in it, where those tours only had to show that a cascade
      // happened. At 700ms the open menu was on screen for about a second.
      {
        type: 'click',
        selector: `[data-testid="track_menu_icon"][data-trackid="${tcgaVideoFixtures.trackId}"]`,
        say: 'Track menu',
        hold: 1800,
      },
      { type: 'waitForText', text: 'Clustering' },
      { type: 'click', text: 'Clustering', say: 'Clustering', hold: 1600 },
      { type: 'waitForText', text: 'Cluster rows by similarity' },
      {
        type: 'click',
        text: 'Cluster rows by similarity',
        say: 'Cluster rows by similarity',
        hold: 1200,
      },
      // The camera comes off for the run itself. Clustering ships the matrix to
      // an RPC worker and then repaints 1104 rows in one pass, which under
      // swiftshader is seconds of a frozen frame rather than an animation.
      {
        type: 'waitForSelector',
        selector: DENDROGRAM,
        timeout: 300000,
        cut: true,
      },
      { type: 'delay', ms: 2500 },
    ],
    tailMs: 3500,
  },
  // A RE-LAYOUT again, and the precondition every figure on tcga_cohort_mutations
  // is built on. Both of its matrices are drawn over collapsed exons, which the
  // page can only say in a sentence; a reader who opens CDH1 for themselves gets
  // 63 kb of first intron and a matrix of private intronic columns, which looks
  // nothing like either picture.
  //
  // Four clicks with a dialog in the middle, so it is also the page's answer to
  // "where do the figures' windows come from": the exon intervals come out of
  // the live feature rather than being typed, and the clip ends on the frame the
  // figure below it prints.
  //
  // The toast the collapse raises is deliberately IN this clip. The still hides
  // it (hideSelectors) because it has no business in a published frame, but a
  // tour is a record of real clicks and that toast is how the app confirms one.
  {
    name: 'tcga/mutations_collapse_introns',
    description:
      'Reshaping a gene to its exons: right-click CDH1 in the gene lane, Collapse introns, and the 979-tumor matrix redrawn over the coding sequence',
    url: tcgaMutationVideoFixtures.cdh1WholeTranscript,
    viewportWidth: 1280,
    // 779px of app at every frame the run measured — `Replace current view`
    // reshapes in place rather than adding a view, so nothing here grows the way
    // a launch does — and the frame is 60px taller than that ON PURPOSE. The
    // collapse raises a snackbar the run's content report does not count, and it
    // draws under the app's own bottom border; sized to the content it would land
    // half outside the frame or over the last rows of the matrix.
    viewportHeight: 840,
    // The matrix has to be carrying its 979 rows before the camera starts.
    readySelector: tcgaMutationVideoFixtures.matrixDone,
    readyTimeout: 300000,
    settleMs: 10000,
    steps: [
      { type: 'waitForText', text: tcgaMutationVideoFixtures.gene },
      {
        type: 'rightclick',
        text: tcgaMutationVideoFixtures.gene,
        say: `Right-click ${tcgaMutationVideoFixtures.gene}`,
        hold: 1800,
      },
      { type: 'waitForText', text: 'Collapse introns' },
      {
        type: 'click',
        text: 'Collapse introns',
        say: 'Collapse introns',
        hold: 1600,
      },
      { type: 'waitForText', text: 'Replace current view' },
      {
        type: 'click',
        selector: 'button::-p-text(Replace current view)',
        say: 'Replace current view',
      },
      { type: 'waitForText', text: 'Replace current view', hidden: true },
      // Off camera for the refetch. Reshaping the view refetches every track,
      // which for 979 rows of a cohort VCF is a loading overlay rather than an
      // animation.
      {
        type: 'waitForSelector',
        selector: '[data-testid="loading-overlay"]',
        hidden: true,
        cut: true,
      },
      {
        type: 'waitForSelector',
        selector: tcgaMutationVideoFixtures.matrixDone,
        timeout: 300000,
      },
      { type: 'delay', ms: 2500 },
    ],
    tailMs: 3500,
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
