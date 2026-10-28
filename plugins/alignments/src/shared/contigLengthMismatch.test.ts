import {
  assemblyContigLengths,
  detectContigLengthMismatch,
} from '@jbrowse/core/assemblyManager/assembly'

import BamAdapter from '../BamAdapter/BamAdapter.ts'
import bamConfigSchema from '../BamAdapter/configSchema.ts'
import CramAdapter from '../CramAdapter/CramAdapter.ts'
import {
  getVolvoxSequenceSubAdapter,
  volvoxReference,
} from '../CramAdapter/CramTestAdapters.fixture.ts'
import cramConfigSchema from '../CramAdapter/configSchema.ts'

import type { Contig } from '@jbrowse/core/data_adapters/BaseAdapter'

function local(path: string) {
  return { localPath: require.resolve(path), locationType: 'LocalPathLocation' }
}

function bam(path: string) {
  return new BamAdapter(
    bamConfigSchema.create({
      bamLocation: local(path),
      index: { location: local(`${path}.bai`) },
    }),
    getVolvoxSequenceSubAdapter,
    undefined,
    volvoxReference,
  )
}

function cram(path: string) {
  return new CramAdapter(
    cramConfigSchema.create({
      cramLocation: local(path),
      craiLocation: local(`${path}.crai`),
    }),
    getVolvoxSequenceSubAdapter,
    undefined,
    volvoxReference,
  )
}

// volvox.fa
const volvox = assemblyContigLengths([
  { refName: 'ctgA', start: 0, end: 50_001 },
  { refName: 'ctgB', start: 0, end: 6079 },
])

function detect(contigs: Contig[]) {
  return detectContigLengthMismatch({
    assemblyName: 'volvox',
    contigs,
    assemblyLengths: volvox,
    getCanonicalRefName: name => (volvox.has(name) ? name : undefined),
  })
}

test('a CRAM made against volvox states its lengths and passes', async () => {
  const contigs = await cram('../../test_data/volvox-sorted.cram').getContigs()
  expect(contigs.find(c => c.refName === 'ctgA')?.length).toBe(50_001)
  expect(detect(contigs)).toBeUndefined()
})

// paired_rnaseq.bam's ctgA is a 1,078,177 bp sequence of another genome
test('a BAM made against another ctgA is reported', async () => {
  const contigs = await bam(
    '../../../../test_data/volvox/paired_rnaseq.bam',
  ).getContigs()
  expect(detect(contigs)?.differences).toEqual([
    { refName: 'ctgA', fileLength: 1_078_177, assemblyLength: 50_001 },
  ])
})
