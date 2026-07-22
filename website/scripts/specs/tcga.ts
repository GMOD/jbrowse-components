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

// hg38 lengths for HG38_MAIN_CHROMS, used only to place the genome-wide figure's
// callouts (below). Same order as HG38_MAIN_CHROMS.
const HG38_CHROM_LENGTHS: Record<string, number> = {
  '1': 248956422,
  '2': 242193529,
  '3': 198295559,
  '4': 190214555,
  '5': 181538259,
  '6': 170805979,
  '7': 159345973,
  '8': 145138636,
  '9': 138394717,
  '10': 133797422,
  '11': 135086622,
  '12': 133275309,
  '13': 114364328,
  '14': 107043718,
  '15': 101991189,
  '16': 90338345,
  '17': 83257441,
  '18': 80373285,
  '19': 58617616,
  '20': 64444167,
  '21': 46709983,
  '22': 50818468,
  X: 156040895,
}

// Viewport x of a genomic position in the whole-genome view. Annotations are
// placed in viewport pixels, and hand-tuning those is what silently goes stale —
// so derive them instead. A whole-genome LGV lays its regions out edge to edge
// with no inter-region padding, so position maps linearly onto one strip:
// WG_DATA_LEFT/WG_DATA_WIDTH were read off the rendered figure's own region
// boundaries (a least-squares fit over all 23 of them, max residual 0.6 capture
// px = 0.3 CSS px), which is why an arbitrary locus lands on its stripe rather
// than near it. They are tied to `viewportWidth: 1900` below — change that and
// these must be re-measured.
const WG_DATA_LEFT = 100
const WG_DATA_WIDTH = 1699.3
const WG_TOTAL_BP = Object.values(HG38_CHROM_LENGTHS).reduce((a, b) => a + b, 0)

function wgX(refName: string, pos: number) {
  const before = HG38_MAIN_CHROMS.slice(
    0,
    HG38_MAIN_CHROMS.indexOf(refName),
  ).reduce((a, c) => a + HG38_CHROM_LENGTHS[c]!, 0)
  return WG_DATA_LEFT + ((before + pos) / WG_TOTAL_BP) * WG_DATA_WIDTH
}

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

// The tree sidebar only mounts once clustering has produced a hierarchy
// (TreeSidebar returns null on `!hierarchy`), so waiting on its canvas gates the
// capture on real completion rather than on a duration guess.
const CLUSTERED = '[data-testid="tree_sidebar_dendrogram"]'

export const tcgaSpecs: ScreenshotSpec[] = [
  // The cohort view: every TCGA-BRCA primary tumor as one 1px row across the
  // whole genome, clustered so tumors with similar profiles sit together.
  // Recurrent events read as vertical stripes down the stack: blue at 9p21
  // (CDKN2A) and 10q23 (PTEN), red at 17q12 (ERBB2), 8q24 (MYC) and 11q13
  // (CCND1). This is the figure the tutorial is built around.
  {
    mode: 'url',
    name: 'tcga/cohort_cnv_genome',
    url: kgUrl({
      sessionTracks: [TCGA_BRCA_CNV_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          displayedRegionNames: HG38_MAIN_CHROMS,
          trackLabels: 'offset',
          tracks: [
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
    // by far the heaviest spec here: the whole-genome view pulls essentially the
    // entire 5.7MB BED before it can build the 1104-row matrix and cluster it.
    // 180s captured it twice and then timed out on a third run, so give it room.
    // The zoomed ERBB2 spec below fetches one 1.5Mb window and is nowhere near
    // this bound.
    readyTimeout: 420000,
    viewportWidth: 1900,
    viewportHeight: 900,
    settleMs: 20000,
    // 1104 rows floored to 1px: sub-pixel row-boundary jitter between runs, so
    // the gate sits above the default
    diffThreshold: 0.02,
    // Name the four recurrent stripes. BRCA1 is deliberately NOT one of them:
    // it drives breast cancer through germline point mutations, not a recurrent
    // copy-number event, and at this scale it lands 2px from ERBB2 anyway. Each
    // locus here was checked against the rendered pixels first — the labeled
    // column carries 3.5-7x its neighborhood's fraction of saturated rows. (PTEN
    // at 10q23 is the fifth classic locus but reaches only ~1.4x here, too faint
    // to point at honestly, so it is left unlabeled.) Callouts sit low, where
    // the stack is palest, with an arrow up into the stripe.
    annotations: [
      {
        type: 'text',
        x: 790,
        y: 725,
        fontSize: 20,
        maxWidth: 200,
        text: 'MYC (8q24)',
      },
      {
        type: 'arrow',
        from: { x: 930, y: 712 },
        to: { x: wgX('8', 127735434), y: 615 },
      },
      {
        type: 'text',
        x: 930,
        y: 838,
        fontSize: 20,
        maxWidth: 200,
        text: 'CDKN2A (9p21)',
      },
      {
        type: 'arrow',
        from: { x: 1000, y: 820 },
        to: { x: wgX('9', 21967752), y: 650 },
      },
      {
        type: 'text',
        x: 1090,
        y: 725,
        fontSize: 20,
        maxWidth: 200,
        text: 'CCND1 (11q13)',
      },
      {
        type: 'arrow',
        from: { x: 1150, y: 712 },
        to: { x: wgX('11', 69641156), y: 615 },
      },
      {
        type: 'text',
        x: 1450,
        y: 725,
        fontSize: 20,
        maxWidth: 200,
        text: 'ERBB2 (17q12)',
      },
      {
        type: 'arrow',
        from: { x: 1515, y: 712 },
        to: { x: wgX('17', 39688094), y: 615 },
      },
    ],
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
