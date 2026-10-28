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

function detect(contigs: Contig[], regions: Record<string, number>) {
  const lengths = assemblyContigLengths(
    Object.entries(regions).map(([refName, end]) => ({
      refName,
      start: 0,
      end,
    })),
  )
  return detectContigLengthMismatch({
    assemblyName: 'asm',
    contigs,
    assemblyLengths: lengths,
    getCanonicalRefName: name => (lengths.has(name) ? name : undefined),
  })
}

const volvox = { ctgA: 50_001, ctgB: 6079 }

test('a CRAM made against volvox states its lengths and passes', async () => {
  const contigs = await cram('../../test_data/volvox-sorted.cram').getContigs()
  expect(contigs.find(c => c.refName === 'ctgA')?.length).toBe(50_001)
  expect(detect(contigs, volvox)).toBeUndefined()
})

test('the same CRAM on another version of ctgA is reported', async () => {
  const contigs = await cram('../../test_data/volvox-sorted.cram').getContigs()
  expect(detect(contigs, { ...volvox, ctgA: 48_000 })?.differences).toEqual([
    { refName: 'ctgA', fileLength: 50_001, assemblyLength: 48_000 },
  ])
})

// the methylation demo's assembly is 29,565 bp cut from the start of hg38's
// chr20, and its BAM keeps the full 64,444,167 bp @SQ
test('a demo assembly sliced from the file contig passes', async () => {
  const contigs = await bam(
    '../../../../test_data/methylation_test/methylation_clip.bam',
  ).getContigs()
  expect(contigs).toEqual([
    expect.objectContaining({ refName: '20', length: 64_444_167 }),
  ])
  expect(detect(contigs, { 20: 29_565 })).toBeUndefined()
})

test('a lengths-only read skips the index walk for hasData', async () => {
  const adapter = cram('../../test_data/volvox-sorted.cram')
  expect(await adapter.getContigs({ contigLengthsOnly: true })).toEqual([
    { refName: 'ctgA', length: 50_001 },
  ])
  expect((await adapter.getContigs())[0]).toMatchObject({ hasData: true })
})
