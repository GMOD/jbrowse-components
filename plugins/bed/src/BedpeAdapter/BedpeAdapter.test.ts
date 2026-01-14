import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BedpeAdapter from './BedpeAdapter.ts'
import configSchema from './configSchema.ts'

function makeAdapter() {
  return new BedpeAdapter(
    configSchema.create({
      bedpeLocation: {
        localPath: require.resolve('./test_data/test.bedpe'),
        locationType: 'LocalPathLocation',
      },
    }),
  )
}
test('basic', async () => {
  const adapter = makeAdapter()

  const features = await firstValueFrom(
    adapter
      .getFeatures({
        assemblyName: 'volvox',
        refName: 'chr1',
        start: 0,
        end: 10000,
      })
      .pipe(toArray()),
  )

  expect(features).toHaveLength(3) // 2 primary features + 1 mate on chr1

  const firstFeature = features[0]!
  expect(firstFeature.get('refName')).toBe('chr1')
  expect(firstFeature.get('start')).toBe(1000)
  expect(firstFeature.get('end')).toBe(2000)
  expect(firstFeature.get('mate')).toEqual({
    refName: 'chr2',
    start: 3000,
    end: 4000,
    strand: -1,
  })
  expect(firstFeature.get('ALT')).toEqual(['<DUP>'])
})

test('gets correct reference sequence names', async () => {
  const adapter = makeAdapter()
  const refNames = await adapter.getRefNames()
  expect(refNames).toEqual(['chr1', 'chr2', 'chr3'])
})

test('parses header correctly', async () => {
  const adapter = makeAdapter()
  const header = await adapter.getHeader()
  expect(header).toBe('#header line 1\n#header line 2')
})

test('handles features with different strands correctly', async () => {
  const adapter = makeAdapter()
  const features = await firstValueFrom(
    adapter
      .getFeatures({
        assemblyName: 'volvox',
        refName: 'chr1',
        start: 4000,
        end: 7000,
      })
      .pipe(toArray()),
  )

  const feature = features.find(f => f.get('name') === 'SV2')
  expect(feature?.get('strand')).toBe(1) // +
  expect(feature?.get('mate').strand).toBe(1) // +
})

test('handles different SV types correctly', async () => {
  const adapter = makeAdapter()
  const features = await firstValueFrom(
    adapter
      .getFeatures({
        assemblyName: 'volvox',
        refName: 'chr2',
        start: 0,
        end: 3000,
      })
      .pipe(toArray()),
  )

  const feature = features.find(f => f.get('name') === 'SV3')
  expect(feature?.get('ALT')).toEqual(['<TRA>'])
  expect(feature?.get('score')).toBe(70)
})

test('returns empty array for non-existent reference', async () => {
  const adapter = makeAdapter()
  const features = await firstValueFrom(
    adapter
      .getFeatures({
        assemblyName: 'volvox',
        refName: 'chrX',
        start: 0,
        end: 1000,
      })
      .pipe(toArray()),
  )
  expect(features).toHaveLength(0)
})
