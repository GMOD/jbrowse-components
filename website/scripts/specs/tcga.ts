import { displayPainted, displaySettled } from '@jbrowse/browser-test-utils'

import { KG_CONFIG, sessionSpec } from '../screenshot-spec-helpers.ts'
import { pageTrack } from './pageTrack.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

// The 1000 Genomes hg38 assembly names its contigs bare (`1`, `X`); the BED's
// `chr` names resolve through refNameAliases. The BED has no chrY segments.
const HG38_MAIN_CHROMS = [
  ...Array.from({ length: 22 }, (_, i) => String(i + 1)),
  'X',
]

const CNV_DOC = 'tutorials/tcga_cohort_cnv.md'

const TCGA_BRCA_CNV_TRACK = pageTrack(CNV_DOC, 'tcga_brca_cnv')

const TCGA_BRCA_RECURRENCE_TRACK = pageTrack(
  CNV_DOC,
  'tcga_brca_cnv_recurrence',
)

// Subtype callouts measure their dy in SUBTYPE_ROW_PITCH, one subtype's row.
const SUBTYPE_ROWS_HEIGHT = 500
const SUBTYPE_ROW_PITCH = SUBTYPE_ROWS_HEIGHT / 4

// `labelDy`/`headDy` are fractions of the row's height, so the callouts follow
// a change to SUBTYPE_ROWS_HEIGHT.
function subtypeCallout({
  text,
  locus,
  row,
  labelDy,
  headDy,
  labelDx,
}: {
  text: string
  locus: string
  row: number
  labelDy: number
  headDy: number
  labelDx: number
}): Annotation[] {
  const at = {
    trackId: 'tcga_brca_cnv_recurrence_by_subtype',
    loc: locus,
    fracY: 0,
  }
  const y = (frac: number) => (row + frac) * SUBTYPE_ROW_PITCH
  // The arrow goes first so the label's opaque pill draws over its tail.
  const tailDx = labelDx > 0 ? labelDx - 20 : labelDx + 20
  return [
    {
      type: 'arrow',
      fromAnchor: { ...at, dx: tailDx, dy: y(labelDy) },
      anchor: { ...at, dy: y(headDy) },
    },
    {
      type: 'text',
      text,
      fontSize: 18,
      maxWidth: 240,
      anchor: { ...at, dy: y(labelDy) },
      dx: labelDx,
    },
  ]
}

const TCGA_BRCA_RECURRENCE_BY_SUBTYPE_TRACK = pageTrack(
  CNV_DOC,
  'tcga_brca_cnv_recurrence_by_subtype',
)

// TreeSidebar mounts its dendrogram only once clustering has finished.
const CLUSTERED = '[data-testid="tree_sidebar_dendrogram"]'

// The clustering tour films the ERBB2 window, since whole-genome is too heavy to
// software-rasterize per frame. `runClustering` stays absent: the tour starts
// unsorted, the state a reader is in.
export const tcgaVideoFixtures = {
  trackId: 'tcga_brca_cnv',
  // The canvas carries no readiness attributes, so a readiness selector on it
  // never matches; the chrome div does.
  painted: displaySettled('mark-display'),
  unclusteredErbb2: sessionSpec(KG_CONFIG, {
    sessionTracks: [TCGA_BRCA_CNV_TRACK],
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc: '17:39,000,000-40,500,000',
        highlight: ['17:39,688,094-39,728,658'],
        trackLabels: 'offset',
        tracks: [
          {
            trackId: 'tcga_brca_cnv',
            // At the default height the 1104 rows auto-fit into ~100px and the
            // sort has no room to show.
            height: 700,
          },
        ],
      },
    ],
  }),
}

