// The structural-variant tours: getting a callset in, and putting a cohort's
// genotypes in an order.
import { displaySettled } from '@jbrowse/browser-test-utils'

import { cgiabVideoFixtures, svVideoFixtures } from '../specs/sv.ts'
import { SORT_BY_GENOTYPE, multisvVideoFixtures } from '../specs/ui.ts'
import { cascade, DENDROGRAM, leaveMenu, trackMenu } from './shared.ts'

import type { VideoSpec } from '../video-spec-types.ts'

const { assembly, callsetUrl, emptySession } = svVideoFixtures
const {
  cnvClustered,
  deletionSpan,
  matrixReady,
  matrixTrackId,
  unsorted: unsortedRhdPanel,
} = multisvVideoFixtures

// The inert `<g>` in the app bar, where the pointer parks between routes: off
// the wiggle lane, which draws a score tooltip under whatever the pointer is
// left on, and off the view's overview strip, which writes the position under
// the pointer into the view title.
const WORDMARK = '[aria-label="JBrowse"]'

const cgiabCoverageMenu = trackMenu(cgiabVideoFixtures.coverageTrackId)

// The import form's assembly select carries no test id, but it is labelled, so
// the accessible name is the handle — the same word the page uses when it says
// to select hg19.
const ASSEMBLY_SELECT = '::-p-aria([name="Assembly"][role="combobox"])'
const assemblyOption = (name: string) => `li[role="option"]::-p-text(${name})`

