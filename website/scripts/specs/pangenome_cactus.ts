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
          views: [
            { assembly: 'K12' },
            { assembly: 'Sakai' },
            { assembly: 'CFT073' },
            { assembly: 'NCTC86' },
          ],
          tracks: [
            ['ecoli_cactus_ava'],
            ['ecoli_cactus_ava'],
            ['ecoli_cactus_ava'],
          ],
          drawCurves: false,
          colorBy: 'default',
          minAlignmentLength: 10000,
        },
      ],
    }),
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
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:995,000-1,015,000',
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay' },
            {
              // NOT the matrix display: the matrix packs every variant into an
              // equal-width column, which with only three strains spends the
              // whole lane on three fat bands and throws away where the variants
              // actually are. This display keeps them on genomic coordinates, so
              // they line up with the gene lane above and the MAF below.
              trackId: 'ecoli_cactus_variants',
              type: 'LinearMultiSampleVariantDisplay',
              height: 160,
            },
            { trackId: 'ecoli_cactus_maf', type: 'LinearMafDisplay' },
          ],
        },
      ],
    }),
    readyText: '1,000,000',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 740,
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
    viewportHeight: 440,
    settleMs: 15000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 950, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
  },

  // Projection 4: pangenome depth (odgi depth) as a whole-chromosome overview, so
  // the shared plateau near 4 and the accessory dips toward 1 read at a glance.
  {
    mode: 'url',
    name: 'pangenome_cactus/depth',
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
              height: 200,
            },
          ],
        },
      ],
    }),
    readyText: 'pangenome depth',
    readyTimeout: 90000,
    viewportWidth: 1000,
    // 360 clipped the bottom of the 200px wiggle
    viewportHeight: 420,
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

  // The payoff for the boxed loci: the first box (K12 1.0-1.1 Mb, blue in
  // graph_correspondence) opened as a four-way synteny view, so the reader can
  // see what the depth dip and the over-wide graph box actually contain.
  //
  // Each row's window is read off the same halSynteny PAF the ribbons are drawn
  // from (ecoli_cactus_ava.pif.gz), not chosen by eye: the K12 window's end
  // points are walked through the blocks that span them, so every row holds the
  // stretch of its own genome that aligns to K12 1.0-1.1 Mb.
  //
  //   K12      chr:1,000,000-1,100,000     100 kb
  //   Sakai    chr:1,129,000-1,462,000     333 kb (carries the 66 kb stx2
  //                                        prophage, Sakai 1,243,711-1,309,458,
  //                                        plus an 84 kb private stretch)
  //   CFT073   chr:1,044,000-1,243,500     200 kb
  //   NCTC86   chr:2,972,000-3,062,000      90 kb, reverse orientation, so its
  //                                        ribbon crosses (as in the
  //                                        whole-genome synteny figure)
  //
  // The spans are the figure: the rows are deliberately NOT squared to the same
  // bp/px, because the whole point is that the same K12 window costs 90-333 kb
  // in the other strains. That ratio is the graph axis being 2-3x wider than the
  // K12 axis in the graph_correspondence pair.
  //
  // showOnlyGenes + compact drops the CDS lanes and the full-width RefSeq
  // `region` feature so the accessory content is readable at four rows.
  {
    mode: 'url',
    name: 'pangenome_cactus/boxed_locus_synteny',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          views: [
            {
              assembly: 'K12',
              loc: 'chr:1,000,000-1,100,000',
              tracks: [
                {
                  trackId: 'K12_genes',
                  showOnlyGenes: true,
                  displayMode: 'compact',
                  showDescriptions: false,
                },
              ],
            },
            {
              assembly: 'Sakai',
              loc: 'chr:1,129,000-1,462,000',
              tracks: [
                {
                  trackId: 'Sakai_genes',
                  showOnlyGenes: true,
                  displayMode: 'compact',
                  showDescriptions: false,
                },
              ],
            },
            {
              assembly: 'CFT073',
              loc: 'chr:1,044,000-1,243,500',
              tracks: [
                {
                  trackId: 'CFT073_genes',
                  showOnlyGenes: true,
                  displayMode: 'compact',
                  showDescriptions: false,
                },
              ],
            },
            {
              assembly: 'NCTC86',
              loc: 'chr:2,972,000-3,062,000',
              tracks: [
                {
                  trackId: 'NCTC86_genes',
                  showOnlyGenes: true,
                  displayMode: 'compact',
                  showDescriptions: false,
                },
              ],
            },
          ],
          tracks: [
            ['ecoli_cactus_ava'],
            ['ecoli_cactus_ava'],
            ['ecoli_cactus_ava'],
          ],
          drawCurves: true,
          colorBy: 'default',
          // three bands at 90px: enough for the wedges to read without the
          // four gene rows falling off the frame
          levelHeights: [90, 90, 90],
          alpha: 0.8,
        },
      ],
    }),
    // 1000 clipped the bottom gene row; this fits all four rows plus the three
    // 90px bands
    viewportHeight: 1080,
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 120000,
    settleMs: 15000,
  },

  // Projection 4b: per-strain presence (odgi pav) as a MultiQuantitativeTrack,
  // whole-chromosome so each strain's accessory dips read beside the aggregate
  // depth curve.
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
              trackId: 'ecoli_cactus_pav',
              type: 'MultiLinearWiggleDisplay',
              // 3 strains: 180 gives a 60px row each, enough for the accessory
              // dips to read without the stack dominating the frame
              height: 180,
            },
          ],
        },
      ],
    }),
    readyText: 'per-strain presence',
    readyTimeout: 90000,
    viewportWidth: 1000,
    // 400 cut the stack off mid-strain; this fits the whole 180px stack with no
    // trailing whitespace
    viewportHeight: 420,
    settleMs: 15000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 950, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
  },
]
