import { displaySettled } from '@jbrowse/browser-test-utils'

import { readIsoformNotice } from '../screenshot-spec-helpers.ts'

import type {
  ScreenshotAction,
  ScreenshotSpec,
} from '../screenshot-spec-types.ts'

// Figures for the AlphaGenome tutorial (tutorials/alphagenome.md), which shows
// model predictions rather than measurements — see demos/alphagenome/README.md
// for the fixture they are read from.
//
// EVERY FIGURE HERE HAS TO DRIVE THE PANEL, and that is not a style choice. A
// prediction's tracks address stored arrays through presigned urls that expire
// within the hour, so there is no session spec that can declare one: a config
// captured today loads nothing tomorrow. What a spec can do is rebuild the
// query, which is what a reader does, and let the service hand back the
// recording.
//
// THE CAPTURE MUST COST NOTHING, and it can only do that by landing on the
// recorded prediction exactly. Three things decide whether it does:
//
//   * the window. The service keys a request by its interval rounded to 4 kb
//     (SIGNATURE_GRID), and the demo config's `loc` is centered in the cell the
//     recordings were filed under. Panning the view before pressing Predict is
//     what would break it.
//   * every output type, via the `everything` preset. The panel defaults to
//     three.
//   * both biosamples. The panel defaults to K562 alone, so GM12878 is typed in.
//
// CACHED is therefore asserted, not hoped for, and it is the action right after
// Predict. An uncached click has already dispatched a real AlphaGenome call
// against a free-tier key by the time anything else could notice, so the
// failure has to be loud and immediate rather than a figure that merely took
// four minutes to render.
//
// SELECTORS ARE IDS, NOT TEXT, throughout, and the panel grew `data-testid`s so
// they could be. Every label in it is either unstable or ambiguous: `Add
// selected` renames itself to `Add N selected` the moment a row is ticked, the
// output-type chips carry a live track count in their text, and a row's label is
// a PREFIX of that same track's `(+)` and `(-)` rows and repeats again under a
// second output type. Each of those matches the wrong thing or nothing at all,
// rather than failing in a way that names the cause. The only ids here still
// derived from text are JBrowse's own `cascading-menuitem-<slug>`, which core
// builds that way for every menu row.
const CONFIG = 'https://jbrowse.org/demos/alphagenome/config.json'

// GM12878. K562 is the panel's own default, so only this one is ever typed.
const GM12878 = 'EFO:0002784'

// The Jurkat MuTE insertion: the variant the AlphaGenome team's worked example
// scores (alphagenomedocs.com/colabs/example_analysis_workflow.html), and the
// one the recorded variant prediction covers. Typed rather than right-clicked,
// and that is not a shortcut — see `variant_difference` below.
const JURKAT_INSERTION = 'chr1:47239297 C>CCGTTTCCTAACC'

// A variant with only one neighbour, for the figure that is ABOUT the
// right-click. `new 3' enhancer 1` starts two bases before `new 3' enhancer 2`,
// which at this zoom is inside one pixel, so the two pack into two rows and
// nothing else is near them. `fracY` picks the first of those rows — a fraction
// of the band rather than a pixel, so it survives a track that changes height.
//
// WHICH of the two the click lands on no longer changes the figure, and the id
// no longer says: the row names the action rather than the variant, so it is
// the same string whatever is under the cursor. What the assertion still pins
// is that the click hit a variant at all — the row is contributed by the
// plugin and a miss opens the display's own menu without it.
const ENHANCER_1_LOCUS = 'chr1:47,212,073'
const TOP_ROW = 0.1
const PREDICT_VARIANT_EFFECT =
  '[data-testid="cascading-menuitem-predict_variant_effect_with_alphagenome"]'

// The biosample box is DISABLED until the ~5,900-track catalog arrives, and a
// disabled input silently swallows a click and the typing after it. Gating on
// the placeholder instead does not work and reads as though it does: MUI drops
// an Autocomplete's placeholder as soon as it has a chip, and this one starts
// with K562 already chosen, so "the placeholder is gone" is true before the
// catalog has loaded at all.
const BIOSAMPLE_READY =
  '[data-testid="alphagenome-biosamples"] input:not([disabled])'

