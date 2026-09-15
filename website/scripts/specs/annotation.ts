import { DEMO_CONFIG, lgvSession } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Tiberius against GENCODE at the one merged model on chr22. The prediction
// runs straight through the 5,809 bp gap between IL17REL and TTLL8, which is
// the whole reason gene_prediction_review.md exists, and the picture only reads
// if both annotations are in it at a zoom where the gap is visible.
//
// showOnlyGenes on the GENCODE track drops the region and biological_region
// features a full annotation carries, which otherwise paint a bar across the
// whole row above the genes.
export const annotationSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'gene_prediction_merge',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr22:49,987,402-50,067,759',
      tracks: [
        {
          trackId: 'tiberius_grch38',
          type: 'LinearBasicDisplay',
          height: 110,
        },
        {
          trackId: 'gencode_47',
          type: 'LinearBasicDisplay',
          showOnlyGenes: true,
          height: 170,
        },
      ],
    }),
    readyText: 'Tiberius gene predictions',
    readyTimeout: 90000,
    settleMs: 4000,
    viewportHeight: 500,
  },
]
