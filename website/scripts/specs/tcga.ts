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
]
