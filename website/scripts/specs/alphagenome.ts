import { displaySettled } from '@jbrowse/browser-test-utils'

import { readIsoformNotice } from '../screenshot-spec-helpers.ts'

import type {
  ScreenshotAction,
  ScreenshotSpec,
  SessionUrlSpec,
} from '../screenshot-spec-types.ts'

// Every figure drives the panel: a prediction's presigned urls expire within
// the hour, so no session spec can declare its tracks.
//
// A capture must hit the recorded prediction (demos/alphagenome/README.md), or
// it makes a real AlphaGenome call. The recording's key needs:
//   * the demo config's `loc` unpanned; the service rounds intervals to 4 kb
//   * the `everything` preset
//   * exactly the biosamples below
// `predictCached` asserts the hit right after Predict.
//
// Select by testid, never by panel text: labels change with ticks and counts,
// and a row's label prefixes its `(+)`/`(-)` rows.
const CONFIG = 'https://jbrowse.org/demos/alphagenome/config.json'

const GM12878 = 'EFO:0002784'
const CD34_PROGENITOR = 'CL:0001059'
const CD34_SLUG = 'common-myeloid-progenitor-cd34-positive'

// The worked example's variant
// (alphagenomedocs.com/colabs/example_analysis_workflow.html), and the one the
// recorded variant prediction covers.
const JURKAT_INSERTION = 'chr1:47239296 C>CCGTTTCCTAACC'
const VARIANT_TOKEN = 'demo-tal1-variant-cd34'

// The enhancer 1/2 pair packs into two rows with nothing else near; `TOP_ROW`
// picks the first. A miss opens the display's own menu, which lacks the
// plugin's row, so the wait on `PREDICT_VARIANT_EFFECT` fails loudly.
const ENHANCER_1_LOCUS = 'chr1:47,212,072'
const TOP_ROW = 0.1
const PREDICT_VARIANT_EFFECT =
  '[data-testid="cascading-menuitem-predict_variant_effect_with_alphagenome"]'

// The biosample box stays disabled until the catalog arrives and silently
// swallows typing. Its placeholder is gone from the start (K562 is a chip), so
// gating on it passes too early.
const BIOSAMPLE_READY =
  '[data-testid="alphagenome-biosamples"] input:not([disabled])'

// ArrowDown picks the first row, so `:only-of-type` makes first and wanted the
// same row.
const soleBiosample = (curie: string) =>
  `[role="listbox"] li:only-of-type[data-testid="alphagenome-biosample-${curie}"]`

const BIOSAMPLE_CHIP = (index: number) =>
  `[data-testid="alphagenome-biosamples"] [data-item-index="${index}"]`

// Escape closes the whole dialog, not just the biosample dropdown.
const openPanel: ScreenshotAction[] = [
  { type: 'click', selector: '[data-testid="view_menu_icon"]' },
  {
    type: 'click',
    selector: '[data-testid="cascading-menuitem-alphagenome_predictions…"]',
  },
  { type: 'waitForSelector', selector: BIOSAMPLE_READY, timeout: 120000 },
  { type: 'click', selector: '[data-testid="alphagenome-preset-everything"]' },
]

const addBiosample = (query: string, curie: string): ScreenshotAction[] => [
  { type: 'type', selector: BIOSAMPLE_READY, value: query },
  { type: 'waitForSelector', selector: soleBiosample(curie) },
  { type: 'press', key: 'ArrowDown' },
  { type: 'press', key: 'Enter' },
]

const buildQuery: ScreenshotAction[] = [
  ...openPanel,
  ...addBiosample('GM12878', GM12878),
]

// The absent second chip proves K562 went; a query still carrying it misses the
// recording.
const buildCd34Query: ScreenshotAction[] = [
  ...openPanel,
  {
    type: 'click',
    selector: `${BIOSAMPLE_CHIP(0)} .MuiChip-deleteIcon`,
  },
  { type: 'waitForSelector', selector: BIOSAMPLE_CHIP(0), hidden: true },
  ...addBiosample('CD34', CD34_PROGENITOR),
  { type: 'waitForSelector', selector: BIOSAMPLE_CHIP(0) },
  { type: 'waitForSelector', selector: BIOSAMPLE_CHIP(1), hidden: true },
]

const predictCached: ScreenshotAction[] = [
  { type: 'click', selector: '[data-testid="alphagenome-predict"]' },
  {
    type: 'waitForSelector',
    selector: '[data-testid="alphagenome-cached"]',
    timeout: 30000,
  },
]

// The filter keeps the previous pick's text, hence `clear`.
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

// Escape closes nothing here: "Add selected" disables itself and leaves focus
// on the body, and the run then captures the open dialog. Close by (×) and
// assert it.
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

// A readyText of `TAL1` times out: `waitForVisible` cannot see canvas labels.
// `tooltip: 'hide'` drops the view menu icon's tooltip, which the first click
// leaves standing.
const common = {
  mode: 'url' as const,
  url: `?config=${CONFIG}`,
  readyTimeout: 120000,
  tooltip: 'hide',
} satisfies Partial<SessionUrlSpec>