// The typed biosample is the ONLY row in the dropdown, which is the part worth
// asserting. Selection is by keyboard because that is what MUI's Autocomplete
// responds to, and ArrowDown lands on whichever row happens to be first — so
// "the row I want is present" is not enough on its own, and `:only-of-type` is
// what makes first and wanted the same row.
const soleBiosample = (curie: string) =>
  `[role="listbox"] li:only-of-type[data-testid="alphagenome-biosample-${curie}"]`

// Open the panel with all eleven output types and both cell lines chosen — the
// query the recordings answer.
//
// No Escape anywhere in here. It is the obvious way to dismiss the biosample
// dropdown and it closes the whole dialog instead, which then fails several
// actions later on a missing button rather than here.
const buildQuery: ScreenshotAction[] = [
  { type: 'click', selector: '[data-testid="view_menu_icon"]' },
  {
    type: 'click',
    selector: '[data-testid="cascading-menuitem-alphagenome_predictions…"]',
  },
  { type: 'waitForSelector', selector: BIOSAMPLE_READY, timeout: 120000 },
  { type: 'click', selector: '[data-testid="alphagenome-preset-everything"]' },
  { type: 'type', selector: BIOSAMPLE_READY, value: 'GM12878' },
  { type: 'waitForSelector', selector: soleBiosample(GM12878) },
  { type: 'press', key: 'ArrowDown' },
  { type: 'press', key: 'Enter' },
]

const predictCached: ScreenshotAction[] = [
  { type: 'click', selector: '[data-testid="alphagenome-predict"]' },
  {
    type: 'waitForSelector',
    selector: '[data-testid="alphagenome-cached"]',
    timeout: 30000,
  },
]

// Narrow the picker to one output type and one search, which is what makes a
// row id unambiguous. `clear` because the filter keeps what the previous pick
// typed into it.
const pick = (outputType: string, query: string): ScreenshotAction[] => [
  {
    type: 'click',
    selector: `[data-testid="alphagenome-output-${outputType}"]`,
  },
  {
    type: 'type',
    selector: '[data-testid="alphagenome-filter"]',
    value: query,
    clear: true,
  },
]

const row = (outputType: string, slug: string) => ({
  type: 'click' as const,
  selector: `[data-testid="alphagenome-track-${outputType}-${slug}"]`,
})

// Add what is ticked, close the panel, and let the view draw it.
//
// The panel is closed by its (×) rather than by Escape, and the close is
// ASSERTED. MUI delivers Escape through the modal rather than the document, so
// it needs focus inside the dialog — and clicking "Add selected" leaves focus on
// the body, because that button disables itself the moment the tick clears. The
// press then closes nothing, every later action goes on succeeding under the
// panel, and the run writes a figure of the open dialog: five of the six here,
// with nothing saying so. The gene track's "Isoforms trimmed" chip is read
// (`readIsoformNotice`) rather than hidden: reading it is what a reader does,
// and it leaves the quiet control behind, where hiding the element takes the
// whole control out of the figure.
const CLOSE_DIALOG: ScreenshotAction[] = [
  { type: 'click', selector: '[data-testid="dialog-close"]' },
  { type: 'waitForSelector', selector: '.MuiDialog-root', hidden: true },
]

const addAndSettle = (display: string): ScreenshotAction[] => [
  { type: 'click', selector: '[data-testid="alphagenome-add-selected"]' },
  ...CLOSE_DIALOG,
  ...readIsoformNotice(),
  {
    type: 'waitForSelector',
    selector: displaySettled(display),
    timeout: 120000,
  },
  { type: 'waitForAppSettled' },
]

// Shared by every spec here.
//
// No readyText/readySelector, deliberately. The obvious gate is the gene track's
// TAL1 label, and it does not work: feature labels are drawn to canvas with a
// text layer beside them that innerText reads and `waitForVisible` does not, so
// the wait times out over a page that has plainly rendered. The view-phase and
// app-ready gates cover startup, and each spec's own waits — the biosample box
// becoming enabled, the cached chip, the display settling — are what these
// figures actually depend on.
//
// `hideTooltip` because the view menu is opened by clicking its icon, which
// leaves that icon's tooltip standing in the corner for the whole run.
const common = {
  mode: 'url' as const,
  url: `?config=${CONFIG}`,
  readyTimeout: 120000,
  hideTooltip: true,
}

