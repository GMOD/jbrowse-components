import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// HPRC Release 2 (bioRxiv 2026.07.21.739710, 460 haplotypes). The Minigraph-Cactus
// `wave` VCF is the one HPRC2 product a browser can open with no preprocessing at
// all: it ships tabix-indexed beside the graph, and the bucket serves range
// requests with `Access-Control-Allow-Origin: *`, so these figures stream the
// released 2.2 GB file straight off HPRC's S3.
//
// 232 samples, every genotype phased, hence `renderingMode: 'phased'` -> 464
// haplotype rows. Release 2 ships no minigraph/ directory, but its
// Minigraph-Cactus sv.gfa.gz IS rGFA (SR:i:0 on GRCh38#0#chrN), so the graph
// view is not tied to v1.0 -- it needs `assemblyNameToPanSN` because those
// stable names are PanSN. See agent-docs/RGFA_GRAPH_HANDOFF.md.
const CONFIG = 'test_data/hprc2/config.json'

const TRACK = 'hprc2_wave_grch38'

// Readiness. The track *name* is a useless gate here — it renders the moment the
// track mounts, long before a byte of the 2.2 GB VCF has been fetched, and
// `waitForDisplayPhases` only means "nothing is loading", which is trivially true
// in the window before the display has entered `loading` at all. So each spec
// waits on its own display wrapper reporting BOTH signals DisplayChrome
// publishes on that element: `-done` (canvasDrawn) and `data-display-phase=ready`
// (the whole fetch finished, not just first paint — an empty canvas flips
// canvasDrawn on its own). Verified against the live DOM: the matrix wrapper
// reports `variant-matrix-display-done` / `ready` in a 1186x700 box, which
// `waitForVisible`'s non-empty-bbox requirement needs.
const MATRIX_READY =
  '[data-testid="variant-matrix-display-done"][data-display-phase="ready"]'
const REGULAR_READY =
  '[data-testid="variant-display-done"][data-display-phase="ready"]'

export const hprc2Specs: ScreenshotSpec[] = [
  // The density figure. MHC class II carries ~66 variants/kb in this VCF, so a
  // 50 kb window is ~3,300 columns against 464 haplotype rows — over a million
  // genotype cells in one GPU-rendered matrix, fetched live. The horizontal
  // banding is HLA haplotype structure: rows sharing a classical haplotype share
  // long runs of allele state.
  {
    mode: 'url',
    name: 'hprc2/mhc_matrix',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr6:32,550,000-32,600,000',
          tracks: [
            {
              trackId: TRACK,
              type: 'LinearMultiSampleVariantMatrixDisplay',
              height: 700,
            },
          ],
        },
      ],
    }),
    readySelector: MATRIX_READY,
    readyTimeout: 180000,
    viewportWidth: 1200,
    viewportHeight: 820,
    settleMs: 5000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 1150, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
  },

  // The same track drawn at genomic position rather than by column index, so the
  // long HPRC2 insertion alleles keep their true span. This window holds a site
  // whose longest ALT is ~39.6 kb against a 38.1 kb REF.
  {
    mode: 'url',
    name: 'hprc2/mhc_regular',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr6:32,480,000-32,530,000',
          tracks: [
            {
              trackId: TRACK,
              type: 'LinearMultiSampleVariantDisplay',
              height: 700,
            },
          ],
        },
      ],
    }),
    readySelector: REGULAR_READY,
    readyTimeout: 180000,
    viewportWidth: 1200,
    viewportHeight: 820,
    settleMs: 5000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 1150, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
  },

  // The same MHC window with the 464 haplotype rows reordered by genotype
  // similarity, so the banding of the first figure resolves into discrete
  // haplotype groups with a dendrogram beside them — the classical HLA haplotypes
  // recovered from the pangenome alone, no HLA typing involved. `runClustering`
  // runs the real clustering RPC declaratively and `readySelector` waits on the
  // dendrogram, so this stays correct however long clustering 464 haplotypes
  // takes rather than guessing a delay.
  {
    mode: 'url',
    name: 'hprc2/mhc_clustered',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr6:32,550,000-32,600,000',
          tracks: [
            {
              trackId: TRACK,
              type: 'LinearMultiSampleVariantMatrixDisplay',
              height: 700,
              runClustering: true,
            },
          ],
        },
      ],
    }),
    // Both gates, not either: `A,B` would be a CSS OR and would fire on whichever
    // landed first. `body:has(dendrogram) <display>` matches the display wrapper
    // only once clustering has also produced its tree, so this waits for the
    // reordered repaint rather than the pre-clustering frame.
    readySelector: `body:has([data-testid="tree_sidebar_dendrogram"]) ${MATRIX_READY}`,
    readyTimeout: 300000,
    viewportWidth: 1200,
    viewportHeight: 820,
    settleMs: 5000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 1150, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
  },

  // Local ancestry. PCLAI ships one BED per haplotype, already on GRCh38, with a
  // CIELAB-interpolated PCA color in itemRgb. LinearMultiRowFeatureDisplay wants
  // the opposite shape (one file, a column naming each row), so
  // scripts/build_hprc2_pclai.sh projects and concatenates 64 of them. The BED
  // stays at 10 columns on purpose: the parser only applies named BED fields at
  // exactly 12, so the color lands in `field8` and the automatic BED color path
  // claims it with no columnNames and no jexl (colorBits.ts).
  //
  // rowHeight defaults to 0 (auto-fit), so all 64 haplotypes stretch to fill the
  // display rather than overflowing it. No legend: the colormap is continuous, so
  // the auto-derived key exceeds MAX_LEGEND_ENTRIES and renders nothing, and
  // declaring four discrete ancestry labels for a continuous CIELAB axis would be
  // inventing a semantic the data does not carry.
  //
  // That rules out the `multirow-color-legend` gate the trio painting uses, and
  // the `-done` wrapper is not usable either: GPU displays paint into an absolute
  // canvas so the DisplayChrome wrapper collapses to height 0 and never passes a
  // `visible: true` wait (agent-docs/guides/SCREENSHOT_CAPTURE_RACE.md). This
  // gates on `multirow-row-labels` instead, the display's data-derived doneness
  // signal: it is rendered from `sources`, which only exist once features have
  // been fetched and binned into rows, and it holds for a continuous palette
  // where the legend does not.
  {
    mode: 'url',
    name: 'hprc2/local_ancestry',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr1:1-248,956,422',
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
]