export const svVideos: VideoSpec[] = [
  // WHERE GETTING THE DATA IN IS THE DIFFICULTY. sv_inspector_view.md opens by
  // telling the reader to launch the view from the Add menu, paste a URL into
  // the form that appears, and pick an assembly; its three figures are the state
  // before, the state with the URL in the box, and the state after. What none of
  // them carries is that these are one continuous route, and the form is exactly
  // the kind of thing prose is worst at — every instruction names a control the
  // reader has not seen yet.
  //
  // The second half is the page's other prose-only claim, and the more
  // interesting one: "Table filters are reflected in the circular view." That is
  // a statement about two panels moving together, which a pair of stills can
  // only assert. Typing one chromosome into the table's filter drops the rows
  // that do not touch it and the chords go with them, in the same frame.
  {
    name: 'sv/inspector_route',
    description:
      'The SV inspector from the Add menu to a filtered callset: launch the view, paste the SKBR3 VCF into the import form, pick the assembly, and watch the circular overview follow the table filter',
    goal: 'Open a structural-variant callset in the SV inspector, then filter it',
    url: emptySession,
    // One frame holds the import form and the loaded pair alike; the run reports
    // the app at 588px once the table and the circle are standing.
    viewportHeight: 640,
    readySelector: '::-p-text(Select a view to launch)',
    readyTimeout: 120000,
    steps: [
      { type: 'delay', ms: 1800 },
      {
        type: 'click',
        text: 'Add',
        say: 'Launch the SV inspector from the Add menu',
        hold: 900,
      },
      { type: 'waitForText', text: 'SV inspector' },
      { type: 'click', text: 'SV inspector' },
      { type: 'waitForText', text: 'Open file from URL or local computer' },
      { type: 'delay', ms: 1200 },
      { type: 'click', selector: ASSEMBLY_SELECT, hold: 900 },
      { type: 'click', selector: assemblyOption(assembly), hold: 1400 },
      {
        type: 'type',
        selector: '[data-testid="urlInput"]',
        value: callsetUrl,
        say: "Paste the SKBR3 callset's URL and open it",
        hold: 1600,
      },
      // By its testid, not by its label: `::-p-text(Open)` matches the first
      // element CONTAINING the word, which on this form is the "Open file from
      // URL or local computer" tab above it — so a text click landed on the tab
      // and the tour then waited three minutes for a table nothing had asked
      // for.
      {
        type: 'click',
        selector: '[data-testid="open_spreadsheet"]',
      },
      // A whole callset parsed and a genome's worth of chords drawn, off camera.
      { type: 'waitForText', text: 'CHROM', timeout: 180000, cut: true },
      {
        type: 'delay',
        ms: 4000,
        say: 'A table of the calls, and their breakends drawn as chords',
      },
      // The claim the page makes in one sentence and shows in two figures. The
      // Mate column carries the far end of each breakend, so a chromosome typed
      // here keeps every record that TOUCHES it, whichever end it is filed
      // under, and the circle redraws to those chords alone.
      //
      // Bare, because the callset's refNames are: `chrX` matched 0 of 273 rows
      // and the tour ended on "No results found".
      {
        type: 'type',
        selector: 'input[placeholder^="Search"]',
        value: 'X',
        clear: true,
        say: 'Filter the table to chromosome X',
      },
      { type: 'waitForAppSettled', timeout: 120000 },
      {
        type: 'delay',
        ms: 3500,
        say: 'Only the calls touching X stay, in the table and in the circle',
      },
    ],
    tailMs: 4000,
  },

  // TWO ORDERS OVER ONE COHORT, and sv_multisamples.md puts both in a single
  // paragraph it has no picture for. The page says the rows "arrive in the
  // callset's own order, which encodes nothing", then names the right-click that
  // bands them, then names the track menu's clustering as "the other
  // arrangement" — three states, and `multisv_rhd` is the middle one alone.
  // Nothing on the page shows the order the reader actually lands in, and
  // nothing shows the dendrogram at all.
  //
  // A re-layout is what makes that unshowable in stills. The rows before and
  // after carry the same 3202 samples over the same window in the same colors,
  // so a before/after pair is two pictures with no visual link: which row went
  // where is the whole content, and it is exactly what is missing. Watching the
  // block resolve is the only way that paragraph gets checked.
  //
  // ORDER MATTERS between the two halves, and the page's order is the one
  // filmed. The sort keys every row on ONE call, so the three bands are the
  // three dosages of RHD and the block is legible as such; clustering then
  // re-keys the same rows on the whole window, which is a different question and
  // undoes the bands on purpose. Filmed the other way round, the sort would read
  // as a correction of the tree.
  //
  // Neither item leaves its menu standing, so no Escapes belong here.
  // `Sort rows by genotype here` is a plain action row (multiSampleVariantMenuItems.ts,
  // `variantContextMenuItems`) and `Cluster rows by genotype...` is one that
  // queues a dialog, and `staysOpenOnClick` keeps only a checkbox or a radio up.
  {
    name: 'sv/multisample_sort',
    description:
      'Two orders over the 1000 Genomes cohort at the RHD deletion: right-click the block for Sort rows by genotype here and the callset order resolves into three dosage bands, then Clustering, Cluster rows by genotype... and Run clustering re-key the same rows on the whole window and draw the tree they came out of',
    goal: 'Order 3202 genomes by their genotype at the RHD deletion',
    url: unsortedRhdPanel,
    // SIZED TO THE FIGURE, which is the same four lanes: `multisv_rhd` measures
    // them at 1230 and every one carries an explicit height (290 matrix, 330
    // depth, 170 records, 120 genes), so the app stands as tall at 1920 wide as
    // at that figure's 1500 — and nothing in the tour grows it. Both things the
    // route adds go sideways or nowhere: the dendrogram is a gutter reserved on
    // the LEFT (`treeSidebarOffset`), and the cluster dialog is centred in a
    // frame this tall with room to spare.
    //
    // 1244 rather than that figure's 1230: the run measured the app at 1240,
    // since the figure is captured at its content height and this is a fixed
    // frame that has to hold it.
    viewportHeight: 1244,
    // BOTH heavy lanes, in one gate. The matrix has to be carrying genotypes
    // before the camera starts, because `sortByGenotype` computes the order from
    // `cellData` on the main thread — a right-click before the callset lands
    // opens a menu whose item does nothing. And the copy-number lane clusters
    // itself as the session opens, painting a "Clustering samples 62%" overlay
    // across the lane under the subject; `multisv_rhd` waits that out in its
    // `actions`, and a tour has nothing before its first frame.
    readySelector: `body:has(${cnvClustered}) ${matrixReady}`,
    // The figure's own budget: a remote EBI tabix read of a 3202-sample callset,
    // a 2504-row Zarr store, and a clustering RPC over that store. Its 35s
    // settle covers what `readyText: '1KGP'` leaves open, which is most of the
    // loading; the gate above covers that instead, so what is left to settle for
    // is the record and gene lanes painting.
    readyTimeout: 300000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'delay',
        ms: 3500,
        say: '3202 samples in callset order, which groups nothing',
      },
      // HGSV_1821's own span, so the click lands at the deletion's midpoint —
      // the same column `multisv_rhd` sorts on, named once in specs/ui.ts. The
      // sort keys on the variant UNDER the pointer (`contextMenuFeature`), so a
      // pixel here rather than a locus would be right only at the width it was
      // measured at, and wrong quietly: a right-click between two records offers
      // a menu with no sort row in it at all.
      {
        type: 'rightclick',
        anchor: { track: matrixTrackId, locus: deletionSpan, fracY: 0.5 },
        say: 'Right-click the deletion and sort the rows by genotype there',
        hold: 1800,
      },
      { type: 'waitForText', text: SORT_BY_GENOTYPE },
      { type: 'click', text: SORT_BY_GENOTYPE },
      // ON CAMERA, deliberately. `sortByGenotype` is synchronous over cell data
      // already in memory — no fetch, no worker — so this wait is the app
      // answering again rather than a spinner, and the frame it holds is the one
      // moment the clip exists for. A cut here would hand the reader the two
      // pictures the page already has.
      { type: 'waitForSelector', selector: matrixReady, timeout: 120000 },
      // Off the matrix before the hold: the display draws a crosshair and a
      // genotype tooltip under the pointer, and the pointer is on the bands the
      // hold is of. The wordmark is an svg with no handler, so parking there
      // takes both down and reaches nothing.
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      {
        type: 'delay',
        ms: 4500,
        say: 'Three bands, top to bottom: both copies deleted, one, then neither',
      },
      {
        type: 'click',
        selector: trackMenu(matrixTrackId),
        say: 'Now cluster the same rows on the whole window instead',
        hold: 1800,
      },
      { type: 'waitForText', text: 'Clustering' },
      { type: 'click', text: 'Clustering', hold: 1600 },
      { type: 'waitForText', text: 'Cluster rows by genotype...' },
      { type: 'click', text: 'Cluster rows by genotype...' },
      // The ellipsis is the app saying this row opens a dialog, which the other
      // clustering tour's item does not. Held, because the dialog is where the
      // route stops being obvious: it names the matrix it is about to build and
      // offers the R-script path beside the in-app one.
      { type: 'waitForText', text: 'Run clustering' },
      { type: 'delay', ms: 3000 },
      // By `button`, not by bare text: the dialog's own description ends in
      // "hierarchical clustering", and a text match resolving to that paragraph
      // clicks successfully and does nothing.
      {
        type: 'click',
        selector: 'button::-p-text(Run clustering)',
      },
      // Off camera for the run, which ships the genotype matrix to a worker and
      // hclusts 3202 rows: a progress bar inside the dialog rather than an
      // animation, and the same trade tcga/cohort_cnv_clustering makes.
      {
        type: 'waitForSelector',
        selector: DENDROGRAM,
        timeout: 300000,
        cut: true,
      },
      // The dialog closes itself on success (`ClusterAutoTab`'s onSuccess), and
      // this is the frame it has to be out of. It lands a tick after the wait
      // above — `runGenotypeClustering` sets the tree before `run()` resolves —
      // so the budget here is for the tick and not for the run.
      {
        type: 'waitForText',
        text: 'Run clustering',
        hidden: true,
        timeout: 60000,
      },
      // the tree beside rows keyed on the whole window, which no figure carries
      {
        type: 'delay',
        ms: 3500,
        say: 'Clustered on every call in view, with the tree beside the rows',
      },
    ],
    tailMs: 4000,
  },

  // sv_visualization_cgiab.md's copy-number walkthrough lists its menu routes
  // as bullets, and every cgiab figure of the matched pair's coverage is taken
  // with them already applied. The row-per-source default gives each sample an
  // axis of its own, while the claim is that the tumor steps where its own
  // normal holds still, which is only a claim on one axis: Plot type →
  // Overlapping → Scatter puts them there, a three-level cascade whose leaf
  // word appears twice in the one menu. The clip ends on the lane the chr5
  // figure below the embed prints.
  //
  // Set min/max score was filmed here too and cut: local autoscale already
  // gives chr5 0..2, so pinning 0..3 barely moved the picture.
  {
    name: 'sv_cgiab/copy_number_layout',
    description:
      "HG008's tumor and normal coverage brought onto one axis: Plot type → Overlapping → Scatter redraws the two stacked rows as one band of points",
    goal: "Put a tumor's coverage and its normal's on one axis to compare",
    url: cgiabVideoFixtures.coverageAsLoaded,
    // 406px of app at every frame, plus the strip the caption chip is fixed
    // into, which is off the FRAME's bottom rather than the app's.
    //
    // Nesting the plots under a layout put the open submenu's last row under
    // the caption chip, and 600 was tried to clear it: the chip moves down with
    // the frame but the menu stays anchored to the app, so the row stayed
    // covered and the poster — the last frame — gained 194px of page
    // background. The caption names the plot being picked, so the covered row
    // costs less than the dead space.
    viewportHeight: 520,
    // The rows have to be carrying the whole chromosome before the camera
    // starts, or the overlay redraws an empty lane.
    readySelector: displaySettled('wiggle-display'),
    readyTimeout: 180000,
    steps: [
      { type: 'hover', selector: WORDMARK, hold: 0 },
      {
        type: 'delay',
        ms: 3000,
        say: 'Tumor and normal on stacked rows, each autoscaled on its own',
      },
      {
        type: 'click',
        selector: cgiabCoverageMenu,
        say: 'Overlay the two rows as points on one axis',
        hold: 1200,
      },
      { type: 'waitForSelector', selector: cascade('submenu', 'Plot type') },
      {
        type: 'click',
        selector: cascade('submenu', 'Plot type'),
        hold: 1400,
      },
      // The layout is the group a plot name sits under, so "as points, on one
      // axis" is one leaf rather than a radio and then a checkbox. Only the
      // open group's rows are on screen, which is what keeps `Scatter` — a
      // label both groups carry — resolving to this one.
      {
        type: 'waitForSelector',
        selector: cascade('submenu', 'Overlapping'),
      },
      {
        type: 'click',
        selector: cascade('submenu', 'Overlapping'),
        hold: 1400,
      },
      { type: 'waitForSelector', selector: cascade('menuitem', 'Scatter') },
      {
        type: 'click',
        selector: cascade('menuitem', 'Scatter'),
        hold: 1400,
      },
      ...leaveMenu(cascade('submenu', 'Plot type')),
      { type: 'waitForAppSettled', timeout: 120000 },
      {
        type: 'delay',
        ms: 5000,
        say: 'The tumor sits above its normal on 5p, below it on 5q',
      },
    ],
    tailMs: 4000,
  },
]
