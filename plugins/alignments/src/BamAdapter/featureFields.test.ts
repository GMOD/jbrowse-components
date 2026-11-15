import { BamRecord } from '@gmod/bam'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import {
  getVolvoxSequenceSubAdapter,
  volvoxReference,
} from '../CramAdapter/CramTestAdapters.fixture.ts'
import { getMappingQuality, hasPairOrientation } from '../shared/util.ts'
import Adapter from './BamAdapter.ts'
import configSchema from './configSchema.ts'

// the reference a fetch of MD-less reads compares against; the RPC path builds
// the adapter with it, so a bare construction has to hand it over the same way

function volvoxBam(name: string) {
  return bamAdapter(require.resolve(`../../../../test_data/volvox/${name}`))
}

function bamAdapter(bam: string) {
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
    volvoxReference,
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
// score, and the synteny hover asks every read for its `mate`. A name no getter
// answers used to build the whole serialized feature, decoding every tag and
// caching them on a record the chunk LRU keeps.
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

test.each([
  [
    'a wgsim tie',
    'volvox/wgsim_short_reads.bam',
    'ctgA',
    1876,
    'ctgAB_1877_2026_2:0:0_1:0:0_592',
  ],
  [
    'a bwa-meth dovetail',
    'wgbs/bwa-meth.sorted.subselect.downsample.bam',
    'chrREF',
    26705,
    'HISEQ:105:C2UE1ACXX:3:2203:2563:10879',
  ],
])('both mates of %s face FR', async (_, file, refName, start, name) => {
  const reads = await firstValueFrom(
    bamAdapter(require.resolve(`../../../../test_data/${file}`))
      .getFeatures({ assemblyName: 'test', refName, start, end: start + 10 })
      .pipe(toArray()),
  )
  expect(
    reads
      .filter(f => f.get('name') === name)
      .map(f => f.get('pair_orientation')),
  ).toEqual(['F2R1', 'F2R1'])
})
