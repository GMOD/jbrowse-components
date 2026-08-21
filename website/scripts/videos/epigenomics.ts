// The epigenomics tours.
import { displaySettled } from '@jbrowse/browser-test-utils'

import { chromhmmVideoFixtures } from '../specs/ui.ts'
import { DENDROGRAM, trackMenu } from './shared.ts'

import type { VideoSpec } from '../video-spec-types.ts'

const { trackId: CHROMHMM_TRACK, unclusteredHoxa } = chromhmmVideoFixtures
const CHROMHMM_MENU = trackMenu(CHROMHMM_TRACK)
// The rows have to be carrying DATA before the camera starts, not merely have
// painted once: the run item is disabled until the display has discovered two
// rows to cluster (`sourcesWithoutLayout`), and a disabled MenuItem swallows a
// click and reports nothing.
const MULTIROW_READY = displaySettled('multirow-display')
// The run's own progress chip, which is the gate the `chromhmm` figure waits on
// rather than settling for a duration: "clustering 127 rows is real WASM compute,
// and a settle long enough to cover it on a slow runner is one that is wrong on a
// fast one — a 15s settle shot the run mid-cluster, chip and all" (specs/ui.ts).
// The autorun's `finally` retires the status slot, which is what takes the chip
// down. One consumer, so it stays here rather than in shared.ts.
const PROGRESS_CHIP = '[data-testid="progress-chip"]'

export const epigenomicsVideos: VideoSpec[] = [
  // A RE-LAYOUT, and the one chromhmm.md figure that is a RESULT with no picture
  // of its own cause. That figure is the 127 epigenomes already in similarity
  // order, so the tidy row order — the thing the section is about — arrives as
  // something the reader takes on faith, and the two sentences under it ("that
  // config has no rowOrder", "clustering costs the tissue names") describe a
  // trade nothing on the page performs.
  //
  // What the clip adds is the BEFORE, and here the before is not noise. The demo
  // config's track carries a 127-line `rowOrder` in Roadmap's group order and
  // `rowGroups` keeps those groups contiguous while no tree names the rows, so
  // the stack opens with a clean tissue stripe beside a painting with no block in
  // it. The run swaps which axis is tidy: the blocks appear in the painting and
  // the stripe goes mixed, which is the page's "the tissue is an axis the
  // clustering never saw" happening rather than being asserted.
  //
  // NOT CUT, unlike the other two clustering tours. Those cut because what is on
  // screen while they work is a frozen frame — 1104 rows repainting in one pass
  // under swiftshader. This run reports itself: the RPC's `statusCallback` reaches
  // the display's status channel, `DisplayBackgroundProgress` draws it as a corner
  // chip while the phase is still `ready`, and the phases name themselves through
  // it — "Downloading features", then hclust's own "Computing distance matrix" and
  // "Clustering samples" with a determinate bar over each
  // (clusterProgressStatus.ts gives each half of the bar to one of them). The
  // unclustered rows stay drawn and usable underneath the whole time. That is the
  // app saying what it is doing, so the camera stays on for it.
  {
    name: 'epigenomics/chromhmm_cluster',
    description:
      "Clustering the 127-epigenome ChromHMM track over HOXA: the rows in Roadmap's tissue order, the track menu's Clustering item, and the painting re-laid out under the dendrogram it produces",
    url: unclusteredHoxa,
    // The `chromhmm` figure's own 880, which tracks the display's 520 plus the
    // gene lane's 120: this tour opens on that figure's session and ends on that
    // figure's state, and nothing between them grows the app. A re-layout reorders
    // the rows it already has, and the dendrogram arrives BESIDE them rather than
    // above or below — `TreeSidebar` portals an 80px panel into the track overlay
    // at left: 0, while the painting's canvas stays at left: 0 and the full
    // `canvasWidthPx`. So the tracks lose no width, the genome axis does not
    // re-scale, and the only thing that moves horizontally is the row-label
    // swatch stripe, which shifts `treeAreaWidth` to the right to clear the tree
    // (`treeSidebarOffset`).
    //
    // 890 rather than the figure's 880: the run reported 5px of app below the
    // frame, which is the figure being captured at its content height where this
    // is a fixed frame.
    viewportHeight: 890,
    readySelector: MULTIROW_READY,
    readyTimeout: 300000,
    settleMs: 8000,
    steps: [
      // The unclustered stack, held. This is the before, and a reader who has
      // just scrolled past the clustered figure needs a moment to see that this
      // is not it.
      { type: 'delay', ms: 3000 },
      {
        type: 'click',
        selector: CHROMHMM_MENU,
        say: 'Track menu',
        hold: 1800,
      },
      { type: 'waitForText', text: 'Clustering' },
      { type: 'click', text: 'Clustering', say: 'Clustering', hold: 1600 },
      { type: 'waitForText', text: 'Cluster rows by similarity' },
      // No ellipsis and no dialog on this display: the item sets the trigger and
      // the run starts on the autorun's next tick, 500ms later. The hold is that
      // tick plus the chip's own 250ms anti-flash delay, so the chip is seen to
      // come up rather than the frame cutting from a menu to a finished tree.
      {
        type: 'click',
        text: 'Cluster rows by similarity',
        say: 'Cluster rows by similarity',
        hold: 1400,
      },
      // The menu dismisses on that click (a plain row, not a radio), and this is
      // what says so — the click below has to land on the wordmark rather than on
      // a modal backdrop still closing.
      { type: 'waitForText', text: 'Cluster rows by similarity', hidden: true },
      // Park the cursor before the run, not after it. It is sitting where the
      // menu item was, which is over the painting, and the multi-row display
      // draws crosshairs and a feature tooltip under the pointer — that would be
      // on screen for the whole run and in the poster frame. The logo is a bare
      // `<g>` with no handler, so the click only moves the cursor and blurs the
      // menu icon, whose "Track settings" tooltip would otherwise outlive its
      // menu.
      { type: 'click', selector: '[aria-label="JBrowse"]' },
      { type: 'waitForText', text: 'Track settings', hidden: true },
      // The figure's own gate, on camera: the chip going away is the run's
      // `finally` retiring its status slot. Waiting on `hidden` for a chip that
      // has not gone up yet passes instantly, which is why this is a floor rather
      // than the whole wait — the dendrogram below is the positive half.
      {
        type: 'waitForSelector',
        selector: PROGRESS_CHIP,
        hidden: true,
        timeout: 300000,
      },
      // The visible half of what the route produced: `TreeSidebar` mounts only
      // once the run has returned a hierarchy.
      { type: 'waitForSelector', selector: DENDROGRAM, timeout: 120000 },
      // The blocks, the tree and the mixed stripe, held long enough to read
      // against the gene lane above them.
      { type: 'delay', ms: 4000 },
    ],
    tailMs: 4500,
  },
]
