import path from 'node:path'
import { pathToFileURL } from 'node:url'

import type { AlignmentTablesArgs } from './index.ts'

const VOLVOX = path.resolve('test_data/volvox')
const uri = (file: string) => ({
  uri: pathToFileURL(path.join(VOLVOX, file)).href,
  locationType: 'UriLocation',
})

const sequenceAdapter = {
  type: 'IndexedFastaAdapter',
  fastaLocation: uri('volvox.fa'),
  faiLocation: uri('volvox.fa.fai'),
}
const region = { refName: 'ctgA', start: 1000, end: 6000 }

export const BAM: AlignmentTablesArgs = {
  adapterConfig: {
    type: 'BamAdapter',
    bamLocation: uri('volvox-sorted.bam'),
    index: { location: uri('volvox-sorted.bam.bai'), indexType: 'BAI' },
  },
  sequenceAdapter,
  region,
}

export const CRAM: AlignmentTablesArgs = {
  adapterConfig: {
    type: 'CramAdapter',
    cramLocation: uri('volvox-sorted.cram'),
    craiLocation: uri('volvox-sorted.cram.crai'),
  },
  sequenceAdapter,
  region,
}
