// The epigenomics tours.
import { displayPainted, displaySettled } from '@jbrowse/browser-test-utils'

import { bisulfiteVideoFixtures } from '../specs/methylation.ts'
import { chromhmmVideoFixtures } from '../specs/ui.ts'
import { DENDROGRAM, trackMenu } from './shared.ts'

import type { VideoSpec, VideoStep } from '../video-spec-types.ts'

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

const { wgbsTrackId, cpgPileup } = bisulfiteVideoFixtures
const WGBS_MENU = trackMenu(wgbsTrackId)
// The cascade by its rows' own testids rather than by their text.
// `CascadingMenu` slugs a row's label into `cascading-<kind>-<label>`, and every
// context here is a word the PAGE also draws elsewhere on screen: the aggregate
// MethylDackel lane labels its three rows CpG, CHG and CHH, so a
// `::-p-text(CHG)` step is one layout change away from clicking a wiggle row.
const colorCascade = (kind: 'submenu' | 'menuitem', label: string) =>
  `[data-testid="cascading-${kind}-${label.toLowerCase().replaceAll(/\s+/g, '_')}"]`
const COLOR_BY = colorCascade('submenu', 'Color by...')
const BISULFITE = colorCascade('submenu', 'Bisulfite / EM-seq')
const CONTEXT = (label: string) => colorCascade('menuitem', label)
// The one thing in the app bar with no handler on it, so a click or a hover
// there only moves the pointer.
const WORDMARK = '[aria-label="JBrowse"]'

// Leave the whole cascade and put the cursor somewhere inert, so the frame the
// context change produced is not under the menu that produced it — and here the
// menu is exactly over the half of the window that has to change, since it drops
// from a track header at the left.
//
// A radio only writes a setting, so all three levels are still up after the
// pick: the track menu, Color by... and Bisulfite / EM-seq. ONE CLICK ON THE
// ROOT MENU'S BACKDROP TAKES ALL THREE, because the submenus are React children
// of the root's list and unmount with it.
//
// Escape does not, and two takes went into finding out. It reaches the top modal
// of MUI's own stack and shuts exactly that one; MUI then restores focus outside
// any menu, so the second press lands on an element no modal is listening
// through and the run dies waiting for a level that never closed. Nothing on
// screen says which of the two happened, which is the whole reason the waits
// name a row per level.
//
// The backdrop is the ROOT's: a submenu's `HoverMenu` sets pointer-events none
// on its own modal root so a hovering pointer can cross the gap, and its
// backdrop inherits that, so the first `.MuiBackdrop-root` in the document is
// the only one a click can reach. The wordmark cannot serve as the outside
// click, incidentally: this harness falls back to `node.click()` for a covered
// target, and the wordmark is a bare SVG `<g>`, which has no such method.
//
// Neither click holds: what a reader is waiting for is the lane behind the menu,
// and the wait under each click already carries the menu going away.
const leaveTheMenu: VideoStep[] = [
  { type: 'click', selector: '.MuiBackdrop-root', hold: 0 },
  { type: 'waitForSelector', selector: COLOR_BY, hidden: true },
  // The menu icon keeps FOCUS once the menu goes, so its "Track settings"
  // tooltip stays up over the lane. The wordmark is inert, and clicking it both
  // blurs the icon and parks the cursor clear of the pileup, which would
  // otherwise draw a read tooltip under the pointer for the rest of the clip.
  { type: 'click', selector: WORDMARK, hold: 0 },
  { type: 'waitForText', text: 'Track settings', hidden: true },
]

// One trip through the cascade to set one cytosine context, ending on the
// recolored pileup with nothing over it.
const pickContext = (label: string): VideoStep[] => [
  { type: 'click', selector: WGBS_MENU, say: 'Track menu', hold: 1200 },
  { type: 'waitForSelector', selector: COLOR_BY },
  { type: 'click', selector: COLOR_BY, say: 'Color by...', hold: 1200 },
  { type: 'waitForSelector', selector: BISULFITE },
  // The submenu this tour is about, held: the four contexts with the current
  // one checked, and under them the "Show unmethylated (blue)" checkbox that
  // only exists once bisulfite is the scheme in force.
  {
    type: 'click',
    selector: BISULFITE,
    say: 'Bisulfite / EM-seq',
    hold: 2500,
  },
  { type: 'waitForSelector', selector: CONTEXT(label) },
  // The radio mark moving, before the menu goes: that is the only frame saying
  // which of the four is now in force.
  { type: 'click', selector: CONTEXT(label), say: label, hold: 1400 },
  ...leaveTheMenu,
  // The recolor itself, on camera. Nothing is refetched — the reads are
  // loaded and the context is a render prop — so what plays here is the same
  // pileup repainting, which is the whole claim three stacked panels cannot
  // make.
  { type: 'waitForAppSettled', timeout: 120000 },
  { type: 'delay', ms: 3000 },
]

export const epigenomicsVideos: VideoSpec[] = [
  // A RE-LAYOUT of the coloring rather than of the rows, and the one claim
  // arabidopsis_wgbs_contexts cannot make. That figure stacks three copies of
  // one CRAM, each pinned to a context, and its caption has to assert that they
  // are the same pileup; a reader looking at three bands of 150bp reads has no
  // way to check it, exactly as methylation/group_by_hp has none across its two
  // halves. One track recoloring under one menu is the check.
  //
  // The tri-context comparison is what the page is FOR — gene-body methylation
  // is CpG alone and RdDM silencing is all three — so the window carries one of
  // each, and the aggregate MethylDackel rows stay put above the pileup as the
  // fixed reference the moving lane is read against.
  //
  // KEPT ON A PILEUP, which website/CLAUDE.md says the tours stay off. The
  // warning is real and it is about volume: a deep human ONT lane repainting
  // under swiftshader starves the click's own round trip. This is 14 kb of
  // Illumina WGBS over a plant genome, and it films headless.
  {
    name: 'epigenomics/bisulfite_contexts',
    description:
      'Cycling one Arabidopsis WGBS pileup through the plant cytosine contexts: Color by... to Bisulfite / EM-seq, then CHG and CHH over a gene body and an LTR element that answer differently',
    url: cpgPileup,
    // genes + the repeat lane + the aggregate's three rows + one 200px pileup +
    // headers/ruler/overview. Nothing in the tour grows the app: a context is a
    // render prop, so the lane it repaints keeps its own height.
    viewportHeight: 848,
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 120000,
    settleMs: 20000,
    steps: [
      // The camera opens with the pointer at the top middle of the frame, which
      // in this layout is the overview ruler — and an LGV writes the position
      // under the pointer into its own title bar, so the opening frame carries a
      // coordinate chip from a chromosome the tour never visits. Moving off it
      // first is the whole of this step.
      { type: 'hover', selector: WORDMARK, hold: 0 },
      // CpG, which is what the page's `addtrack` fence opens the track on: red
      // over the gene body AND over the element on the right.
      { type: 'delay', ms: 3000 },
      ...pickContext('CHG'),
      ...pickContext('CHH'),
      { type: 'delay', ms: 2000 },
    ],
    tailMs: 4000,
  },
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
