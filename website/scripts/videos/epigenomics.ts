// The epigenomics tours.
import { displayPainted, displaySettled } from '@jbrowse/browser-test-utils'

import { bisulfiteVideoFixtures } from '../specs/methylation.ts'
import { chromhmmVideoFixtures } from '../specs/ui.ts'
import { DENDROGRAM, leaveMenu, trackMenu } from './shared.ts'

import type { VideoSpec, VideoStep } from '../video-spec-types.ts'

const { trackId: CHROMHMM_TRACK, unclusteredHoxa } = chromhmmVideoFixtures
const CHROMHMM_MENU = trackMenu(CHROMHMM_TRACK)
// The rows have to be carrying DATA before the camera starts, not merely have
// painted once: the run item is disabled until the display has discovered two
// rows to cluster (`discoveredRows`), and a disabled MenuItem swallows a
// click and reports nothing.
const MULTIROW_READY = displaySettled('multirow-display')

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

// One trip through the cascade to set one cytosine context, ending on the
// recolored pileup with nothing over it.
const pickContext = (label: string): VideoStep[] => [
  {
    type: 'click',
    selector: WGBS_MENU,
    say: `Color the reads by the ${label} context`,
    hold: 700,
  },
  { type: 'waitForSelector', selector: COLOR_BY },
  { type: 'click', selector: COLOR_BY, hold: 700 },
  { type: 'waitForSelector', selector: BISULFITE },
  // the four contexts with the current one checked
  { type: 'click', selector: BISULFITE, hold: 1300 },
  { type: 'waitForSelector', selector: CONTEXT(label) },
  // The radio mark moving, before the menu goes: that is the only frame saying
  // which of the four is now in force.
  { type: 'click', selector: CONTEXT(label), hold: 900 },
  ...leaveMenu(COLOR_BY),
  // The recolor itself, on camera. Nothing is refetched — the reads are
  // loaded and the context is a render prop — so what plays here is the same
  // pileup repainting, which is the whole claim three stacked panels cannot
  // make.
  { type: 'waitForAppSettled', timeout: 120000 },
  { type: 'delay', ms: 2000 },
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
    goal: 'Recolor one plant WGBS pileup by each cytosine context in turn',
    url: cpgPileup,
    // genes + the repeat lane + the aggregate's three rows + one 200px pileup +
    // headers/ruler/overview, 850px, and the caption chip's strip under it.
    // Nothing in the tour grows the app: a context is a render prop, so the lane
    // it repaints keeps its own height.
    viewportHeight: 970,
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 120000,
    steps: [
      // The camera opens with the pointer at the top middle of the frame, which
      // in this layout is the overview ruler — and an LGV writes the position
      // under the pointer into its own title bar, so the opening frame carries a
      // coordinate chip from a chromosome the tour never visits. Moving off it
      // first is the whole of this step.
      { type: 'hover', selector: WORDMARK, hold: 0 },
      // CpG, which the page's `addtrack` fence opens the track on
      {
        type: 'delay',
        ms: 3000,
        say: 'CpG: methylated, red, over the gene body and the LTR element',
      },
      ...pickContext('CHG'),
      ...pickContext('CHH'),
      {
        type: 'delay',
        ms: 3500,
        say: 'Only the LTR stays red in CHG and CHH; the gene body is CpG only',
      },
    ],
    tailMs: 4000,
  },
  // A RE-LAYOUT, and the one chromhmm.md figure that is a RESULT with no picture
  // of its own cause. That figure is the 127 epigenomes already in similarity
  // order, so the tidy row order — the thing the section is about — arrives as
  // something the reader takes on faith, and the two sentences under it ("that
  // config has no domain", "clustering costs the tissue names") describe a
  // trade nothing on the page performs.
  //
  // What the clip adds is the BEFORE, and here the before is not noise. The demo
  // config's track carries a 127-line `domain` in Roadmap's group order, which
  // keeps those groups contiguous until a run writes its own order, so the stack
  // opens with a clean tissue stripe beside a painting with no block in it. The run swaps which axis is tidy: the blocks appear in the painting and
  // the stripe goes mixed, which is the page's "the tissue is an axis the
  // clustering never saw" happening rather than being asserted.
  //
  // NOT CUT, unlike the other two clustering tours, which repaint over a
  // thousand rows in one frozen pass under swiftshader. Here the dialog's
  // progress bar names each phase of the run ("Computing distance matrix",
  // "Clustering samples") and the dialog closes itself on success, so the camera
  // stays on for it.
  {
    name: 'epigenomics/chromhmm_cluster',
    description:
      "Clustering the 127-epigenome ChromHMM track over HOXA: the rows in Roadmap's tissue order, the track menu's Clustering item, and the painting re-laid out under the dendrogram it produces",
    goal: "Cluster 127 epigenomes' chromatin states over the HOXA genes",
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
    // 892 rather than the figure's 880: the run measured the app at 891, since
    // the figure is captured at its content height and this is a fixed frame.
    viewportHeight: 892,
    readySelector: MULTIROW_READY,
    readyTimeout: 300000,
    steps: [
      { type: 'hover', selector: WORDMARK, hold: 0 },
      {
        type: 'delay',
        ms: 3000,
        say: "Rows in Roadmap's tissue order: a clean tissue stripe, no blocks",
      },
      {
        type: 'click',
        selector: CHROMHMM_MENU,
        say: 'Cluster the epigenomes by their chromatin states',
        hold: 1800,
      },
      { type: 'waitForText', text: 'Clustering' },
      { type: 'click', text: 'Clustering', hold: 1600 },
      { type: 'waitForText', text: 'Cluster rows by similarity' },
      { type: 'click', text: 'Cluster rows by similarity', hold: 1200 },
      { type: 'waitForText', text: 'Run clustering' },
      { type: 'delay', ms: 1500 },
      // by `button`: the dialog's description ends in "hierarchical clustering"
      { type: 'click', selector: 'button::-p-text(Run clustering)' },
      // `TreeSidebar` mounts only once the run has returned a hierarchy
      { type: 'waitForSelector', selector: DENDROGRAM, timeout: 300000 },
      {
        type: 'waitForText',
        text: 'Run clustering',
        hidden: true,
        timeout: 60000,
      },
      // The pointer is where the dialog's button was, over the painting, which
      // draws a crosshair and a feature tooltip under it; the click also blurs
      // the menu icon, whose "Track settings" tooltip would outlive its menu.
      { type: 'click', selector: WORDMARK },
      { type: 'waitForText', text: 'Track settings', hidden: true },
      {
        type: 'delay',
        ms: 4000,
        say: 'Clustered: epigenomes with HOXA active, red, sit apart from those holding it repressed, grey',
      },
    ],
    tailMs: 4500,
  },
]