// BRCA1 (germline, not copy number) and PTEN (too faint here) stay unlabeled.
//
// `labelDy`/`headDy` are px below the stack's top edge, since the ~1105px stack
// runs off the bottom of the viewport. MYC's large `labelDx` and CDKN2A's lower
// row keep their pills apart; the two stripes sit ~20px apart.
const RECURRENT_LOCI = [
  { gene: 'MYC (8q24)', locus: '8:127,735,434', labelDx: -162, tailDx: -22 },
  {
    gene: 'CDKN2A (9p21)',
    locus: '9:21,967,752',
    labelDx: -44,
    tailDx: 26,
    labelDy: 645,
    headDy: 457,
  },
  { gene: 'CCND1 (11q13)', locus: '11:69,641,156', labelDx: -63, tailDx: -3 },
  { gene: 'ERBB2 (17q12)', locus: '17:39,688,094', labelDx: -69, tailDx: -4 },
]

const COHORT_TRACK_ID = 'tcga_brca_cnv'

// The page restates the mutation track in each section that groups it, so a
// figure names the section whose config it draws.
const MUTATIONS_DOC = 'tutorials/tcga_cohort_mutations.md'
const HISTOLOGY_SECTION = 'Facet the rows by clinical annotation'
const SUBTYPE_SECTION = 'Facet rows by receptor subtype'

const MATRIX_DONE = displayPainted('variant-matrix-display')

// About a third of a pixel per tumor, so a band's mutation density reads as
// darkness. One visible row per tumor (1900px) spreads that contrast over two
// screens of grey.
const MATRIX_ROWS_HEIGHT = 320

// The floating legend pins to the display's top right; below this height it
// covers PIK3CA's H1047R hotspot instead of the connector zone.
const LINE_ZONE_HEIGHT = 130

const MATRIX_CHROME_HEIGHT = 330

const collapseIntrons = (gene: string) => [
  { type: 'waitForText' as const, text: gene },
  { type: 'rightclick' as const, text: gene },
  { type: 'waitForText' as const, text: 'Collapse introns' },
  { type: 'click' as const, text: 'Collapse introns' },
  { type: 'waitForText' as const, text: 'Replace current view' },
  {
    type: 'click' as const,
    selector: 'button::-p-text(Replace current view)',
  },
  {
    type: 'waitForText' as const,
    text: 'Replace current view',
    hidden: true,
  },
  {
    type: 'waitForSelector' as const,
    selector: '[data-testid="loading-overlay"]',
    hidden: true,
  },
  { type: 'waitForSelector' as const, selector: MATRIX_DONE, timeout: 180000 },
]

// 84px is two MANE rows: content starts ~4px in and the row pitch is 40px.
const MANE_TRACK = {
  trackId: 'MANE.GRCh38.v1.4.refseq',
  height: 84,
}

const CLINVAR_TRACK = {
  trackId: 'clinvar_ncbi_hg38',
  type: 'LinearVariantDisplay',
  records: { displayMode: 'collapsed' },
  height: 40,
}

// The mutation-rate bedGraph has one interval per gene, so over one gene each
// subtype draws a flat level; a figure of it needs a many-gene window.

function mutationFigure({
  loc,
  section,
  clinvar = false,
  displayOverrides = {},
}: {
  loc: string
  section: string
  clinvar?: boolean
  displayOverrides?: Record<string, unknown>
}) {
  return sessionSpec(KG_CONFIG, {
    sessionTracks: [
      pageTrack(MUTATIONS_DOC, 'tcga_brca_mutations', { section }),
    ],
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc,
        trackLabels: 'offset',
        tracks: [
          MANE_TRACK,
          ...(clinvar ? [CLINVAR_TRACK] : []),
          {
            trackId: 'tcga_brca_mutations',
            variantLayout: 'columns',
            ...displayOverrides,
          },
        ],
      },
    ],
  })
}

// The CDH1 figure's session before its `actions` collapse the introns.
export const tcgaMutationVideoFixtures = {
  gene: 'CDH1',
  matrixDone: MATRIX_DONE,
  cdh1WholeTranscript: mutationFigure({
    loc: '16:68,730,000-68,842,000',
    section: HISTOLOGY_SECTION,
  }),
}

