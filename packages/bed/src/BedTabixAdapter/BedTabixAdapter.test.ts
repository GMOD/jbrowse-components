import { toArray } from 'rxjs/operators'
import BedTabixAdapter from './BedTabixAdapter'

test('adapter can fetch features from volvox-bed12.bed.gz', async () => {
  const adapter = new BedTabixAdapter({
    bedGzLocation: {
      localPath: require.resolve('./test_data/volvox-bed12.bed.gz'),
    },
    index: {
      location: {
        localPath: require.resolve('./test_data/volvox-bed12.bed.gz.tbi'),
      },
    },
  })

  const features = await adapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 20000,
    assemblyName: 'volvox',
  })
  expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
  expect(await adapter.hasDataForRefName('ctgB')).toBe(false)

  const featuresArray = await features.pipe(toArray()).toPromise()
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray).toMatchSnapshot()
})

test('adapter can fetch features from volvox.sort.bed.gz simple bed3', async () => {
  const adapter = new BedTabixAdapter({
    bedGzLocation: {
      localPath: require.resolve('./test_data/volvox.sort.bed.gz'),
    },
    index: {
      location: {
        localPath: require.resolve('./test_data/volvox.sort.bed.gz.tbi'),
      },
    },
  })

  const features = await adapter.getFeatures({
    refName: 'contigA',
    start: 0,
    end: 20000,
    assemblyName: 'volvox',
  })
  expect(await adapter.hasDataForRefName('contigA')).toBe(true)
  expect(await adapter.hasDataForRefName('ctgB')).toBe(false)

  const featuresArray = await features.pipe(toArray()).toPromise()
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray).toMatchSnapshot()
})
