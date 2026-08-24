import { displaySettled } from '@jbrowse/browser-test-utils'

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
//   * every output type, via the `Everything` preset. The panel defaults to
//     three.
//   * both biosamples. The panel defaults to K562 alone, so GM12878 is typed in.
//
// CACHED is therefore asserted, not hoped for: `waitForText` on the chip is the
// gate, and it is deliberately the action right after Predict. An uncached
// click has already dispatched a real AlphaGenome call against a free-tier key
// by the time anything else could notice, so the failure has to be loud and
// immediate rather than a figure that merely took four minutes to render.
const CONFIG = 'https://jbrowse.org/demos/alphagenome/config.json'

// The biosample box is DISABLED until the ~5,900-track catalog arrives, and a
// disabled input silently swallows a click and the typing after it. Gating on
// the placeholder instead does not work and reads as though it does: MUI drops
// an Autocomplete's placeholder as soon as it has a chip, and this one starts
// with K562 already chosen, so "the placeholder is gone" is true before the
// catalog has loaded at all.
const BIOSAMPLE_READY =
  '[data-testid="alphagenome-biosamples"] input:not([disabled])'

// Open the panel with all eleven output types and both cell lines chosen — the
// query the recording answers.
//
// No Escape anywhere in here. It is the obvious way to dismiss the biosample
// dropdown and it closes the whole dialog instead, which then fails several
// actions later on a missing button rather than here.
const buildQuery: ScreenshotAction[] = [
  { type: 'click', selector: '[data-testid="view_menu_icon"]' },
  { type: 'click', selector: '::-p-text(AlphaGenome predictions…)' },
  { type: 'waitForSelector', selector: BIOSAMPLE_READY, timeout: 120000 },
  { type: 'click', selector: '[data-testid="alphagenome-preset-everything"]' },
  {
    type: 'type',
    selector: BIOSAMPLE_READY,
    value: 'GM12878',
  },
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
  // in the lane below, is predicted in both — which is what keeps the flat row
  // from reading as a track that simply failed to load.
  {
    mode: 'url',
    name: 'alphagenome/expression_two_cell_lines',
    url: `?config=${CONFIG}`,
    // No readyText/readySelector, deliberately. The obvious gate is the gene
    // track's TAL1 label, and it does not work: feature labels are drawn to
    // canvas with a text layer beside them that innerText reads and
    // `waitForVisible` does not, so the wait times out over a page that has
    // plainly rendered. The view-phase and app-ready gates cover startup, and
    // the query's own waits below — the biosample box becoming enabled, the
    // cached chip, the multi-wiggle settling — are what this figure actually
    // depends on.
    readyTimeout: 120000,
    actions: [
      ...buildQuery,
      ...predictCached,
      // The output-type chip narrows to RNA-seq; the text filter then leaves the
      // six polyA plus rows. Both are needed: the chip alone still lists every
      // K562 RNA-seq assay, and the filter alone matches the splice-site-usage
      // and junction rows built from the same tracks.
      { type: 'click', selector: '[data-testid="alphagenome-output-rna_seq"]' },
      {
        type: 'type',
        selector: '[data-testid="alphagenome-filter"]',
        value: 'polyA plus',
      },
      {
        type: 'click',
        selector:
          '[data-testid="alphagenome-track-rna_seq-k562-polya-plus-rna-seq"]',
      },
      {
        type: 'click',
        selector:
          '[data-testid="alphagenome-track-rna_seq-gm12878-polya-plus-rna-seq"]',
      },
      { type: 'click', selector: '[data-testid="alphagenome-add-selected"]' },
      // the dialog is modal and covers the view it just added a track to.
      // Escape is safe HERE and nowhere earlier — closing the panel is the
      // whole intent, rather than the side effect it would be mid-query.
      { type: 'press', key: 'Escape' },
      // The gene track raises an "Isoforms trimmed to fit" chip that sits over
      // the transcripts it is about. Dismissed rather than hidden: dismissing is
      // what a reader does, and it leaves the quiet control behind, where
      // hiding the element takes the whole control out of the figure.
      { type: 'click', selector: '[data-testid="track-control-dismiss"]' },
      {
        type: 'waitForSelector',
        selector: displaySettled('multi-wiggle-display'),
        timeout: 120000,
      },
      { type: 'waitForAppSettled' },
    ],
    // The view menu is opened by clicking its icon, which leaves that icon's
    // tooltip standing in the corner for the whole run.
    hideTooltip: true,
    // The app is content-sized here rather than filling the frame, so this is
    // slack above the tallest state and not a crop — raising it only adds page
    // background, which the run reports.
    viewportHeight: 700,
  },
]
