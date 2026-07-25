import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// HPRC Release 2 (bioRxiv 2026.07.21.739710, 460 haplotypes). The Minigraph-Cactus
// `wave` VCF is the one HPRC2 product a browser can open with no preprocessing at
// all: it ships tabix-indexed beside the graph, and the bucket serves range
// requests with `Access-Control-Allow-Origin: *`, so these figures stream the
// released 2.3 GB file straight off HPRC's S3.
//
// 232 samples, every genotype phased, hence `renderingMode: 'phased'` -> 464
// haplotype rows. Release 2 ships no minigraph/ directory, but its
// Minigraph-Cactus sv.gfa.gz IS rGFA (SR:i:0 on GRCh38#0#chrN), so the graph
// view is not tied to v1.0 -- it needs `assemblyNameToPanSN` because those
// stable names are PanSN. See agent-docs/RGFA_GRAPH_HANDOFF.md.
const CONFIG = 'test_data/hprc2/config.json'

const TRACK = 'hprc2_wave_grch38'

// The MHC window the matrix figures cover: 200 kb of HLA class II/III.
const MHC_WINDOW = 'chr6:32,450,000-32,650,000'

// The wave VCF is fully decomposed, so that window holds ~14,300 records and
// all but a couple of hundred are SNPs — 13,000 one-pixel columns of point
// divergence that read as noise (reviewer: "should probably use SV vcf instead
// of snps"). HPRC release 2 publishes no separate SV callset, but the SV tier
// is already in this file: filtering to alleles of 50 bp or more leaves 220
// columns over the same window, each a real insertion or deletion, wide enough
// to see per haplotype. `alleleLength` rather than end-start because an
// insertion consumes no reference — a span filter would keep only deletions.
const SV_FILTER = ['jexl:alleleLength(feature) >= 50']

// Readiness. The track *name* is a useless gate here — it renders the moment the
// track mounts, long before a byte of the 2.3 GB VCF has been fetched, and
// `waitForDisplayPhases` only means "nothing is loading", which is trivially true
// in the window before the display has entered `loading` at all. So each spec
// waits on its own display wrapper reporting BOTH signals DisplayChrome
// publishes on that element: `-done` (canvasDrawn) and `data-display-phase=ready`
// (the whole fetch finished, not just first paint — an empty canvas flips
// canvasDrawn on its own).
const REGULAR_READY =
  '[data-testid="variant-display-done"][data-display-phase="ready"]'

// A clustered display is ready only once its dendrogram exists AND the reordered
// matrix has repainted. `body:has(dendrogram) <display>` is an AND (a bare `A,B`
// would be a CSS OR and fire on whichever landed first), so this waits for the
// post-clustering frame rather than the pre-clustering one.
const clusteredReady = (base: string) =>
  `body:has([data-testid="tree_sidebar_dendrogram"]) ${base}`

