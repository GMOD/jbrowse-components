import { lgvSession } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The hg38 RefSeq curated genes and three RepeatMasker families, each with a
// features-per-kilobase sidecar beside it (demos/gene_density/README.md). Every
// track here is over the fetch budget at a whole chromosome, so what these
// figures show is the density band each draws in the banner's place.
const CONFIG = 'https://jbrowse.org/demos/gene_density/config.json'

const TRACKS = ['hg38_genes', 'hg38_Alu', 'hg38_L1', 'hg38_Simple_repeat']

export const geneDensitySpecs: ScreenshotSpec[] = [
  // Chromosome 1 end to end: four bands, no features. The simple repeats are
  // the control, level where the other three move.
  {
    mode: 'url',
    name: 'gene_density_chr1',
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      loc: 'chr1',
      tracks: TRACKS,
    }),
    readyText: 'RefSeq curated genes',
    readyTimeout: 60000,
    settleMs: 6000,
  },
  // 10 Mb over 1q21 to 1q23, where the gene fetch fits and the two repeat
  // fetches still do not: features on the first track, bands on the other two.
  {
    mode: 'url',
    name: 'gene_density_1q21',
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      loc: 'chr1:150,000,000-160,000,000',
      tracks: ['hg38_genes', 'hg38_Alu', 'hg38_L1'],
    }),
    readyText: 'RefSeq curated genes',
    readyTimeout: 60000,
    settleMs: 6000,
    // three tracks, so the default 800 left 184 css px of blank under them
    viewportHeight: 620,
  },
]
