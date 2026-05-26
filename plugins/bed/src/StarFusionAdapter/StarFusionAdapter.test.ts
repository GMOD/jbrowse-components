import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import StarFusionAdapter from './StarFusionAdapter.ts'
import configSchema from './configSchema.ts'

function makeAdapter() {
  return new StarFusionAdapter(
    configSchema.create({
      starFusionLocation: {
        localPath: require.resolve('./test_data/test.star-fusion.tsv'),
        locationType: 'LocalPathLocation',
      },
    }),
  )
}

test('returns correct ref names', async () => {
  const adapter = makeAdapter()
  const refNames = await adapter.getRefNames()
  expect(new Set(refNames)).toEqual(new Set(['chr1', 'chr2', 'chr3']))
})

test('returns features on left-breakpoint ref', async () => {
  const adapter = makeAdapter()
  const features = await firstValueFrom(
    adapter
      .getFeatures({
        assemblyName: 'test',
        refName: 'chr1',
        start: 0,
        end: 10000,
      })
      .pipe(toArray()),
  )

  // chr1 has: GENE1--GENE2 (left, pos 1000), GENE3--GENE4 (left, pos 2000),
  //           GENE5--GENE6 (right/flip, pos 7000)
  expect(features).toHaveLength(3)
})

test('primary feature has correct coords and mate', async () => {
  const adapter = makeAdapter()
  const features = await firstValueFrom(
    adapter
      .getFeatures({
        assemblyName: 'test',
        refName: 'chr1',
        start: 0,
        end: 1500,
      })
      .pipe(toArray()),
  )

  const feat = features.find(f => f.get('name') === 'GENE1--GENE2')!
  expect(feat).toBeDefined()
  expect(feat.get('refName')).toBe('chr1')
  expect(feat.get('start')).toBe(1000)
  expect(feat.get('strand')).toBe(1)
  expect(feat.get('mate')).toEqual({
    refName: 'chr2',
    start: 5000,
    end: 5001,
    strand: -1,
  })
})

test('flipped mate feature has correct coords', async () => {
  const adapter = makeAdapter()
  const features = await firstValueFrom(
    adapter
      .getFeatures({
        assemblyName: 'test',
        refName: 'chr2',
        start: 0,
        end: 10000,
      })
      .pipe(toArray()),
  )

  // chr2 appears as: GENE1--GENE2 right-side (flipped), GENE5--GENE6 left-side
  expect(features).toHaveLength(2)

  const flipped = features.find(f => f.get('name') === 'GENE1--GENE2')!
  expect(flipped).toBeDefined()
  expect(flipped.get('refName')).toBe('chr2')
  expect(flipped.get('start')).toBe(5000)
  expect(flipped.get('mate')).toMatchObject({ refName: 'chr1' })
})

test('returns empty array for unknown ref', async () => {
  const adapter = makeAdapter()
  const features = await firstValueFrom(
    adapter
      .getFeatures({
        assemblyName: 'test',
        refName: 'chrX',
        start: 0,
        end: 999999,
      })
      .pipe(toArray()),
  )
  expect(features).toHaveLength(0)
})

test('includes extra columns on feature', async () => {
  const adapter = makeAdapter()
  const features = await firstValueFrom(
    adapter
      .getFeatures({
        assemblyName: 'test',
        refName: 'chr1',
        start: 0,
        end: 1500,
      })
      .pipe(toArray()),
  )

  const feat = features.find(f => f.get('name') === 'GENE1--GENE2')!
  expect(feat.get('JunctionReadCount')).toBe('10')
  expect(feat.get('SpliceType')).toBe('ONLY_REF_SPLICE')
})
