import { BamRecord } from '@gmod/bam'
import { LocalFile } from 'generic-filehandle2'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { SequenceAdapter } from '../CramAdapter/CramTestAdapters.ts'
import { getMappingQuality, hasPairOrientation } from '../shared/util.ts'
import Adapter from './BamAdapter.ts'
import configSchema from './configSchema.ts'

import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'

// the reference a fetch of MD-less reads compares against; the RPC path builds
// the adapter with it, so a bare construction has to hand it over the same way
const getVolvoxSequenceSubAdapter: getSubAdapterType = async () => ({
  dataAdapter: new SequenceAdapter(
    new LocalFile(require.resolve('../../test_data/volvox.fa')),
  ),
  sessionIds: new Set(),
})
const reference = { type: 'TestSequenceAdapter' }

function volvoxBam(name: string) {
  const bam = require.resolve(`../../../../test_data/volvox/${name}`)
  return new Adapter(
    configSchema.create({
      bamLocation: { localPath: bam, locationType: 'LocalPathLocation' },
      index: {
        location: {
          localPath: `${bam}.bai`,
          locationType: 'LocalPathLocation',
        },
      },
    }),
    getVolvoxSequenceSubAdapter,
    undefined,
    reference,
  )
}

function readsOf(name: string, end = 50000) {
  return firstValueFrom(
    volvoxBam(name)
      .getFeatures({ assemblyName: 'volvox', refName: 'ctgA', start: 0, end })
      .pipe(toArray()),
  )
}

// STAR writes MAPQ 255 on every unique read, which @gmod/bam reports as no
// score, so getMappingQuality asks for `mappingQual` on nearly every read of
// an RNA-seq BAM. A name no getter answers used to build the whole serialized
// feature, decoding every tag and caching them on a record the chunk LRU keeps.
test('a field no getter answers decodes no tags', async () => {
  const reads = await readsOf('volvox-rnasim.bam')
  expect(
    reads.filter(f => f.get('score') === undefined).length,
  ).toBeGreaterThan(0)
  const tags = jest.spyOn(BamRecord.prototype, 'tags', 'get')
  try {
    for (const f of reads) {
      getMappingQuality(f)
      f.get('mate')
    }
    expect(tags).not.toHaveBeenCalled()
  } finally {
    tags.mockRestore()
  }
})

test('the serialized-only fields still answer through get', async () => {
  const [read] = await readsOf('volvox-rnasim.bam')
  expect(read!.get('type')).toBe('match')
  expect(read!.get('uniqueId')).toBe(read!.id())
  expect(read!.get('next_segment_position')).toBe(
    read!.toJSON().next_segment_position,
  )
})

// The details panel renders these keys in order, so the tag block sits above
// the read's sequence rather than between SEQ and QUAL
test('the serialized read lists its tags before its sequence', async () => {
  const [read] = await readsOf('volvox-rnasim.bam')
  const keys = Object.keys(read!.toJSON())
  expect(keys.indexOf('tags')).toBeLessThan(keys.indexOf('seq'))
})

test.each([
  ['volvox-translocation.bam', 'a mate on another reference'],
  ['paired_end_stranded_rnaseq.bam', 'an unmapped mate'],
])(
  '%s: a pair with %s has no orientation, as SAM gives it none',
  async name => {
    const reads = await readsOf(name)
    const described = reads.filter(f =>
      hasPairOrientation(
        f.get('flags') as number,
        f.get('next_ref') === f.get('refName'),
      ),
    )
    expect(described.length).toBeLessThan(reads.length)
    for (const f of reads) {
      expect(f.get('pair_orientation') !== undefined).toBe(
        described.includes(f),
      )
    }
  },
)
