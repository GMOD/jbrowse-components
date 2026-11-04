import { DEMO_CONFIG, lgvSession } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Without the `geneLike` filter, GENCODE's region features paint a bar above the genes
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
          height: 90,
        },
        {
          trackId: 'gencode_47',
          filter: ['geneLike'],
          height: 150,
        },
      ],
    }),
    readyText: 'Tiberius gene predictions',
    readyTimeout: 90000,
    // narrow, so the tutorial card's 5:3 crop keeps both models whole
    viewportWidth: 1000,
    viewportHeight: 520,
    // GENCODE labels its genes by accession, so the names the caption uses
    // are pills under them
    annotations: (
      [
        ['IL17REL', 'ENSG00000188263.11'],
        ['TTLL8', 'ENSG00000138892.12'],
      ] as const
    ).map(([text, accession]) => ({
      type: 'text' as const,
      text,
      anchor: { text: accession, dy: 50 },
    })),
  },
]