export const hprc2Specs: ScreenshotSpec[] = [
  // The MHC figure: every structural allele (>=50 bp) of the window, one row per
  // haplotype, clustered by genotype so the classical HLA haplotypes fall out of
  // the pangenome alone with no HLA typing involved. `runClustering` runs the
  // real clustering RPC declaratively and `readySelector` waits on the
  // dendrogram, so this stays correct however long clustering takes rather than
  // guessing a delay.
  //
  // The REGULAR multi-sample display, not the matrix (reviewer): 220 SVs at
  // their genomic positions line up with the gene lane above, where matrix mode
  // would spread them evenly across the width and break that correspondence.
  // Matrix mode earns its keep on thousands of tightly-spaced columns, which is
  // exactly what the SV filter removes.
  {
    mode: 'url',
    name: 'hprc2/mhc_clustered',
    url: sessionSpec(CONFIG, {
      // the config declares no gene track, and the reviewer's ask is to see
      // which genes the haplotype blocks sit over
      sessionTracks: [
        {
          type: 'FeatureTrack',
          trackId: 'hg38_ncbiRefSeq_ucsc',
          name: 'NCBI RefSeq genes (hg38)',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'Gff3TabixAdapter',
            gffGzLocation: {
              uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz.csi',
                locationType: 'UriLocation',
              },
              indexType: 'CSI',
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: MHC_WINDOW,
          tracks: [
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              geneGlyphMode: 'longestCoding',
              displayMode: 'compact',
            },
            {
              trackId: TRACK,
              type: 'LinearMultiSampleVariantDisplay',
              // shorter than the matrix figure's 700: 464 rows still read at
              // this height and it leaves the gene lane its share of the frame
              height: 460,
              jexlFilters: SV_FILTER,
              runClustering: true,
            },
          ],
        },
      ],
    }),
    readySelector: clusteredReady(REGULAR_READY),
    readyTimeout: 360000,
    viewportWidth: 1200,
    viewportHeight: 780,
    settleMs: 5000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 1150, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
  },

  // Local ancestry. PCLAI (Point Cloud Local Ancestry Inference) ships one BED
  // per haplotype, already on GRCh38, with a continuous PCA-space color in
  // itemRgb. LinearMultiRowFeatureDisplay wants the opposite shape (one file, a
  // column naming each row), so scripts/build_hprc2_pclai.sh projects and
  // concatenates 64 of them. The BED stays at 10 columns on purpose: the parser
  // only applies named BED fields at exactly 12, so the color lands in `field8`
  // and the automatic BED color path claims it with no columnNames and no jexl.
  //
  // Windowed to chr1:210Mb-end rather than the whole chromosome. Across all of
  // chr1 the view is ~226kb/px, so ancestry tracts (median ~0.24Mb) collapse
  // below a pixel and all but a handful of rows read as one solid colour - the
  // "just flat colour bands" the review flagged. Picked by counting colour
  // switches per window in the BED: 44 of the 64 haplotypes switch inside
  // 210Mb-end versus 29 in 170-200Mb and 33 in 110-140Mb, and at 44kb/px the
  // median tract is ~5px, so the mosaic and its breakpoints are actually
  // visible. Coverage is continuous here (no assembly gap to leave a white
  // band). The hosted BED is chr1-only (build_hprc2_pclai.sh takes one
  // chromosome), so a different chromosome would need a rebuild + rehost.
  //
  // rowHeight defaults to 0 (auto-fit), so all 64 haplotypes stretch to fill the
  // display. No legend: the colormap is continuous, so the auto-derived key
  // exceeds MAX_LEGEND_ENTRIES and renders nothing. That rules out the
  // `multirow-color-legend` gate; this gates on `multirow-row-labels`, the
  // display's data-derived doneness signal, rendered from `sources` that only
  // exist once features have been fetched and binned into rows.
  {
    mode: 'url',
    name: 'hprc2/local_ancestry',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr1:210,000,000-248,945,532',
          tracks: [
            {
              trackId: 'hprc2_pclai_painting',
              type: 'LinearMultiRowFeatureDisplay',
              height: 520,
            },
          ],
        },
      ],
    }),
    readySelector: '[data-testid="multirow-row-labels"]',
    readyTimeout: 240000,
    viewportWidth: 1200,
    viewportHeight: 740,
    settleMs: 8000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 1150, y: 40 } },
      { type: 'delay', ms: 2000 },
    ],
  },

  // The same painting with the haplotype rows clustered. The multirow display
  // shares the variant matrix's TreeSidebarMixin + `runClustering` trigger, so
  // this is the same declarative clustering as mhc_clustered: it reorders
  // ancestry-similar rows together and draws a dendrogram. Gate on the
  // dendrogram AND the row labels so the capture is the post-clustering frame.
  {
    mode: 'url',
    name: 'hprc2/local_ancestry_clustered',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr1:210,000,000-248,945,532',
          tracks: [
            {
              trackId: 'hprc2_pclai_painting',
              type: 'LinearMultiRowFeatureDisplay',
              height: 520,
              runClustering: true,
            },
          ],
        },
      ],
    }),
    readySelector: clusteredReady('[data-testid="multirow-row-labels"]'),
    readyTimeout: 300000,
    viewportWidth: 1200,
    viewportHeight: 740,
    settleMs: 8000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 1150, y: 40 } },
      { type: 'delay', ms: 2000 },
    ],
  },
]
