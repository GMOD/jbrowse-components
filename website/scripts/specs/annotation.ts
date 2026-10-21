import { DEMO_CONFIG, lgvSession } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Without `genes: 'only'`, GENCODE's region features paint a bar above the genes
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
          height: 110,
        },
        {
          trackId: 'gencode_47',
          filter: { genes: 'only' },
          height: 170,
        },
      ],
    }),
    readyText: 'Tiberius gene predictions',
    readyTimeout: 90000,
    viewportHeight: 536,
  },
]
