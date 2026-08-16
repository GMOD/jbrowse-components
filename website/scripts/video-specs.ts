// The motion tours: what generate-video.ts films, in the same declarative shape
// screenshot-specs.ts uses for the stills.
//
// A video earns its place only where the STILL CANNOT SAY IT. Two shapes qualify
// on the pangenome pages and nothing else so far:
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
// Everything else those pages need is a still and should stay one: a figure is
// searchable, diffable, annotatable and readable at a glance, and none of that
// survives being turned into a video.
//
// The sessions come from the spec modules rather than being written again here.
// A tour whose track config had drifted from the figures' would document a route
// through an app the rest of the page is not showing.
import { CODE_BASE } from '../src/lib/code-base.ts'
import { sessionSpec } from './screenshot-spec-helpers.ts'
import { pggbVideoFixtures } from './specs/graph-ecoli.ts'
import {
  TOOLBAR_READY,
  referencePositionColor,
} from './specs/graph-fixtures.ts'
import { hprcMhcVideoSession } from './specs/graph-hprc.ts'

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
} = pggbVideoFixtures

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
  // The human half of the same re-layout, where the anchored mode has the
  // stronger claim: every x becomes a GRCh38 coordinate, so each allele drops
  // under the place it attaches and the drawing lines up with the linear view
  // above it. The still pair (pangenome/hprc_mhc_anchored) states that in a
  // caption; here the nodes are watched going there, which is the one reading a
  // caption cannot give.
  {
    name: 'pangenome/hprc_layout_anchored',
    description:
      'One MHC class II subgraph moving from the force drawing onto the reference axis it shares with the linear view',
    url: hprcMhcVideoSession('force'),
    viewportWidth: 1280,
    // The linear view and a `paneHeight: 420` graph pane, the same pane the
    // still's force half is measured at. Confirmed against the run's own
    // content report rather than guessed.
    viewportHeight: 900,
    readySelector: TOOLBAR_READY,
    readyTimeout: 180000,
    settleMs: 6000,
    steps: [
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
    ],
    tailMs: 3000,
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
