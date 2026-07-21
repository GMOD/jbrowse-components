import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures for the single-cell ATAC pseudobulk tutorial (scatac_pseudobulk.md).
// They load the CATlas single-cell ATAC atlas (16 cell types, Zhang et al. 2021)
// from the demo config as a MultiQuantitativeTrack, one accessibility row per
// cell type. The gallery already shows the pancreatic INS example; this adds a
// second, different-lineage marker so the cell-type-restriction pattern reads as
// general rather than a one-off.
export const scatacSpecs: ScreenshotSpec[] = [
  // ALB (albumin) is the textbook hepatocyte-specific gene. Its promoter should
  // read strongly open in the Hepatocyte row and near-silent in the other 15
  // cell types, the cleanest single-lineage contrast in this atlas subset.
  {
    mode: 'url',
    name: 'scatac/alb_hepatocyte',
    url: sessionSpec('test_data/config_demo.json', {
      views: [
        {
          assembly: 'hg38',
          loc: 'chr4:73,390,000-73,435,000',
          type: 'LinearGenomeView',
          tracks: [
            {
              trackId: 'ncbi_refseq_109_hg38_latest',
              type: 'LinearBasicDisplay',
              displayMode: 'compact',
              showOnlyGenes: true,
              height: 60,
            },
            {
              trackId: 'catlas_scatac_celltypes_hg38',
              type: 'MultiLinearWiggleDisplay',
              // 16 rows: tall enough that Hepatocyte (row 13) clears the crop
              height: 430,
            },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    settleMs: 15000,
    viewportHeight: 680,
  },
]