export const alphagenomeSpecs: ScreenshotSpec[] = [
  // Unstranded rows: the stranded pair would put four rows on the axis. STIL,
  // predicted in both, keeps the flat GM12878 row from reading as a failed load.
  {
    ...common,
    name: 'alphagenome/expression_two_cell_lines',
    actions: [
      ...buildQuery,
      ...predictCached,
      ...pick('rna_seq', 'polyA plus'),
      row('rna_seq', 'k562-polya-plus-rna-seq'),
      row('rna_seq', 'gm12878-polya-plus-rna-seq'),
      ...addAndSettle('wiggle-display'),
    ],
    viewportHeight: 640,
  },

  // Ticks survive a filter change, so one Add after both picks puts all four
  // rows in one track; adding twice makes two tracks.
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
      ...addAndSettle('wiggle-display'),
    ],
    viewportHeight: 800,
  },

  {
    ...common,
    name: 'alphagenome/splice_junctions',
    actions: [
      ...buildQuery,
      ...predictCached,
      ...pick('splice_junctions', 'polyA plus'),
      row('splice_junctions', 'k562-polya-plus-rna-seq'),
      row('splice_junctions', 'gm12878-polya-plus-rna-seq'),
      ...addAndSettle('mark-display'),
      {
        type: 'type',
        selector: 'input[placeholder="Search for location"]',
        value: 'chr1:47,207,000..47,235,000',
        clear: true,
      },
      { type: 'press', key: 'Enter' },
      { type: 'waitForAppSettled' },
    ],
    viewportHeight: 690,
    annotations: [
      {
        type: 'text',
        text: 'GM12878: TAL1 is off, so no junctions',
        fontSize: 18,
        anchor: {
          trackId: 'demo-tal1-interval-junctions-reference-2',
          loc: 'chr1:47,221,000',
          fracY: 0.5,
        },
      },
    ],
  },

  // Widen to the predicted megabase only after Predict: the window at Predict
  // keys the recording.
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
      // read at 70 kb, where the chip is known to be up
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
    viewportHeight: 670,
  },

  {
    ...common,
    name: 'alphagenome/predict_variant_menu',
    actions: [
      ...readIsoformNotice(),
      {
        type: 'rightclick',
        anchor: {
          loc: ENHANCER_1_LOCUS,
          trackId: 'tal1_variants',
          fracY: TOP_ROW,
        },
      },
      {
        type: 'waitForSelector',
        selector: PREDICT_VARIANT_EFFECT,
        timeout: 30000,
      },
      { type: 'delay', ms: 500 },
    ],
    annotations: [
      { type: 'box', anchor: { selector: PREDICT_VARIANT_EFFECT } },
    ],
    // the frame must cover the menu, which opens downward from the variant row
    viewportHeight: 620,
  },

  // The DNase difference turns off outlier clipping: the default clip flattens
  // the single-base gains at the insertion. Jurkat is typed because it packs
  // below the variant track's visible band, out of right-click reach.
  {
    ...common,
    name: 'alphagenome/variant_difference',
    actions: [
      ...buildCd34Query,
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
      row('rna_seq', `${CD34_SLUG}-polya-plus-rna-seq`),
      ...pick('dnase', 'DNase'),
      row('dnase', `${CD34_SLUG}-dnase-seq`),
      ...pick('chip_histone', 'H3K27ac'),
      row('chip_histone', `${CD34_SLUG}-h3k27ac-histone-chip-seq`),
      ...addAndSettle('wiggle-display'),
      {
        type: 'type',
        selector: 'input[placeholder="Search for location"]',
        value: 'chr1:47,212,000..47,244,000',
        clear: true,
      },
      { type: 'press', key: 'Enter' },
      { type: 'waitForAppSettled' },
      ...['dnase.0', 'rna_seq.0', 'chip_histone.0'].map(output => ({
        type: 'click' as const,
        selector: `[data-testid="track-close-${VARIANT_TOKEN}-both-${output}"]`,
      })),
      { type: 'waitForAppSettled' },
      {
        type: 'click',
        selector: `[data-testid="track_menu_icon"][data-trackid="${VARIANT_TOKEN}-delta-dnase.0"]`,
      },
      { type: 'click', text: 'Y axis...' },
      { type: 'click', text: 'Clip extreme outliers' },
      { type: 'click', selector: 'button[aria-label="Close drawer"]' },
      { type: 'waitForAppSettled' },
    ],
    viewportHeight: 740,
    annotations: [
      {
        type: 'text',
        text: 'accessibility gained at the Jurkat insertion',
        fontSize: 18,
        leader: true,
        anchor: {
          trackId: `${VARIANT_TOKEN}-delta-dnase.0`,
          loc: 'chr1:47,239,296',
          fracY: 0.3,
        },
        dx: -60,
      },
      {
        type: 'text',
        text: 'TAL1 transcription rises',
        fontSize: 18,
        leader: true,
        anchor: {
          trackId: `${VARIANT_TOKEN}-delta-rna_seq.0`,
          loc: 'chr1:47,220,300',
          fracY: 0.4,
        },
        dx: 60,
      },
      {
        type: 'text',
        text: 'H3K27ac gained across the locus',
        fontSize: 18,
        anchor: {
          trackId: `${VARIANT_TOKEN}-delta-chip_histone.0`,
          loc: 'chr1:47,212,300',
          fracY: 0.3,
        },
      },
    ],
  },
]
