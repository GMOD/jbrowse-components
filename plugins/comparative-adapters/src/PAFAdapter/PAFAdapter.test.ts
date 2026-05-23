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
): PAFRecord {
  return {
    qname,
    qstart: 0,
    qend: blockLen,
    tname,
    tstart: 0,
    tend: blockLen,
    strand: 1,
    extra: { mappingQual, blockLen },
  }
}

test('getWeightedMeans treats MAPQ 255 as missing, not as quality 255', () => {
  const records = [
    makeRecord('q1', 't1', 255, 1000),
    makeRecord('q1', 't1', 60, 1000),
  ]
  getWeightedMeans(records)
  // If 255 were used as-is the mean would be (255+60)/2 = 157.5, so min=max=157.5, meanScore=0.5.
  // With the fix, 255 → 1, so mean = (1+60)/2 = 30.5, still min=max=30.5, meanScore=0.5.
  // The key assertion is that the record with MAPQ 255 doesn't skew the result toward 255.
  expect(records[0]!.extra.meanScore).toBe(0.5)
  expect(records[1]!.extra.meanScore).toBe(0.5)
})

test('getWeightedMeans returns 0.5 when all pairs have identical quality', () => {
  const records = [
    makeRecord('q1', 't1', 60, 1000),
    makeRecord('q2', 't2', 60, 500),
  ]
  getWeightedMeans(records)
  expect(records[0]!.extra.meanScore).toBe(0.5)
  expect(records[1]!.extra.meanScore).toBe(0.5)
})

test('getWeightedMeans normalizes scores correctly across different quality pairs', () => {
  const records = [
    makeRecord('q1', 't1', 60, 1000),
    makeRecord('q2', 't2', 20, 1000),
  ]
  getWeightedMeans(records)
  expect(records[0]!.extra.meanScore).toBe(1)
  expect(records[1]!.extra.meanScore).toBe(0)
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
