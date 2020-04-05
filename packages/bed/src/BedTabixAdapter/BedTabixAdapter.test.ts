import { toArray } from 'rxjs/operators'
import BedTabixAdapter from './BedTabixAdapter'

test('adapter can fetch features from volvox.bb', async () => {
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
  })
  expect(await adapter.refIdToName(0)).toBe('ctgA')
  expect(await adapter.refIdToName(1)).toBe(undefined)
  expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
  expect(await adapter.hasDataForRefName('ctgB')).toBe(false)

  const featuresArray = await features.pipe(toArray()).toPromise()
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray).toMatchSnapshot()
})
