import { displayPainted, displaySettled } from '@jbrowse/browser-test-utils'

import { kgUrl } from '../screenshot-spec-helpers.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

// The 1000 Genomes config's hg38 assembly names its contigs bare (`1`, `X`), so
// the view's displayedRegionNames use that form. The BED's own `chr`-prefixed
// names resolve through the assembly's refNameAliases (hg38_aliases.txt maps
// 17 <-> chr17), which is why the track needs no renaming.
//
// chrY is omitted because the built BED contains no Y segments at all (checked
// against the file), so listing it would draw an empty column.
const HG38_MAIN_CHROMS = [
  ...Array.from({ length: 22 }, (_, i) => String(i + 1)),
  'X',
]

// One row per TCGA-BRCA primary tumor (1104 of them), painted from the caller's
// raw Segment_Mean on a diverging blue/red log2 scale. Built by
// scripts/build_tcga_cohort_cnv.sh from GDC open-access Masked Copy Number
// Segment files; see website/docs/tutorials/tcga_cohort_cnv.md.
const TCGA_BRCA_CNV_TRACK = {
  type: 'FeatureTrack',
  trackId: 'tcga_brca_cnv',
  name: 'TCGA-BRCA copy number (1104 primary tumors)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedTabixAdapter',
    bedGzLocation: {
      uri: 'https://jbrowse.org/demos/tcga/tcga_brca_cnv.bed.gz',
      locationType: 'UriLocation',
    },
    index: {
      indexType: 'TBI',
      location: {
        uri: 'https://jbrowse.org/demos/tcga/tcga_brca_cnv.bed.gz.tbi',
        locationType: 'UriLocation',
      },
    },
  },
  displays: [
    {
      type: 'LinearMultiRowFeatureDisplay',
      partitionField: 'sample',
      // 0 = auto-fit: the display height divided across the rows, floored at
      // 1px. At 1104 rows every tumor is a single pixel line, which is the point
      color:
        "jexl:get(feature,'segmean')<-1?'#2166ac':get(feature,'segmean')<-0.3?'#92c5de':get(feature,'segmean')<0.3?'#f7f7f7':get(feature,'segmean')<1?'#f4a582':'#b2182b'",
      rowHeight: 0,
      legend: [
        { label: 'Deep loss (log2 < -1)', color: '#2166ac' },
        { label: 'Loss', color: '#92c5de' },
        { label: 'Balanced', color: '#f7f7f7' },
        { label: 'Gain', color: '#f4a582' },
        { label: 'Amplification (log2 > 1)', color: '#b2182b' },
      ],
    },
  ],
}

// The same 1104 tumors collapsed to per-100kb frequencies by
// scripts/cnv_recurrence.py: two value columns, gain positive and loss negative.
// BedGraphTabixAdapter emits one feature per value column, and the wiggle's
// bicolor pivot at 0 splits them, so the single track draws gains up in red and
// losses down in blue. minScore/maxScore pin the axis to the whole cohort
// (+-100%) rather than autoscaling per view, so a bar's height means the same
// fraction in every figure.
const TCGA_BRCA_RECURRENCE_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'tcga_brca_cnv_recurrence',
  name: 'TCGA-BRCA recurrence (% of 1104 tumors)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedGraphTabixAdapter',
    bedGraphGzLocation: {
      uri: 'https://jbrowse.org/demos/tcga/tcga_brca_cnv_recurrence.bedGraph.gz',
      locationType: 'UriLocation',
    },
    index: {
      indexType: 'TBI',
      location: {
        uri: 'https://jbrowse.org/demos/tcga/tcga_brca_cnv_recurrence.bedGraph.gz.tbi',
        locationType: 'UriLocation',
      },
    },
  },
  displays: [
    {
      type: 'LinearWiggleDisplay',
      height: 160,
      posColor: '#b2182b',
      negColor: '#2166ac',
      minScore: -100,
      maxScore: 100,
    },
  ],
}

// Eight equal rows share this, so a row is SUBTYPE_ROWS_HEIGHT/8 px tall and
// SUBTYPE_ROW_PITCH is what the callouts below measure their dy against.
const SUBTYPE_ROWS_HEIGHT = 500
const SUBTYPE_ROW_PITCH = SUBTYPE_ROWS_HEIGHT / 8

