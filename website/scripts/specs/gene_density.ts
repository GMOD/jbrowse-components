import { lgvSession } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The hg38 RefSeq curated genes and three RepeatMasker families, each beside a
// features-per-kilobase bigWig of its own (demos/gene_density/README.md).
const CONFIG = 'https://jbrowse.org/demos/gene_density/config.json'

export const geneDensitySpecs: ScreenshotSpec[] = [
  // Chromosome 1 end to end, the four per-kilobase tracks. The simple repeats
  // are the control, level where the other three move.
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
  // 10 Mb over 1q21 to 1q23, where the gene fetch fits: the genes as features
  // above the Alu and L1 counts per kilobase.
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
    // three tracks, so the default 800 left 184 css px of blank under them
    viewportHeight: 620,
  },
]
