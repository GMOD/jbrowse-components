// The structural-variant tours: getting a callset in, turning the reads at one
// breakpoint into the allele they describe, and putting a cohort's genotypes in
// an order.
import { displaySettled } from '@jbrowse/browser-test-utils'

import { cancerSvVideoFixtures } from '../specs/cancer_sv.ts'
import { cgiabVideoFixtures, svVideoFixtures } from '../specs/sv.ts'
import { multisvVideoFixtures } from '../specs/ui.ts'
import { DENDROGRAM, trackMenu } from './shared.ts'

import type { VideoSpec, VideoStep } from '../video-spec-types.ts'

const { assembly, callsetUrl, emptySession } = svVideoFixtures
const { breakpointPanel, chainRouteLabel, chainRouteTestId, readsTrackId } =
  cancerSvVideoFixtures
const {
  cnvClustered,
  deletionSpan,
  matrixReady,
  matrixTrackId,
  unsorted: unsortedRhdPanel,
} = multisvVideoFixtures

// The picker's own testid, published on both shapes it draws the routes in (a
// radio group, or the bare row a single candidate gets). Waiting on it is
// waiting on the reconstruction pass rather than on a timeout.
const ROUTE_LIST = '[data-testid="derivative-path-candidates"]'

// The inert `<g>` in the app bar, where the pointer parks between routes: off
// the wiggle lane, which draws a score tooltip under whatever the pointer is
// left on, and off the view's overview strip, which writes the position under
// the pointer into the view title.
const WORDMARK = '[aria-label="JBrowse"]'

// A cascade row by its own testid rather than by its text. `CascadingMenu` slugs
// each label into `cascading-<kind>-<label>`, and the plot-type cascade holds
// the word Scatter TWICE — once per layout group — so a text match would take
// whichever of the two the DOM happened to mount first.
const cascade = (kind: 'submenu' | 'menuitem', label: string) =>
  `[data-testid="cascading-${kind}-${label.toLowerCase().replaceAll(/\s+/g, '_')}"]`

const cgiabCoverageMenu = trackMenu(cgiabVideoFixtures.coverageTrackId)