// A label for one event in one of the eight subtype rows, with an arrow into the
// bars. `row` is the row index and `labelDy`/`headDy` are fractions of that
// row's own height, so every offset is stated in the layout's own units and a
// change to SUBTYPE_ROWS_HEIGHT moves the callouts with the rows. fracY stays 0
// (the track's top edge) rather than a fraction of the whole track, so a row
// index reads as a row index.
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
  const at = { track: 'tcga_brca_cnv_recurrence_by_subtype', locus, fracY: 0 }
  const y = (frac: number) => (row + frac) * SUBTYPE_ROW_PITCH
  // The arrow FIRST, so the label's pill (opaque white) draws over its tail. A
  // tail has to start inside the label to leave from it -- the pill's width is
  // only known at capture time, so it can't be dodged by a dx -- and drawn
  // second the shaft ran across the text instead.
  //
  // The tail leaves from the side of the label the head is on: a label to the
  // right of its locus (labelDx > 0) is left by its left edge.
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

// The same tally as TCGA_BRCA_RECURRENCE_TRACK, run once per receptor subtype:
// cnv_recurrence.py --groups gives each group its own gain and loss column,
// BedGraphTabixAdapter reads every column past `end` as its own signal, and
// MultiQuantitativeTrack's default multirowxy draws one row per signal. So the
// eight rows come out of one 246KB file with no subadapter list.
//
// The columns are direction-major (four gains, then four losses), which is what
// puts the rows a reader compares next to each other.
//
// Pinned rather than autoscaled, for the reason the pooled track is: autoscale
// would give each row its own axis and make the subtypes look alike, which is
// the one thing this figure exists to disprove.
//
// +-70 rather than the pooled track's +-100. Each row here carries one signed
// direction, so it only ever fills the half of its axis on that side, and at
// +-100 the tallest bar in the file (66.85%) reached under a third of its row.
// 70 is the nearest round number above that maximum, so nothing clips and the
// bars roughly double. All eight rows still share it, which is what keeps them
// comparable.
const TCGA_BRCA_RECURRENCE_BY_SUBTYPE_TRACK = {
  type: 'MultiQuantitativeTrack',
  trackId: 'tcga_brca_cnv_recurrence_by_subtype',
  name: 'TCGA-BRCA recurrence by receptor subtype',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedGraphTabixAdapter',
    bedGraphGzLocation: {
      uri: 'https://jbrowse.org/demos/tcga/tcga_brca_cnv_recurrence_by_subtype.bedGraph.gz',
      locationType: 'UriLocation',
    },
    index: {
      indexType: 'TBI',
      location: {
        uri: 'https://jbrowse.org/demos/tcga/tcga_brca_cnv_recurrence_by_subtype.bedGraph.gz.tbi',
        locationType: 'UriLocation',
      },
    },
  },
  displays: [
    {
      type: 'MultiLinearWiggleDisplay',
      height: SUBTYPE_ROWS_HEIGHT,
      posColor: '#b2182b',
      negColor: '#2166ac',
      minScore: -70,
      maxScore: 70,
      // eight rows of one signed direction each, so the boundary between a
      // group's row and the next one is not otherwise drawn
      showRowSeparators: true,
    },
  ],
}

// The tree sidebar only mounts once clustering has produced a hierarchy
// (TreeSidebar returns null on `!hierarchy`), so waiting on its canvas gates the
// capture on real completion rather than on a duration guess.
const CLUSTERED = '[data-testid="tree_sidebar_dendrogram"]'

// What the clustering tour films, out of the same track config the figures use so
// the route cannot document an app the page is not showing.
//
// The ERBB2 window rather than the whole genome, which is where the tutorial's
// own instruction points: at whole-genome zoom the stack is the heaviest spec in
// this file and software-rasterizing 1104 rows across 23 blocks per animated
// frame is the one thing the tours are told to stay off.
//
// `runClustering` is deliberately ABSENT. The figures arrive clustered; a tour of
// the menu item that clusters them has to start in the state a reader is in, so
// this session is the same window unsorted, which is a state no figure on the
// page carries.
export const tcgaVideoFixtures = {
  trackId: 'tcga_brca_cnv',
  // The chrome div, not `multirow_canvas`. The inner canvas carries a static
  // selector for a pixel lookup and no readiness attributes at all
  // (DisplayChromeBase spells this out), so pairing it with `data-display-drawn`
  // builds a selector that can never match — which is how this tour's first film
  // spent 300s waiting on a stack that had already painted.
  painted: displaySettled('multirow-display'),
  unclusteredErbb2: kgUrl({
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
            type: 'LinearMultiRowFeatureDisplay',
            // the ERBB2 figure's own height. Left at the default the 1104 rows
            // auto-fit into ~100px and the sort has nowhere to be visible.
            height: 700,
          },
        ],
      },
    ],
  }),
}