export const tcgaSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'tcga/cohort_cnv_genome',
    url: sessionSpec(KG_CONFIG, {
      sessionTracks: [TCGA_BRCA_RECURRENCE_TRACK, TCGA_BRCA_CNV_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          displayedRegionNames: HG38_MAIN_CHROMS,
          trackLabels: 'offset',
          tracks: [
            {
              trackId: 'tcga_brca_cnv_recurrence',
              height: 120,
            },
            {
              trackId: 'tcga_brca_cnv',
              height: 760,
              runClustering: true,
              axis: { tree: true },
            },
          ],
        },
      ],
    }),
    readySelector: CLUSTERED,
    // networkidle0 cannot land within puppeteer's 60s navigation timeout while
    // the 5.7MB BED streams
    waitUntil: 'domcontentloaded',
    // SwiftShader's passes over the 1104-row canvas take minutes; see
    // agent-docs/reference/FIGURE_CAPTURE.md, "Slow figures are SwiftShader".
    readyTimeout: 900000,
    viewportWidth: 1900,
    // a shorter viewport clips the bottom rows of the 760px stack
    viewportHeight: 1132,
    // 1104 one-pixel rows jitter at row boundaries between runs
    diffThreshold: 0.02,
    annotations: RECURRENT_LOCI.flatMap(
      ({ gene, locus, labelDx, tailDx, labelDy = 532, headDy = 422 }) => {
        const at = { trackId: COHORT_TRACK_ID, loc: locus, fracY: 0 }
        return [
          {
            type: 'text' as const,
            text: gene,
            fontSize: 20,
            maxWidth: 200,
            anchor: { ...at, dy: labelDy },
            dx: labelDx,
          },
          {
            type: 'arrow' as const,
            fromAnchor: { ...at, dx: tailDx, dy: labelDy - 13 },
            anchor: { ...at, dy: headDy },
          },
        ]
      },
    ),
  },

  // The near-white neutral leaves the balanced majority looking like an
  // unloaded track, so a callout names it.
  {
    mode: 'url',
    name: 'tcga/cohort_cnv_erbb2',
    url: sessionSpec(KG_CONFIG, {
      sessionTracks: [TCGA_BRCA_CNV_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '17:37,500,000-42,000,000',
          highlight: ['17:39,688,094-39,728,658'],
          trackLabels: 'offset',
          tracks: [
            {
              trackId: 'MANE.GRCh38.v1.4.refseq',
              // Height sets how many MANE rows show; 44px is the one row ERBB2
              // is on.
              height: 44,
            },
            {
              trackId: 'tcga_brca_cnv',
              height: 700,
              runClustering: true,
              clusterRegion: '17:39,000,000-40,500,000',
              axis: { tree: true },
            },
          ],
        },
      ],
    }),
    readySelector: CLUSTERED,
    readyTimeout: 180000,
    viewportWidth: 1500,
    viewportHeight: 1024,
    diffThreshold: 0.02,
    // Clustering decides where the colored bands end (~0.36 of the display), so
    // fracY 0.44 lands in the pale band with the boundary above it. An arrow
    // into the pale band read as a broken annotation.
    annotations: [
      {
        type: 'text',
        text: 'balanced: the largest group, painted near-white',
        anchor: {
          trackId: 'tcga_brca_cnv',
          fracY: 0.44,
          alignX: 'left',
          dx: 430,
        },
      },
      {
        type: 'text',
        text: 'amplified',
        anchor: {
          trackId: 'tcga_brca_cnv',
          loc: '17:39,150,000',
          fracY: 0.06,
        },
      },
    ],
  },

  {
    mode: 'url',
    name: 'tcga/cohort_cnv_recurrence_subtype',
    url: sessionSpec(KG_CONFIG, {
      sessionTracks: [TCGA_BRCA_RECURRENCE_BY_SUBTYPE_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          displayedRegionNames: HG38_MAIN_CHROMS,
          trackLabels: 'offset',
          tracks: [
            {
              trackId: 'tcga_brca_cnv_recurrence_by_subtype',
              height: SUBTYPE_ROWS_HEIGHT,
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('mark-display'),
    readyTimeout: 180000,
    viewportWidth: 1900,
    viewportHeight: SUBTYPE_ROWS_HEIGHT + 210,
    annotations: [
      // right of the locus, over chr18-22 where the HER2+ row is flat
      ...subtypeCallout({
        text: 'ERBB2 (17q12)',
        locus: '17:39,688,094',
        row: 1,
        labelDy: 0.12,
        headDy: 0.35,
        labelDx: 60,
      }),
      ...subtypeCallout({
        text: '16q loss (CDH1 arm)',
        locus: '16:70,000,000',
        row: 0,
        labelDy: 0.85,
        headDy: 0.65,
        // over chr13-14, where this row is flat
        labelDx: -420,
      }),
    ],
  },

  // A Zarr-store figure drawn here showed the same stripes as cohort_cnv_genome;
  // one belongs here only where the two readers disagree.

  {
    mode: 'url',
    name: 'tcga/mutations_cdh1_histology',
    url: mutationFigure({
      // The actions collapse this transcript to its exons; uncollapsed, private
      // intronic MODIFIER columns spread the coding calls thin.
      loc: '16:68,730,000-68,842,000',
      section: HISTOLOGY_SECTION,
      // No ClinVar lane: over 16 exons it draws as a barcode of touching ticks
      // with no column to line up against the matrix.
    }),
    readySelector: MATRIX_DONE,
    readyTimeout: 180000,
    clicksChange: "collapse CDH1's introns",
    actions: collapseIntrons('CDH1'),
    // the "Introns collapsed / UNDO" toast
    hideSelectors: ['.MuiSnackbar-root'],
    viewportWidth: 1500,
    viewportHeight:
      MATRIX_ROWS_HEIGHT + LINE_ZONE_HEIGHT + MATRIX_CHROME_HEIGHT,
    // Only the lobular band gets a label: one in the empty ductal band names an
    // absence. The cohort's histology counts put the lobular band in roughly the
    // last seventh of the rows.
    annotations: [
      {
        type: 'text',
        text: 'lobular: most of the calls in this window',
        anchor: {
          trackId: 'tcga_brca_mutations',
          fracY: 0.45,
          alignX: 'left',
          dx: 400,
        },
      },
      {
        type: 'arrow',
        fromAnchor: {
          trackId: 'tcga_brca_mutations',
          fracY: 0.5,
          alignX: 'left',
          dx: 400,
        },
        anchor: {
          trackId: 'tcga_brca_mutations',
          fracY: 0.87,
          alignX: 'left',
          dx: 400,
        },
      },
    ],
  },

  // Two siblings of this figure failed. `runClustering: true` squashed the
  // matrix below the tree sidebar's height, and the dendrogram testid appears
  // before the matrix redraws. A `minorAlleleFrequency` floor of 0.01 left four
  // wide columns that read as variants the whole cohort carries.
  {
    mode: 'url' as const,
    name: 'tcga/mutations_pik3ca_grouped',
    url: mutationFigure({
      loc: '3:179,148,000-179,240,500',
      section: SUBTYPE_SECTION,
    }),
    readySelector: MATRIX_DONE,
    readyTimeout: 180000,
    clicksChange: "collapse PIK3CA's introns",
    actions: collapseIntrons('PIK3CA'),
    hideSelectors: ['.MuiSnackbar-root'],
    viewportWidth: 1500,
    viewportHeight:
      MATRIX_ROWS_HEIGHT + LINE_ZONE_HEIGHT + MATRIX_CHROME_HEIGHT,
  },

  // TP53 by subtype at half a pixel per row draws its density difference as a
  // wash; mutations_cdh1_histology carries the grouping.
]
