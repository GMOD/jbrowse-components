import { lgvSession } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// built by demos/gene_density/README.md
const CONFIG = 'https://jbrowse.org/demos/gene_density/config.json'

export const geneDensitySpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'gene_density_chr1',
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      loc: 'chr1',
      tracks: [
        'hg38_genes_density',
        'hg38_Alu_density',
        'hg38_L1_density',
        'hg38_Simple_repeat_density',
      ],
    }),
    readyText: 'RefSeq genes per kb',
    readyTimeout: 60000,
  },
  // the gene track's fetch fits a 10 Mb window
  {
    mode: 'url',
    name: 'gene_density_1q21',
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      loc: 'chr1:150,000,000-160,000,000',
      tracks: ['hg38_genes', 'hg38_Alu_density', 'hg38_L1_density'],
    }),
    readyText: 'RefSeq curated genes',
    readyTimeout: 60000,
    viewportHeight: 620,
  },
]