// The four recurrent stripes to name in the genome-wide figure. Each callout
// anchors to the gene's own coordinates in the live view — the app resolves
// them through the same bp->px layout it painted the stripe with — so nothing
// here has to be re-measured when the viewport width, the track heights, or the
// wiggle track above the stack change.
//
// Each locus was checked against the rendered pixels first: the labeled column
// carries 3.5-7x its neighborhood's fraction of saturated rows. BRCA1 is
// deliberately absent — it drives breast cancer through germline point
// mutations, not a recurrent copy-number event, and at this scale it lands 2px
// from ERBB2 anyway. PTEN (10q23) is the fifth classic locus but reaches only
// ~1.4x here, too faint to point at honestly.
//
// `labelDy`/`headDy` are px BELOW THE TOP OF THE STACK (anchored with
// `fracY: 0`), not a fraction of it: 1104 rows make this track ~1105px tall
// against a 1120px viewport, so it runs off the bottom edge and a fraction of
// its height would put a callout below the capture. Labels sit low where the
// stack is palest, with an arrow up into the stripe. `labelDx` is a
// readability nudge only — MYC's is large because CDKN2A's stripe is ~20px away
// at this scale and the two pills would otherwise collide, which is also why
// CDKN2A's label drops to its own row.
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

// The same cohort's somatic point mutations, as a genotype matrix: one column
// per distinct mutation, one row per tumor. Built by
// scripts/build_tcga_cohort_mutations.sh from GDC open-access Masked Somatic
// Mutation MAFs; see website/docs/tutorials/tcga_cohort_mutations.md.
//
// `samplesTsvLocation` is the same clinical table for every figure, and each
// figure picks which of its columns to group and color rows by, so the grouped
// figures differ from the plain one by two config slots.
//
// A session track, so the display slots have to live in the track's own
// `displays` array: slots put on the view's `tracks` entry are dropped for a
// track the config doesn't already carry.
function mutationTrack({
  groupBy = '',
  colorBy = '',
  height = 1010,
  lineZoneHeight = 20,
}: {
  groupBy?: string
  colorBy?: string
  height?: number
  lineZoneHeight?: number
} = {}) {
  return {
    type: 'VariantTrack',
    trackId: 'tcga_brca_mutations',
    name: 'TCGA-BRCA somatic mutations (979 primary tumors)',
    assemblyNames: ['hg38'],
    adapter: {
      type: 'VcfTabixAdapter',
      vcfGzLocation: {
        uri: 'https://jbrowse.org/demos/tcga/tcga_brca_mutations.vcf.gz',
        locationType: 'UriLocation',
      },
      index: {
        indexType: 'TBI',
        location: {
          uri: 'https://jbrowse.org/demos/tcga/tcga_brca_mutations.vcf.gz.tbi',
          locationType: 'UriLocation',
        },
      },
      samplesTsvLocation: {
        uri: 'https://jbrowse.org/demos/tcga/tcga_brca_clinical.tsv',
        locationType: 'UriLocation',
      },
    },
    displays: [
      {
        type: 'LinearMultiSampleVariantMatrixDisplay',
        // The matrix display, not the regular one: a cohort's somatic mutations
        // are sparse and spread over a whole gene, so laying columns out at
        // their genomic positions puts most of the figure in empty space. By
        // feature index they pack, and the lineZone above still ties each
        // column back to the position it came from.
        //
        // 1010px so the 979 rows clear 1px each. Auto-fit here allows sub-pixel
        // rows (unlike the multi-row feature display, whose effectiveRowHeight
        // floors at 1px and grows the track), and a somatic matrix is one alt
        // cell per carrier rather than a painted row, so a shorter display would
        // thin exactly the single-carrier columns these figures are about.
        height,
        // The band the connector lines are drawn in, above the rows. `height`
        // includes it, so a figure raising this raises `height` by the same
        // amount to leave the rows what they had.
        lineZoneHeight,
        // Every alt-carrying cell takes its mutation's VEP impact tier, from the
        // CSQ the MAF's own Consequence/IMPACT columns are re-encoded into. On
        // somatic data this separates truncating (HIGH) from missense
        // (MODERATE) without a per-figure color table.
        featureColor: 'jexl:impactColor(feature)',
        groupBy,
        colorBy,
      },
    ],
  }
}

