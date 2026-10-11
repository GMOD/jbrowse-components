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

export const SPLICED: AlignmentTablesArgs = {
  adapterConfig: {
    type: 'BamAdapter',
    bamLocation: uri('spliced.bam'),
    index: { location: uri('spliced.bam.bai'), indexType: 'BAI' },
  },
  sequenceAdapter,
  region: { refName: 'ctgA', start: 400, end: 1300 },
}

export const LONG_READS: AlignmentTablesArgs = {
  adapterConfig: {
    type: 'BamAdapter',
    bamLocation: uri('volvox-long-reads-sv.bam'),
    index: { location: uri('volvox-long-reads-sv.bam.bai'), indexType: 'BAI' },
  },
  sequenceAdapter,
  region: { refName: 'ctgA', start: 1000, end: 20000 },
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
