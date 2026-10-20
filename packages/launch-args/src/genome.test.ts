import { hubUrl } from '@jbrowse/core/util/fetchHub'

import { genomeConfigUrl } from './genome.ts'

test.each(['hg38', 'hs1', 'GCA_964188535.1', 'GCF_000001405.40'])(
  '%s resolves the same as core',
  genome => {
    expect(genomeConfigUrl(genome)).toBe(hubUrl(genome))
  },
)