// The matrix canvas only mounts once the cell-data RPC has landed, so this gates
// each capture on real completion rather than on a duration guess.
const MATRIX_DONE = displayPainted('variant-matrix-display')

// Display height for the 979-row cohort matrices, i.e. about a third of a pixel
// per tumor. Rows auto-fit by dividing the height and are allowed below a pixel
// (effectiveRowHeight only floors at 1 when the line zone has swallowed the
// display), and drawVariantMatrixBlocks deliberately draws sub-pixel cells at
// float coordinates with a 0.3px overdraw rather than snapping them to a pixel.
// So a mutated tumor in a crowded band is an antialiased smear that accumulates
// with its neighbours, and the density difference between two clinical bands
// reads as one band being darker than the other -- which is the comparison
// these figures exist to make. Giving each tumor its own visible row instead
// (1900px, reviewed and rejected) spreads the same marks over a frame six times
// taller, where the contrast is a property of two screens of grey.
const MATRIX_ROWS_HEIGHT = 320

// The connector band between the gene lane and the rows, where each column's
// line lands on the base it came from. Tall enough to be read as a fan rather
// than a fringe, which is what says whether a gene's calls pile on one codon
// (PIK3CA) or run the length of the transcript (CDH1, TP53) -- the matrix packs
// columns by feature index and on its own says nothing about position.
//
// It also decides where the floating legend sits. The legend pins to the top
// right of the DISPLAY, so with a thin band it covers the top rows of the
// right-most columns, which on PIK3CA is the H1047R hotspot in the band the
// figure is about. A band this tall puts it over the connector zone instead.
const LINE_ZONE_HEIGHT = 130

// The gene track and the view's own chrome (header, ruler, track label), on top
// of the display height.
const MATRIX_CHROME_HEIGHT = 330

// Collapse the gene's introns by driving the app's own action: right-click the
// gene in the MANE lane, "Collapse introns", then replace the current view. The
// exon intervals come out of the live feature, so nothing here is a coordinate
// list that could drift from the transcript the lane is drawing.
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
  // the reshaped view refetches every track: the matrix's own done-testid is
  // the only thing that says the 979 rows are back
  {
    type: 'waitForSelector' as const,
    selector: '[data-testid="loading-overlay"]',
    hidden: true,
  },
  { type: 'waitForSelector' as const, selector: MATRIX_DONE, timeout: 180000 },
]

// MANE gives one transcript per gene, so the lane names the gene in a single row
// instead of an isoform stack. 84px is two rows' worth: content starts ~4px in
// and the row pitch is 40px.
const MANE_TRACK = {
  trackId: 'MANE.GRCh38.v1.4.refseq',
  type: 'LinearBasicDisplay',
  height: 84,
}

// ClinVar's own submissions over the same window, as a one-row lane under the
// gene: the germline record of a gene the cohort is mutating somatically. The
// track ships with a CLNSIG color jexl in the config, so pathogenic calls are red
// and benign ones blue without a per-figure color table.
const CLINVAR_TRACK = {
  trackId: 'clinvar_ncbi_hg38',
  type: 'LinearVariantDisplay',
  // one row of ticks, not a stack: this lane is here to be compared with the
  // matrix's columns, not read variant by variant
  displayMode: 'collapsed',
  height: 40,
}

// The per-gene mutation-rate track that used to be drawn over the TP53 matrix
// was DELETED here (reviewer, after two rebuilds: "please just delete this
// figure or do something better. it is just total nonsense as is"). Worth one
// note so it is not re-proposed: the file is one interval per GENE, so over a
// single gene every subtype is one flat level and the track's x axis carries
// nothing at all. Four stacked panels made that four rulers, an overlay made it
// a wireframe, and filled colored rows made it four rectangles -- each version
// was a bar chart of four numbers wearing a genome browser. The tutorial still
// builds the track and shows the bedGraph the numbers come from; what it no
// longer does is photograph it. Anything that DOES belong in a picture here
// would need a window where the track varies, i.e. many genes, not one.