export const alphagenomeSpecs: ScreenshotSpec[] = [
  // The claim the tutorial is built on: predicted RNA-seq in two cell types is
  // a comparison only when the two rows share a y-axis.
  //
  // The two rows are the UNSTRANDED polyA plus tracks, not the (+)/(-) pair,
  // because the point being made is about cell types rather than about strand —
  // and the stranded rows would put four rows on the axis, where the two that
  // differ by cell line are no longer the obvious pairing.
  //
  // TAL1 is on in K562 (erythroleukemia) and off in GM12878 (lymphoblastoid),
  // so the GM12878 row being flat where the K562 row is not is the figure. STIL,
  // to the right, is predicted in both — which is what keeps the flat row from
  // reading as a track that simply failed to load.
  {
    ...common,
    name: 'alphagenome/expression_two_cell_lines',
    actions: [
      ...buildQuery,
      ...predictCached,
      ...pick('rna_seq', 'polyA plus'),
      row('rna_seq', 'k562-polya-plus-rna-seq'),
      row('rna_seq', 'gm12878-polya-plus-rna-seq'),
      ...addAndSettle('multi-wiggle-display'),
    ],
    // The app is content-sized here rather than filling the frame, so this is
    // slack above the tallest state and not a crop — raising it only adds page
    // background, which the run reports.
    viewportHeight: 700,
  },

  // Accessibility is ONE scale, and this is the case the shared axis was built
  // for: a DNase peak that is real in K562 should also be an ATAC peak in K562,
  // and neither should be conspicuous in GM12878. Four rows, two assays, one
  // y-axis.
  //
  // Two picks rather than one, because the output-type chips are single-select
  // and no text query spans both assays. Ticks survive a filter change, so
  // DNase, then ATAC, then a single Add puts all four in one track — which is
  // the point, and what adding twice would not do.
  {
    ...common,
    name: 'alphagenome/accessibility_shared_axis',
    actions: [
      ...buildQuery,
      ...predictCached,
      ...pick('dnase', 'DNase'),
      row('dnase', 'k562-dnase-seq'),
      row('dnase', 'gm12878-dnase-seq'),
      ...pick('atac', 'ATAC'),
      row('atac', 'k562-atac-seq'),
      row('atac', 'gm12878-atac-seq'),
      ...addAndSettle('multi-wiggle-display'),
    ],
    viewportHeight: 800,
  },

  // Splice junctions come back as arcs — a sashimi plot — and never join a
  // stacked track, because they are not a quantitative row.
  //
  // K562's alone. The claim is that the arcs land on the same exon boundaries
  // the RefSeq track draws, which is about one track against the annotation
  // rather than about two cell lines.
  {
    ...common,
    name: 'alphagenome/splice_junctions',
    actions: [
      ...buildQuery,
      ...predictCached,
      ...pick('splice_junctions', 'K562'),
      row('splice_junctions', 'k562-polya-plus-rna-seq'),
      ...addAndSettle('arc-display'),
    ],
    viewportHeight: 760,
  },

  // Contact maps come at 2 kb bins and only for about a dozen cell lines.
  // GM12878 is the one this prediction carries, and the only row the
  // contact_maps filter offers.
  //
  // The view is widened to the whole predicted megabase AFTER the track is
  // added, and it has to be that order. The request is keyed by the window the
  // view was showing when Predict was pressed, so navigating first would ask a
  // different question and miss the recording; navigating afterwards is free,
  // because the arrays are already stored and the adapter range-reads them.
  // The 70 kb the rest of these figures use is 35 bins across — too coarse to
  // show anything, which is what makes this the one figure that has to move.
  {
    ...common,
    name: 'alphagenome/contact_map',
    actions: [
      ...buildQuery,
      ...predictCached,
      ...pick('contact_maps', 'GM12878'),
      row('contact_maps', 'gm12878-in-situ-hi-c'),
      { type: 'click', selector: '[data-testid="alphagenome-add-selected"]' },
      ...CLOSE_DIALOG,
      // dismissed while still at 70 kb, where the chip is known to be up; the
      // display remembers, so it does not come back on the way out
      ...readIsoformNotice(),
      {
        type: 'type',
        selector: 'input[placeholder="Search for location"]',
        value: 'chr1:46,700,544..47,749,119',
        clear: true,
      },
      { type: 'press', key: 'Enter' },
      { type: 'waitForAppSettled' },
      {
        type: 'waitForSelector',
        selector: displaySettled('hic-display'),
        timeout: 120000,
      },
      { type: 'waitForAppSettled' },
    ],
    viewportHeight: 820,
  },

  // The gesture nobody finds by accident, and the figure is what makes it
  // findable: the row reads `Predict variant effect with AlphaGenome`, which is
  // the whole action, and clicking it opens the panel with that variant already
  // loaded rather than queueing it somewhere the reader then has to go looking.
  //
  // Its id is JBrowse's own label-derived `cascading-menuitem-<slug>`, so the
  // selector tracks the label — which is now a constant, where it used to carry
  // whatever the demo BED called the feature under the cursor.
  //
  // The canvas variant display has no DOM node per feature, so the right-click
  // is anchored to the locus (scripts/locusAnchor.ts) rather than to a measured
  // pixel — a number that would be correct only at the width and layout it was
  // measured against.
  {
    ...common,
    name: 'alphagenome/predict_variant_menu',
    actions: [
      ...readIsoformNotice(),
      {
        type: 'rightclick',
        anchor: {
          locus: ENHANCER_1_LOCUS,
          track: 'tal1_variants',
          fracY: TOP_ROW,
        },
      },
      {
        type: 'waitForSelector',
        selector: PREDICT_VARIANT_EFFECT,
        timeout: 30000,
      },
    ],
    // the context menu is the subject and it opens downward from the variant
    // row, so the frame has to cover the menu rather than just the tracks
    viewportHeight: 620,
  },

  // What a variant prediction gives you: the reference and alternate curves side
  // by side, and their difference on its own row.
  //
  // The pair is there to be looked at first — at this scale the two curves sit
  // almost exactly on top of each other, which is the reason the difference gets
  // a row of its own. On that row, positive is where the insertion raises
  // predicted expression, and it is flat almost everywhere: one insertion
  // changes one thing, and what it changes is TAL1. A difference track lit up
  // across the whole megabase would be a prediction responding to the request
  // rather than to the variant, with no way to tell which part was the insertion.
  //
  // The variant is TYPED rather than right-clicked, and this is the one place
  // that choice is worth defending. Only the Jurkat insertion has a recording,
  // and it is not reachable by right-click here: ~30 of the demo BED's variants
  // sit within six bases of each other, JBrowse packs them by start coordinate,
  // and Jurkat lands in the fifth row — below the track's visible band, so every
  // point in it belongs to Patient_2, PATRAB, PASFKA or Patient_7. Picking it
  // would take a measured fracY that is right only until the track's height or
  // the BED's contents move. The typed box reaches exactly one variant by name,
  // and the tutorial documents it for the same reason it exists: the right-click
  // is the gesture nobody finds, not the only way in.
  //
  // Queued before Predict, so this run's request is the VARIANT recording rather
  // than the interval one — a different fixture, reached the same way and
  // asserted the same way.
  {
    ...common,
    name: 'alphagenome/variant_difference',
    actions: [
      ...buildQuery,
      {
        type: 'click',
        selector: '[data-testid="alphagenome-variant-type-one-in"]',
      },
      {
        type: 'type',
        selector: '[data-testid="alphagenome-variant-input"]',
        value: JURKAT_INSERTION,
      },
      { type: 'click', selector: '[data-testid="alphagenome-variant-use"]' },
      ...predictCached,
      ...pick('rna_seq', 'polyA plus'),
      row('rna_seq', 'k562-polya-plus-rna-seq'),
      ...addAndSettle('multi-wiggle-display'),
    ],
    viewportHeight: 860,
  },
]
