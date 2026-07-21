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
              trackId: 'ecoli_cactus_variants',
              type: 'LinearMultiSampleVariantMatrixDisplay',
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
    viewportHeight: 360,
    settleMs: 15000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 950, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
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
              height: 240,
            },
          ],
        },
      ],
    }),
    readyText: 'per-strain presence',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 400,
    settleMs: 15000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 950, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
  },
]