function mutationFigure({
  loc,
  groupBy = '',
  colorBy = '',
  height = 1010,
  lineZoneHeight = 20,
  clinvar = false,
}: {
  loc: string
  groupBy?: string
  colorBy?: string
  height?: number
  lineZoneHeight?: number
  clinvar?: boolean
}) {
  return kgUrl({
    sessionTracks: [
      mutationTrack({ groupBy, colorBy, height, lineZoneHeight }),
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
            type: 'LinearMultiSampleVariantMatrixDisplay',
          },
        ],
      },
    ],
  })
}

// What the collapse-introns tour films: the CDH1 figure's own session, opened on
// the whole transcript, which is the state the figure's `actions` then reshape.
// So the clip ends on the picture the page prints and the reader has seen how it
// was made.
//
// The route is `collapseIntrons` above, restated with captions and holds rather
// than reused: a tour needs a `say` per click and a hold long enough to read a
// menu, and the still's version is deliberately as fast as the app allows.
export const tcgaMutationVideoFixtures = {
  gene: 'CDH1',
  matrixDone: MATRIX_DONE,
  cdh1WholeTranscript: mutationFigure({
    loc: '16:68,730,000-68,842,000',
    groupBy: 'histology',
    colorBy: 'histology',
    lineZoneHeight: LINE_ZONE_HEIGHT,
    height: MATRIX_ROWS_HEIGHT + LINE_ZONE_HEIGHT,
  }),
}

