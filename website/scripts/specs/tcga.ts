import { kgUrl } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

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

// The tree sidebar only mounts once clustering has produced a hierarchy
// (TreeSidebar returns null on `!hierarchy`), so waiting on its canvas gates the
// capture on real completion rather than on a duration guess.
const CLUSTERED = '[data-testid="tree_sidebar_dendrogram"]'

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
const MATRIX_DONE = '[data-testid="variant-matrix-display-done"]'

// MANE gives one transcript per gene, so the lane names the gene in a single row
// instead of an isoform stack. 84px is two rows' worth: content starts ~4px in
// and the row pitch is 40px.
const MANE_TRACK = {
  trackId: 'MANE.GRCh38.v1.4.refseq',
  type: 'LinearBasicDisplay',
  height: 84,
}

function mutationFigure({
  loc,
  groupBy = '',
  colorBy = '',
  cluster = false,
  height = 1010,
  lineZoneHeight = 20,
}: {
  loc: string
  groupBy?: string
  colorBy?: string
  cluster?: boolean
  height?: number
  lineZoneHeight?: number
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
          {
            trackId: 'tcga_brca_mutations',
            type: 'LinearMultiSampleVariantMatrixDisplay',
            ...(cluster ? { runClustering: true } : {}),
          },
        ],
      },
    ],
  })
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
  // and near-white neutral is the convention for CNV heatmaps. The caption
  // names the pale band instead.
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
              // reveals more rows and re-shears the last one's labels. So pin it
              // to exactly two rows: content starts ~4px in and the row pitch is
              // 40px, which is enough to name ERBB2 and its neighbors.
              height: 84,
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
    viewportHeight: 900,
    settleMs: 15000,
    diffThreshold: 0.02,
  },

  // PIK3CA, the cohort's most-mutated gene. The window is the whole MANE
  // transcript, and every distinct mutation in it is one column: the three
  // canonical hotspot codons (H1047R in the kinase domain, E542K/E545K in the
  // helical one) are the columns carried by a large fraction of the cohort,
  // against columns one tumor wide for everything else.
  //
  // No callouts naming those codons. The matrix lays columns out by feature
  // index rather than at genomic x, so an `anchor: {track, locus}` would resolve
  // through the bp->px layout and land next to whichever column happens to sit
  // at that coordinate, which is not the one it names. The caption names them
  // instead, and hovering a column in the live view labels it.
  {
    mode: 'url',
    name: 'tcga/mutations_pik3ca',
    url: mutationFigure({ loc: '3:179,148,000-179,240,500', cluster: true }),
    // clustering, not the plain matrix. Unclustered, a carrier is one 1px row
    // wherever its tumor happens to sort, so even a hotspot carried by a large
    // share of the cohort draws as a dashed streak. Clustering by genotype makes
    // the carriers contiguous and the same column becomes a solid bar, with the
    // tumors carrying nothing here as one clean block below. Measured on the two
    // renders, not assumed.
    //
    // The tree sidebar only mounts once the clustering RPC has landed, so this
    // waits on the dendrogram rather than on the matrix canvas.
    readySelector: CLUSTERED,
    readyTimeout: 300000,
    viewportWidth: 1500,
    // the 1010px display plus the gene track and the view's own chrome, with
    // room for the last group band: the generator reported 91px clipped at 1240
    viewportHeight: 1340,
    settleMs: 15000,
  },

  // CDH1 grouped by histology. E-cadherin loss is the defining lesion of lobular
  // breast cancer, and this is that result as a picture: the HIGH-impact
  // (truncating) cells crowd into the lobular band and the much larger ductal
  // band above it is nearly empty.
  //
  // Grouped AND colored by the same column: `groupBy` makes each histology's
  // rows contiguous, `colorBy` puts the color strip in the gutter that says
  // which band is which. Without the strip the bands are unlabeled row ranges.
  //
  // A tall connector band, unlike the other two figures. The matrix packs
  // columns by feature index, so on its own it says nothing about where in the
  // gene a mutation is; here that is half the result. CDH1 is a tumor
  // suppressor and its truncating calls are spread along the transcript rather
  // than piled on a codon, which is the contrast with the PIK3CA figure's three
  // hotspot bars, and the connector fan is what makes it visible: 90 of the
  // window's 114 columns are HIGH impact and their lines land right across the
  // exons of the lane above. `height` goes up by the same amount so the rows
  // keep the 990px they had.
  {
    mode: 'url',
    name: 'tcga/mutations_cdh1_histology',
    url: mutationFigure({
      loc: '16:68,730,000-68,840,000',
      groupBy: 'histology',
      colorBy: 'histology',
      lineZoneHeight: 130,
      height: 1120,
    }),
    readySelector: MATRIX_DONE,
    readyTimeout: 180000,
    viewportWidth: 1500,
    viewportHeight: 1450,
    settleMs: 10000,
  },

  // TP53 grouped by receptor subtype, the same mechanic on the other clinical
  // column: the triple-negative band is mutated at several times the rate of
  // the HR+/HER2- band, which is the cohort's largest.
  //
  // The coding exons rather than the whole 20kb transcript. Over the transcript
  // the window carries 210 columns, most of them one intronic MODIFIER call, and
  // spreading the real mutations across those columns is what made the density
  // difference between the bands hard to read.
  {
    mode: 'url',
    name: 'tcga/mutations_tp53_subtype',
    url: mutationFigure({
      loc: '17:7,673,000-7,677,000',
      groupBy: 'subtype',
      colorBy: 'subtype',
    }),
    readySelector: MATRIX_DONE,
    readyTimeout: 180000,
    viewportWidth: 1500,
    viewportHeight: 1340,
    settleMs: 10000,
  },
]
