import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures for the Minigraph-Cactus pangenome tutorial (pangenome_cactus.md).
// They load the same hosted ecoli_pangenome demo config as the pggb figures
// (specs/pangenome.ts), whose ecoli_cactus_* tracks are the Minigraph-Cactus
// projections of the same four strains, as a bare ?config= against the local
// build. Every projection is anchored on the K12 reference, so each is a plain
// LinearGenomeView on K12 (the synteny one stacks all four). Remote demo data →
// generous settle.
const CONFIG = encodeURIComponent(
  'https://jbrowse.org/demos/ecoli_pangenome/config.json',
)

export const pangenomeCactusSpecs: ScreenshotSpec[] = [
  // Projection 1: all-vs-all synteny (halSynteny from the HAL). The four strains
  // stacked K12 -> NCTC86, one halSynteny ribbon per adjacent pair. K12/Sakai/
  // CFT073 read as clean colinear diagonals; CFT073<->NCTC86 crosses in an X
  // because NCTC86 is assembled in the opposite orientation, the same inversion
  // the pggb graph and the odgi viz raster report.
  {
    mode: 'url',
    name: 'pangenome_cactus/synteny',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          // IAI39 last, matching the pggb figure: the first four rows are the
          // near-colinear backbone and the bottom band is the only one showing
          // rearrangement, so the crossings are attributable to one strain.
          views: [
            { assembly: 'K12' },
            { assembly: 'Sakai' },
            { assembly: 'CFT073' },
            { assembly: 'NCTC86' },
            { assembly: 'IAI39' },
          ],
          tracks: [
            ['ecoli_cactus_ava'],
            ['ecoli_cactus_ava'],
            ['ecoli_cactus_ava'],
            ['ecoli_cactus_ava'],
          ],
          drawCurves: false,
          colorBy: 'default',
          minAlignmentLength: 10000,
          levelHeights: [110, 110, 110, 110],
        },
      ],
    }),
    // five rows and four 110px bands
    viewportHeight: 1030,
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 120000,
    settleMs: 15000,
  },

  // Projection 2: the graph's pangenome variants as a multi-sample matrix, with
  // the MAF alignment stacked below as the base-level view the variants were
  // decomposed from, and the K12 gene lane above for context.
  {
    mode: 'url',
    name: 'pangenome_cactus/variant_matrix',
    url: sessionSpec(CONFIG, {
      // the same VCF a second time as a plain variant lane (reviewer: show the
      // raw calls too). A view holds a track once, so the raw lane needs its own
      // trackId; the adapter is absolute because a session track has no config
      // baseUri to resolve against.
      sessionTracks: [
        {
          type: 'VariantTrack',
          trackId: 'ecoli_cactus_variants_raw',
          name: 'MC graph: pangenome variants (raw calls)',
          assemblyNames: ['K12'],
          adapter: {
            type: 'VcfTabixAdapter',
            uri: 'https://jbrowse.org/demos/ecoli_pangenome/ecoli_cactus.vcf.gz',
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:995,000-1,015,000',
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay' },
            {
              // Unfiltered, so the nested top-level bubbles the genotype lane
              // below filters out are still visible — as what they are, a few
              // wide records, rather than as a wall of red genotype cells.
              trackId: 'ecoli_cactus_variants_raw',
              type: 'LinearVariantDisplay',
              height: 70,
            },
            {
              // NOT the matrix display: the matrix packs every variant into an
              // equal-width column, which with only three strains spends the
              // whole lane on three fat bands and throws away where the variants
              // actually are. This display keeps them on genomic coordinates, so
              // they line up with the gene lane above and the MAF below.
              trackId: 'ecoli_cactus_variants',
              type: 'LinearMultiSampleVariantDisplay',
              height: 160,
              // Cactus's VCF is nested like pggb's: chr:997,582 is a 7,086 bp
              // top-level bubble carrying a different allele in each of the
              // three strains (GT 1/2/3), so two of them are "other alt" and it
              // painted 7 kb of flat dark red over the SNPs underneath. That one
              // record IS the red block the review flagged. Filtering the
              // genotype lane to <100 bp leaves the decomposed SNP layer, and
              // the raw lane above still shows the bubble.
              jexlFilters: [
                "jexl:get(feature,'end')-get(feature,'start') < 100",
              ],
            },
            { trackId: 'ecoli_cactus_maf', type: 'LinearMafDisplay' },
          ],
        },
      ],
    }),
    readyText: '1,000,000',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 820,
    settleMs: 15000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 950, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
  },

  // Projection 3: the graph's whole-genome alignment (the HAL) projected onto K12
  // as a MAF. Coverage band on top, one row per strain (K12 first), colored where
  // each differs from K12. A shared-backbone window, so mismatches read as SNP
  // divergence.
  {
    mode: 'url',
    name: 'pangenome_cactus/maf',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:800,000-806,000',
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay' },
            { trackId: 'ecoli_cactus_maf', type: 'LinearMafDisplay' },
          ],
        },
      ],
    }),
    readyText: '806,000',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 480,
    settleMs: 15000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 950, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
  },

  // The JBrowse half of the odgi-viz correspondence pair. Same three loci the
  // banded raster (pangenome_cactus/graph.png) boxes, in the same three colors,
  // so a reader can carry a box from one figure to the other.
  //
  // The K12 coordinates are pinned to the pinned graph (fixed RefSeq accessions
  // + pinned cactus image, see build_ecoli_pangenome_cactus.sh), and were picked
  // by walking the graph's own K12 path: each 100kb K12 window was scored by how
  // much PANGENOME sequence it spans (the graph's node order is monotonic along
  // K12, verified), and these are the three highest-scoring well-separated
  // windows. Each is 2.15% of the K12 axis but 4.4-6.2% of the graph's, which is
  // the entire point of the pair — same locus, visibly different width, because
  // one axis counts K12 bases and the other counts pangenome bases.
  {
    mode: 'url',
    name: 'pangenome_cactus/graph_correspondence',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:1-4,641,652',
          highlight: [
            // explicit alpha: getHighlightColor uses a user-supplied color
            // AS-IS, so a bare hex paints an opaque bar over the depth track it
            // is meant to point at
            {
              refName: 'chr',
              start: 1000000,
              end: 1100000,
              color: 'rgba(31,119,180,0.40)',
            },
            {
              refName: 'chr',
              start: 2040000,
              end: 2140000,
              color: 'rgba(255,127,14,0.40)',
            },
            {
              refName: 'chr',
              start: 3100000,
              end: 3200000,
              color: 'rgba(44,160,44,0.40)',
            },
          ],
          tracks: [
            {
              trackId: 'ecoli_cactus_depth',
              type: 'LinearWiggleDisplay',
              height: 160,
            },
          ],
        },
      ],
    }),
    readyText: 'pangenome depth',
    readyTimeout: 90000,
    // 1040 CSS px captures at 2080, the odgi raster's exact width, so the two
    // figures stack cleanly in the docs at the same scale
    viewportWidth: 1040,
    viewportHeight: 380,
    settleMs: 15000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 990, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
  },

  // Projection 4: the two odgi projections in one whole-chromosome view — the
  // aggregate depth curve (odgi depth) over the per-strain presence rows (odgi
  // pav). They were two figures; alone, the depth wiggle is a solid blue wall
  // that says nothing about WHICH strain is missing, which is exactly what the
  // rows below it answer, so one dip and its explanation now sit in one frame.
  {
    mode: 'url',
    name: 'pangenome_cactus/pav',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:1-4,641,652',
          tracks: [
            {
              trackId: 'ecoli_cactus_depth',
              type: 'LinearWiggleDisplay',
              height: 150,
            },
            {
              trackId: 'ecoli_cactus_pav',
              type: 'MultiLinearWiggleDisplay',
              // 4 strains at 60px a row, enough for the accessory dips to read
              // without the stack dominating the frame
              height: 240,
            },
          ],
        },
      ],
    }),
    readyText: 'per-strain presence',
    readyTimeout: 90000,
    viewportWidth: 1000,
    // fits the 150px depth track plus the whole 240px stack
    viewportHeight: 640,
    settleMs: 15000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 950, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
  },
]