export const tcgaSpecs: ScreenshotSpec[] = [
  // The cohort view: every TCGA-BRCA primary tumor as one 1px row across the
  // whole genome, clustered so tumors with similar profiles sit together, under
  // the cohort's own gain/loss frequency. Recurrent events read as vertical
  // stripes down the stack — blue at 9p21 (CDKN2A) and 10q23 (PTEN), red at
  // 17q12 (ERBB2), 8q24 (MYC) and 11q13 (CCND1) — and every peak in the top
  // track is one of those stripes, with a number on it that the stack alone
  // can't give. This is the figure the tutorial is built around; it replaces a
  // separate unclustered recurrence figure that showed the same two tracks.
  {
    mode: 'url',
    name: 'tcga/cohort_cnv_genome',
    url: kgUrl({
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
              type: 'LinearWiggleDisplay',
              // same height the tutorial's own displayDefaults use
              height: 120,
            },
            {
              trackId: 'tcga_brca_cnv',
              type: 'LinearMultiRowFeatureDisplay',
              height: 760,
              // one-shot declarative trigger, cleared once the RPC lands
              runClustering: true,
              showTree: true,
            },
          ],
        },
      ],
    }),
    readySelector: CLUSTERED,
    // networkidle0 can't land inside puppeteer's fixed 60s navigation timeout
    // while the 5.7MB BED streams
    waitUntil: 'domcontentloaded',
    // by far the heaviest spec here: the whole-genome view pulls essentially the
    // entire 5.7MB BED before it can build the 1104-row matrix and cluster it.
    // Needs minutes under the default swiftshader rasterizer — not from fetching
    // or clustering (2.1s and 0.4s measured) but from ~10 multi-second software
    // GPU passes over the 1104-row canvas. Regenerate with --headed and it is
    // ready in ~14s; the budget stays large so a headless run can still finish.
    // See agent-docs/reference/SCREENSHOT_PERF.md.
    readyTimeout: 900000,
    viewportWidth: 1900,
    // tall enough for the whole 760px stack below the 120px frequency track:
    // the review's "the heatmap is sliced at the bottom edge" was this figure's
    // 900px viewport cutting the last ~60 rows
    viewportHeight: 1120,
    settleMs: 20000,
    // 1104 rows floored to 1px: sub-pixel row-boundary jitter between runs, so
    // the gate sits above the default
    diffThreshold: 0.02,
    // A label beside each recurrent stripe, with an arrow up into it. Both ends
    // of both shapes anchor to the gene's locus in the cohort track, so the
    // whole callout is derived from the view rather than measured off a
    // previous capture (see RECURRENT_LOCI).
    annotations: RECURRENT_LOCI.flatMap(
      ({ gene, locus, labelDx, tailDx, labelDy = 532, headDy = 422 }) => {
        // fracY 0 puts the anchor on the stack's top edge; dy then walks down
        // from there, so every offset is measured against the track itself
        const at = { track: COHORT_TRACK_ID, locus, fracY: 0 }
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
            // tail leaves from just above the label's pill
            fromAnchor: { ...at, dx: tailDx, dy: labelDy - 13 },
            anchor: { ...at, dy: headDy },
          },
        ]
      },
    ),
  },

  // chr17:39.0-40.5Mb, spanning ERBB2 (39.69-39.73Mb), the HER2 of HER2-positive
  // breast cancer. Clustering runs on the visible window only, so the cohort
  // sorts into its copy-number classes at this locus rather than genome-wide.
  //
  // Note the banding is qualitative, not proportional: 1104 rows in a few
  // hundred px puts each tumor well under 1px, so rows alias and the saturated
  // colors crowd out the neutral ones. Measured off the BED the window is 70%
  // balanced, but it paints as ~52%. The tutorial states the real numbers.
  //
  // Neutral stays near-white (#f7f7f7) on purpose. A darker neutral makes this
  // figure's balanced band more obviously "data", but washes out the
  // genome-wide figure above, where the recurrent stripes are the whole point,
  // and near-white neutral is the convention for CNV heatmaps. So the pale band
  // gets a callout instead of a color: on a white page the bottom of this frame
  // reads as track that failed to load, and "those rows are the balanced
  // majority" is the one thing about this figure a reader cannot see. Review
  // note on the previous render asked for exactly that, plus a shorter gene
  // lane.
  {
    mode: 'url',
    name: 'tcga/cohort_cnv_erbb2',
    url: kgUrl({
      sessionTracks: [TCGA_BRCA_CNV_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '17:39,000,000-40,500,000',
          // band over ERBB2 itself (ncbiRefSeq chr17:39,688,094-39,728,658), so
          // the amplified column is tied to the gene rather than left for the
          // reader to locate against the ruler
          highlight: ['17:39,688,094-39,728,658'],
          trackLabels: 'offset',
          tracks: [
            {
              // MANE gives exactly one transcript per gene, so the lane names
              // ERBB2 and its neighbors in a single row instead of an isoform
              // stack that would eat the figure
              trackId: 'MANE.GRCh38.v1.4.refseq',
              type: 'LinearBasicDisplay',
              // This window has far more MANE rows than the figure needs, and
              // height only controls how many are VISIBLE — growing it just
              // reveals more rows and re-shears the last one's labels. One row
              // is enough here: the figure's subject is the stack, ERBB2 is
              // already marked by the `highlight` band rather than by having to
              // be found among its neighbors' labels, and the row this leaves is
              // the one ERBB2 is on. Content starts ~4px in, row pitch 40px.
              height: 44,
            },
            {
              trackId: 'tcga_brca_cnv',
              type: 'LinearMultiRowFeatureDisplay',
              height: 700,
              runClustering: true,
              showTree: true,
            },
          ],
        },
      ],
    }),
    readySelector: CLUSTERED,
    readyTimeout: 180000,
    viewportWidth: 1500,
    viewportHeight: 1024,
    settleMs: 15000,
    diffThreshold: 0.02,
    // Two labels, both about what the coloring cannot say on a white page.
    //
    // fracY of the display rather than a measured pixel: clustering decides
    // where the band boundaries land, so a coordinate would be wrong the next
    // time the cohort or the window changes, while "just below the last colored
    // rows" survives it. The colored bands end around 0.36 of the display, so
    // 0.44 sits in the pale region with the boundary still in view above the
    // pill -- which is the whole point, since that boundary is where a reader
    // decides the track stopped loading.
    //
    // No arrow. One was built pointing down into the pale band and it read as a
    // broken annotation: it leaves a label and lands on nothing visible, which
    // is exactly the thing the label exists to explain. The label sitting
    // inside the region names it without having to point.
    //
    // No number in either label (see website/CLAUDE.md): the balanced share is
    // in the tutorial's prose, where a reader can check it against the file.
    annotations: [
      {
        type: 'text',
        text: 'balanced: the largest group, painted near-white',
        anchor: {
          track: 'tcga_brca_cnv',
          fracY: 0.44,
          alignX: 'left',
          dx: 430,
        },
      },
      {
        type: 'text',
        text: 'amplified',
        anchor: {
          track: 'tcga_brca_cnv',
          fracY: 0.17,
          alignX: 'left',
          dx: 180,
        },
      },
    ],
  },

  // The pooled frequency profile split four ways by receptor subtype, genome
  // wide. The same cutoffs and the same axis as the pooled track, so what
  // changes between the rows is the cohort and nothing else.
  //
  // Whole genome rather than a locus because the differences are not at one
  // place: 17q gain is the HER2+ row, 16q loss the HR+/HER2- row, 5q loss and
  // 10p gain the triple-negative row, and 1q gain is the event they share. A
  // zoom would carry one of those and imply the rest are alike.
  //
  // Two callouts, one per subtype-specific event, each sitting in the half of
  // its own row that the bars leave empty: a gain row fills upward from its
  // baseline, so its label goes near the row's top edge, and a loss row hangs
  // downward, so its label goes near the bottom. Both anchor to the locus in the
  // live view (`{track, locus}` resolves through the same bp->px layout that
  // painted the bar), with dy measured off the track's top edge in whole row
  // pitches, so neither has a hand-measured coordinate in it.
  {
    mode: 'url',
    name: 'tcga/cohort_cnv_recurrence_subtype',
    url: kgUrl({
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
              type: 'MultiLinearWiggleDisplay',
              height: SUBTYPE_ROWS_HEIGHT,
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('multi-wiggle-display'),
    // 246KB across the whole genome, so unlike the 5.7MB stack this needs no
    // raised navigation or ready budget
    readyTimeout: 180000,
    viewportWidth: 1900,
    // the display plus the view's own chrome (ruler, header, track label)
    viewportHeight: SUBTYPE_ROWS_HEIGHT + 210,
    settleMs: 10000,
    annotations: [
      // row 1, HER2+ gain: the amplicon that names the subtype. To the RIGHT of
      // its locus, over chr18-22 where this row is flat; chr17 sits far enough
      // from the frame's right edge for the pill to fit beside it.
      ...subtypeCallout({
        text: 'ERBB2 (17q12)',
        locus: '17:39,688,094',
        row: 1,
        labelDy: 0.25,
        headDy: 0.7,
        labelDx: 60,
      }),
      // row 4, HR+/HER2- loss: the arm-scale loss that is this subtype's
      // signature the way 17q gain is HER2+'s. The label names a gene on the arm
      // rather than the arm alone -- CDH1 is at 16q22.1, and it is the gene the
      // mutation figures on this cohort are about -- since "16q loss" on its own
      // says where the bar is and not why it is worth a callout. ERBB2 is on 17q,
      // not here.
      ...subtypeCallout({
        text: '16q loss (CDH1 arm)',
        locus: '16:70,000,000',
        row: 4,
        labelDy: 0.6,
        headDy: 0.3,
        // far enough left to sit over chr13-14, where this row is flat
        labelDx: -420,
      }),
    ],
  },

  // tcga/cohort_cnv_zarr_genome WAS HERE and is gone, with the tutorial section
  // it illustrated ("Read the same calls as a binned matrix"). It drew the same
  // composition as cohort_cnv_genome above from the Zarr store instead of the
  // BED, and its own caption said so: the recurrent stripes fall in the same
  // places. So the picture carried no result of its own, and the prose around it
  // was a bytes-over-the-wire table for two readers of one dataset. The store,
  // its build script and test_data/tcga_cnv/config.json all still exist; what
  // this file no longer does is photograph a second reader of the same calls.
  // A figure here would need a view where the two readers DISAGREE.

  // CDH1 grouped by histology. E-cadherin loss is the defining lesion of lobular
  // breast cancer, and this is that result as a picture: the HIGH-impact
  // (truncating) cells crowd into the lobular band and the much larger ductal
  // band above it is nearly empty.
  //
  // Grouped AND colored by the same column: `groupBy` makes each histology's
  // rows contiguous, `colorBy` puts the color strip in the gutter that says
  // which band is which. Without the strip the bands are unlabeled row ranges.
  //
  // The connector fan is half the result here. CDH1 is a tumor suppressor and its
  // truncating calls are spread along the transcript rather than piled on a
  // codon, which is the contrast with PIK3CA's three hotspot bars: most of this
  // window's columns are HIGH impact and their lines land right across the exons
  // of the lane above.
  {
    mode: 'url',
    name: 'tcga/mutations_cdh1_histology',
    url: mutationFigure({
      // the whole transcript, which the actions below then collapse to its
      // exons. Two reasons for collapsing beyond the empty space: CDH1's first
      // intron alone is 63 kb, and a window with introns in it fills the matrix
      // with intronic MODIFIER columns -- one grey column per private intronic
      // call -- which is what spread the coding mutations thin. Collapsed, every
      // column in the frame is an exonic change and the connector fan lands in
      // one bundle per exon.
      loc: '16:68,730,000-68,842,000',
      groupBy: 'histology',
      colorBy: 'histology',
      lineZoneHeight: LINE_ZONE_HEIGHT,
      height: MATRIX_ROWS_HEIGHT + LINE_ZONE_HEIGHT,
      // NO ClinVar lane. It was here as "the germline record of a gene the
      // cohort is mutating somatically", but collapsed to one row over a
      // 16-exon window it draws as a 1500px barcode of touching CLNSIG ticks:
      // it has no column a matrix column can be lined up against, and it was
      // the busiest thing in a figure whose subject is a density difference
      // between two bands.
    }),
    readySelector: MATRIX_DONE,
    readyTimeout: 180000,
    actions: collapseIntrons('CDH1'),
    // collapsing introns raises an "Introns collapsed / UNDO" toast, which is
    // real UI for a real click and has no business in the published frame
    hideSelectors: ['.MuiSnackbar-root'],
    viewportWidth: 1500,
    viewportHeight:
      MATRIX_ROWS_HEIGHT + LINE_ZONE_HEIGHT + MATRIX_CHROME_HEIGHT,
    settleMs: 10000,
    // The bands are row ranges with a color strip in the gutter, and the legend
    // is the only thing that says which range is which -- so the figure's whole
    // result (this band, not that one) has to be read off a key in the far
    // corner. This names the band the result is in.
    //
    // Only the lobular one. A matching 'ductal' pill sat in the band above and
    // was denied (reviewer: "remove the 'ductal' text"): the ductal band is the
    // empty majority of the rows, so a label in it names the absence of the
    // thing the figure is about, and two pills in a frame whose subject is one
    // of them read as a comparison between equals.
    //
    // fracY of the display, not a measured pixel: the matrix is 130px of
    // connector zone over 320px of rows, and the group boundary sits where the
    // cohort's histology counts put it, so a fraction survives a re-render that
    // a coordinate would not. Measured off the render, the lobular band is
    // roughly the last seventh of the rows.
    annotations: [
      {
        type: 'text',
        text: 'lobular: most of the calls in this window',
        anchor: {
          track: 'tcga_brca_mutations',
          fracY: 0.45,
          alignX: 'left',
          dx: 400,
        },
      },
      {
        type: 'arrow',
        fromAnchor: {
          track: 'tcga_brca_mutations',
          fracY: 0.5,
          alignX: 'left',
          dx: 400,
        },
        anchor: {
          track: 'tcga_brca_mutations',
          fracY: 0.87,
          alignX: 'left',
          dx: 400,
        },
      },
    ],
  },

  // TP53 grouped by receptor subtype: the same mechanic as the CDH1 figure
  // pointed at a different clinical column, and the page's second grouping
  // claim, which it otherwise only asserts.
  //
  // TP53 rather than PIK3CA, which the same sentence names. PIK3CA's contrast
  // is carried by two hotspot codons, so at 979 sub-pixel rows it is a handful
  // of columns in a frame of empty grey (built and rejected). TP53 is mutated
  // in most triple-negative tumors and a minority of HR+/HER2- ones, so its
  // contrast is a density difference across the whole gene, which is what a
  // matrix of sub-pixel rows is able to draw: the triple-negative band reads as
  // the dark one.
  //
  // Introns collapsed for the same reason as CDH1: with introns in frame every
  // private intronic call takes a column of its own and spreads the coding ones
  // thin.
  {
    mode: 'url',
    name: 'tcga/mutations_tp53_subtype',
    url: mutationFigure({
      loc: '17:7,668,000-7,688,000',
      groupBy: 'subtype',
      colorBy: 'subtype',
      lineZoneHeight: LINE_ZONE_HEIGHT,
      height: MATRIX_ROWS_HEIGHT + LINE_ZONE_HEIGHT,
    }),
    readySelector: MATRIX_DONE,
    readyTimeout: 180000,
    actions: collapseIntrons('TP53'),
    hideSelectors: ['.MuiSnackbar-root'],
    viewportWidth: 1500,
    viewportHeight:
      MATRIX_ROWS_HEIGHT + LINE_ZONE_HEIGHT + MATRIX_CHROME_HEIGHT,
    settleMs: 10000,
  },
]
