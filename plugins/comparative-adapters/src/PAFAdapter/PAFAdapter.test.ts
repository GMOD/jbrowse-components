import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './PAFAdapter.ts'
import MyConfigSchema from './configSchema.ts'
import { getWeightedMeans } from './util.ts'

import type { PAFRecord } from './util.ts'

function makeRecord(
  qname: string,
  tname: string,
  mappingQual: number | undefined,
  blockLen: number,
  numMatches?: number,
): PAFRecord {
  return {
    qname,
    qstart: 0,
    qend: blockLen,
    tname,
    tstart: 0,
    tend: blockLen,
    strand: 1,
    extra: { mappingQual, blockLen, numMatches },
  }
}

test('getWeightedMeans computes a true length-weighted mean identity per pair', () => {
  // Two alignments in the same pair: 90% identity over 1000bp and 50% over
  // 1000bp → length-weighted mean = (0.9*1000 + 0.5*1000)/2000 = 0.7.
  const records = [
    makeRecord('q1', 't1', 60, 1000, 900),
    makeRecord('q1', 't1', 60, 1000, 500),
  ]
  getWeightedMeans(records)
  expect(records[0]!.extra.meanIdentity).toBeCloseTo(0.7)
  expect(records[1]!.extra.meanIdentity).toBeCloseTo(0.7)
})

function makeAdapter() {
  return new Adapter(
    MyConfigSchema.create({
      pafLocation: {
        localPath: require.resolve('./test_data/peach_grape.paf'),
        locationType: 'LocalPathLocation',
      },
      assemblyNames: ['peach', 'grape'],
    }),
  )
}

test('adapter can fetch features from peach_grape.paf', async () => {
  const adapter = makeAdapter()

  const features1 = adapter.getFeatures({
    refName: 'Pp01',
    start: 0,
    end: 200000,
    assemblyName: 'peach',
  })

  const features2 = adapter.getFeatures({
    refName: 'chr1',
    start: 0,
    end: 200000,
    assemblyName: 'grape',
  })

  const fa1 = await firstValueFrom(features1.pipe(toArray()))
  const fa2 = await firstValueFrom(features2.pipe(toArray()))
  expect(fa1.length).toBe(11)
  expect(fa2.length).toBe(5)
  expect(fa1[0]!.get('refName')).toBe('Pp01')
  expect(fa2[0]!.get('refName')).toBe('chr1')
})

test('getFeatures returns nothing for an unknown assembly even when its refName collides with a target name', async () => {
  const adapter = makeAdapter()
  // 'chr1' is a grape (target) refName; an unknown assembly must not borrow
  // target-side features just because the refName happens to match.
  const features = adapter.getFeatures({
    refName: 'chr1',
    start: 0,
    end: 200000,
    assemblyName: 'unknown',
  })
  const fa = await firstValueFrom(features.pipe(toArray()))
  expect(fa.length).toBe(0)
})

test('getRefNames returns query ref names for query assembly', async () => {
  const adapter = makeAdapter()
  const refNames = await adapter.getRefNames({
    assemblyName: 'peach',
  })
  expect(refNames).toContain('Pp01')
})

test('getRefNames returns target ref names for target assembly', async () => {
  const adapter = makeAdapter()
  const refNames = await adapter.getRefNames({
    assemblyName: 'grape',
  })
  expect(refNames).toContain('chr1')
})

test('getRefNames returns empty for unknown assembly', async () => {
  const adapter = makeAdapter()
  const refNames = await adapter.getRefNames({
    assemblyName: 'unknown',
  })
  expect(refNames).toEqual([])
})

test('getRefNames returns empty when no regions provided', async () => {
  const adapter = makeAdapter()
  const refNames = await adapter.getRefNames({})
  expect(refNames).toEqual([])
})