// A radio row only writes a setting, so every level of the cascade it sits in is
// still standing over the lane it just changed. One click on the ROOT menu's
// backdrop takes all of them (the submenus are React children of its list);
// Escape reaches one level per press and only from the top of MUI's modal stack.
// The second click blurs the menu icon, whose "Track settings" tooltip outlives
// the menu, and parks the cursor clear of the lane.
const leaveTheMenu: VideoStep[] = [
  { type: 'click', selector: '.MuiBackdrop-root', hold: 0 },
  {
    type: 'waitForSelector',
    selector: cascade('submenu', 'Plot type'),
    hidden: true,
  },
  { type: 'click', selector: WORDMARK, hold: 0 },
  { type: 'waitForText', text: 'Track settings', hidden: true },
]

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
    url: emptySession,
    // One frame holds the import form and the loaded pair alike; the run reports
    // the app at 588px once the table and the circle are standing.
    viewportHeight: 640,
    readySelector: '::-p-text(Select a view to launch)',
    readyTimeout: 120000,
    settleMs: 4000,
    steps: [
      { type: 'delay', ms: 1800 },
      { type: 'click', text: 'Add', say: 'Add', hold: 900 },
      { type: 'waitForText', text: 'SV inspector' },
      { type: 'click', text: 'SV inspector', say: 'SV inspector' },
      { type: 'waitForText', text: 'Open file from URL or local computer' },
      { type: 'delay', ms: 1200 },
      {
        type: 'click',
        selector: ASSEMBLY_SELECT,
        say: 'Assembly',
        hold: 900,
      },
      { type: 'click', selector: assemblyOption(assembly), hold: 1400 },
      // The page's own file. Typed rather than pasted, so the field is seen to
      // be a URL field.
      {
        type: 'type',
        selector: '[data-testid="urlInput"]',
        value: callsetUrl,
        say: 'Open file from URL',
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
        say: 'Open',
      },
      // A whole callset parsed and a genome's worth of chords drawn, off camera.
      { type: 'waitForText', text: 'CHROM', timeout: 180000, cut: true },
      { type: 'delay', ms: 4000 },
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
        say: 'X',
      },
      { type: 'waitForAppSettled', timeout: 120000 },
      { type: 'delay', ms: 3500 },
    ],
    tailMs: 4000,
  },

  // A ROUTE AND A RE-LAYOUT, which is why one clip serves two pages. Both
  // describe the same four controls in prose and show either end of them:
  // cancer_sv.md states the whole path in one sentence and its figure holds the
  // finished panels, and sv_visualization_cgiab.md names the menu path and
  // shows the dialog alone. Neither has the reads at one breakpoint becoming
  // the panels, which is the half made of clicks.
  //
  // The re-layout is what the second half of the tour is: the launching view is
  // one window on chr3, and what replaces it is a panel per SEGMENT of the
  // route, in the order the reads cross it, carrying the tracks that view had.
  // So the soft-clipped tails in the opening frame come back as curves leaving
  // one panel and arriving in the next — the same reads, twice, which is a
  // correspondence two stills can only assert. This chain leaves chr3 and
  // returns to it inverted, so it draws two chr3 panels where the import form
  // takes one row per chromosome.
  //
  // It opens on the pileup rather than on the dialog, because the reconstruction
  // is computed from the reads in the displayed regions: the window is what
  // decides which routes exist at all, and a tour starting at the dialog would
  // film that as a list arriving from nowhere.
  {
    name: 'sv/derivative_allele_route',
    description:
      "COLO829's three-junction chain built by the app rather than typed in: the tumor track menu, Reconstruct derivative allele..., the four-segment route the reads agree on, and Draw as Breakpoint split view replacing the window with one panel per segment",
    url: breakpointPanel,
    // SIZED TO THE END STATE, which is the four-panel split view and not the
    // dialog: cancer_sv/derivative_autogenerated holds the same dialog over the
    // same pileup in a 560px frame, while the four panels are what
    // cancer_sv/multihop_split_view measures at 1325 on these track heights (70
    // of gene lane and 130 of pileup, four times over). So this is that number
    // rounded up even with a little headroom, and the page under the launching
    // pileup at the start is the room those panels need rather than slack.
    viewportHeight: 1340,
    // The pileup's own phase, not first paint: this is 200x ONT out of a CRAM
    // and the route list is computed from the reads in view, so a tour that
    // starts before the fetch lands opens the dialog on a shorter list than the
    // one the figures show. `forceLoad` on the track is what gets the fetch
    // past the byte gate at all.
    readySelector: displaySettled('pileup-display'),
    readyTimeout: 300000,
    settleMs: 12000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      // The wall of soft clipping at the two chr3 breakpoints, held: it is the
      // input every route in the list is computed from, and the state the left
      // half of cancer_sv/multihop_reads is of.
      { type: 'delay', ms: 3000 },
      {
        type: 'click',
        selector: trackMenu(readsTrackId),
        say: 'Track menu',
        hold: 1200,
      },
      // Clicked rather than hovered: CascadingSubmenu opens on either, and the
      // pileup re-lays-out as reads stream, which can move a hovered row out
      // from under the cursor.
      { type: 'waitForText', text: 'Launch view' },
      { type: 'click', text: 'Launch view', say: 'Launch view', hold: 1200 },
      { type: 'waitForText', text: 'Reconstruct derivative allele...' },
      {
        type: 'click',
        text: 'Reconstruct derivative allele...',
        say: 'Reconstruct derivative allele...',
      },
      // The pass walks every read's SA chain over the whole pileup, and the
      // figures on this route give it three minutes. Off camera, with the menu
      // item held first so the dialog is not seen to teleport in.
      {
        type: 'waitForSelector',
        selector: ROUTE_LIST,
        timeout: 180000,
        cut: true,
      },
      // Long enough to read a row: the route, its segments drawn to scale, the
      // number of reads that take it, and the line above the list saying a read
      // count ranks a route rather than vouching for it.
      { type: 'delay', ms: 4000 },
      // By the shape of the route rather than by rank. It is row 0 here and
      // outranks the other row 28 reads to 2, so the default selection is
      // already this one — but the whole clip rests on which allele gets drawn,
      // and rows tied on support sort by segment count, which is how the
      // fold-back figure next door drew the wrong route under the right caption.
      {
        type: 'click',
        selector: `[data-testid="${chainRouteTestId}"]`,
        say: chainRouteLabel,
        hold: 2400,
      },
      // By its testid, not by its label: the dialog's prose has named this
      // drawing before now, and a text match then resolves to the paragraph —
      // an element, which clicks successfully and does nothing.
      {
        type: 'click',
        selector: '[data-testid="derivative-draw-as-split"]',
        say: 'Draw as: Breakpoint split view',
        hold: 2000,
      },
      // The destination the docs and the figures take. The other button opens
      // the same view below the one it was launched from, which leaves a second
      // copy of the chr3 window with the same tracks one scroll above the answer.
      {
        type: 'click',
        text: 'Replace current view',
        say: 'Replace current view',
      },
      // Four panels, each a 10 kb window centred on the junction its segment
      // carries, and each carrying the launching view's whole track list — so
      // this is four pileup fetches. A film of that is a film of four spinners.
      { type: 'waitForAppSettled', timeout: 300000, cut: true },
      // Off the curves before the hold. `Replace current view` sat where the
      // middle panel's junction now is, so the pointer was left on a breakpoint
      // arc for the whole of the end state — and what the arc answers a hover
      // with is a tooltip naming both of its ends by feature uuid, standing over
      // the panel the hold is of.
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      // The end state, held: the curves are drawn BETWEEN panels rather than
      // inside one, so they are the last thing to arrive.
      { type: 'delay', ms: 5000 },
    ],
    tailMs: 5000,
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
  // `Sort by genotype` is a plain action row (multiSampleVariantMenuItems.ts,
  // `variantContextMenuItems`) and `Cluster rows by genotype...` is one that
  // queues a dialog, and `staysOpenOnClick` keeps only a checkbox or a radio up.
  {
    name: 'sv/multisample_sort',
    description:
      'Two orders over the 1000 Genomes cohort at the RHD deletion: right-click the block for Sort by genotype and the callset order resolves into three dosage bands, then Clustering, Cluster rows by genotype... and Run clustering re-key the same rows on the whole window and draw the tree they came out of',
    url: unsortedRhdPanel,
    // SIZED TO THE FIGURE, which is the same four lanes: `multisv_rhd` measures
    // them at 1230 and every one carries an explicit height (290 matrix, 330
    // depth, 170 records, 120 genes), so the app stands as tall at 1920 wide as
    // at that figure's 1500 — and nothing in the tour grows it. Both things the
    // route adds go sideways or nowhere: the dendrogram is a gutter reserved on
    // the LEFT (`treeSidebarOffset`), and the cluster dialog is centred in a
    // frame this tall with room to spare.
    //
    // 1236 rather than that figure's 1230: the run measured the app at 1234,
    // since the figure is captured at its content height and this is a fixed
    // frame that has to hold it.
    viewportHeight: 1236,
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
    settleMs: 30000,
    steps: [
      { type: 'hover', selector: '[aria-label="JBrowse"]', hold: 0 },
      // The before, held. It is the frame the whole clip is measured against,
      // and a reader who has scrolled past the banded figure needs a moment to
      // register that these rows are not in that order.
      { type: 'delay', ms: 3500 },
      // HGSV_1821's own span, so the click lands at the deletion's midpoint —
      // the same column `multisv_rhd` sorts on, named once in specs/ui.ts. The
      // sort keys on the variant UNDER the pointer (`contextMenuFeature`), so a
      // pixel here rather than a locus would be right only at the width it was
      // measured at, and wrong quietly: a right-click between two records offers
      // a menu with no "Sort by genotype" in it at all.
      {
        type: 'rightclick',
        anchor: { track: matrixTrackId, locus: deletionSpan, fracY: 0.5 },
        say: 'Right-click the deletion',
        hold: 1800,
      },
      { type: 'waitForText', text: 'Sort by genotype' },
      { type: 'click', text: 'Sort by genotype', say: 'Sort by genotype' },
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
      // Three contiguous bands, held long enough to read against the depth lane
      // under them, which is where the page sends the reader for the olive
      // column.
      { type: 'delay', ms: 4500 },
      {
        type: 'click',
        selector: trackMenu(matrixTrackId),
        say: 'Track menu',
        hold: 1800,
      },
      { type: 'waitForText', text: 'Clustering' },
      { type: 'click', text: 'Clustering', say: 'Clustering', hold: 1600 },
      { type: 'waitForText', text: 'Cluster rows by genotype...' },
      {
        type: 'click',
        text: 'Cluster rows by genotype...',
        say: 'Cluster rows by genotype...',
      },
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
        say: 'Run clustering',
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
      // The payoff frame, and a state no figure on the page carries: the tree in
      // the gutter beside rows keyed on the whole window rather than on one call.
      { type: 'delay', ms: 3500 },
    ],
    tailMs: 4000,
  },

  // THE TWO MENU ROUTES sv_visualization_cgiab.md's copy-number walkthrough
  // lists as bullets and pictures nowhere. Every cgiab figure that draws the
  // matched pair's coverage is taken with both already applied, so the page
  // shows the destination four times and the way there zero times — and the
  // second of them is a three-level cascade whose leaf word appears twice in
  // the one menu.
  //
  // The SECOND route is the one that changes the picture, and the first is why
  // the picture can be compared to the next one: an autoscaled axis is a
  // different axis in every window, so a plateau at the same height means
  // nothing across two of them. Filmed on chr5 the cap is a small move — local
  // autoscale gives this chromosome 0..2 and the cap makes it 0..3 — because
  // the spikes that run to 497 are elsewhere in the genome. What it buys is
  // visible in the figures around the clip rather than inside it, so the beat
  // is short and the chip names the control.
  //
  // Then the multi-row default gives each sample an axis of its own, which is
  // exactly what a reader must not have here: the claim is that the tumor steps
  // while its own normal holds still, and that is only a claim while both are
  // drawn against one axis. Overlapping is what puts them there, and the clip
  // ends on it — the lane the chr5 figure below the embed prints.
  {
    name: 'sv_cgiab/copy_number_layout',
    description:
      "HG008's tumor and normal coverage brought onto one axis: Score → Set min/max score... to pin the scale, then Plot type → Overlapping → Scatter, which redraws the two stacked rows as one band of points",
    url: cgiabVideoFixtures.coverageAsLoaded,
    // 406px of app at every frame the run measured — nothing here grows it,
    // since both routes rewrite settings on a lane that keeps its height — plus
    // the strip the caption chip is fixed into, which is off the FRAME's bottom
    // rather than the app's. The Set min/max dialog is ~206px centred in the
    // frame, so it lands inside the app at this height. Even, per the encode.
    viewportHeight: 520,
    // The rows have to be carrying the whole chromosome before the camera
    // starts. A tour of an autoscaled axis being capped is a tour of nothing
    // while the lane is empty.
    readySelector: displaySettled('multi-wiggle-display'),
    readyTimeout: 180000,
    settleMs: 12000,
    steps: [
      { type: 'hover', selector: WORDMARK, hold: 0 },
      // The state the track arrives in: one filled row per sample, each on its
      // own autoscaled axis, which is the layout the rest of the tour undoes.
      { type: 'delay', ms: 3000 },
      {
        type: 'click',
        selector: cgiabCoverageMenu,
        say: 'Track menu',
        hold: 1400,
      },
      { type: 'waitForSelector', selector: cascade('submenu', 'Score') },
      {
        type: 'click',
        selector: cascade('submenu', 'Score'),
        say: 'Score',
        hold: 1200,
      },
      {
        type: 'waitForSelector',
        selector: cascade('menuitem', 'Set min/max score...'),
      },
      {
        type: 'click',
        selector: cascade('menuitem', 'Set min/max score...'),
        say: 'Set min/max score...',
      },
      { type: 'waitForText', text: 'Set min/max score for track' },
      { type: 'delay', ms: 1500 },
      {
        type: 'type',
        selector: 'input[placeholder="Enter min score"]',
        value: '0',
        say: '0',
      },
      {
        type: 'type',
        selector: 'input[placeholder="Enter max score"]',
        value: '3',
        say: '3',
      },
      { type: 'delay', ms: 1200 },
      // MUI uppercases the button in CSS, so the match is the string the DOM
      // carries and the chip is the label a reader sees.
      { type: 'click', text: 'Submit', say: 'SUBMIT' },
      {
        type: 'waitForText',
        text: 'Set min/max score for track',
        hidden: true,
      },
      { type: 'hover', selector: WORDMARK, hold: 0 },
      { type: 'waitForAppSettled', timeout: 120000 },
      // The axis pinned, and still one of them per row.
      { type: 'delay', ms: 3500 },
      {
        type: 'click',
        selector: cgiabCoverageMenu,
        say: 'Track menu',
        hold: 1200,
      },
      { type: 'waitForSelector', selector: cascade('submenu', 'Plot type') },
      {
        type: 'click',
        selector: cascade('submenu', 'Plot type'),
        say: 'Plot type',
        hold: 1400,
      },
      { type: 'waitForSelector', selector: cascade('submenu', 'Overlapping') },
      {
        type: 'click',
        selector: cascade('submenu', 'Overlapping'),
        say: 'Overlapping',
        hold: 1400,
      },
      { type: 'waitForSelector', selector: cascade('menuitem', 'Scatter') },
      // The radio mark moving is the only frame that says which of the four
      // overlapping plot types is now in force.
      {
        type: 'click',
        selector: cascade('menuitem', 'Scatter'),
        say: 'Scatter',
        hold: 1400,
      },
      ...leaveTheMenu,
      { type: 'waitForAppSettled', timeout: 120000 },
      // The payoff, and the last state change in the clip: two samples as one
      // band of points, normal flat and tumor stepping under it.
      { type: 'delay', ms: 5000 },
    ],
    tailMs: 4000,
  },
]
