import { toArray } from 'rxjs/operators'
import Adapter from './CramAdapter'

test('adapter can fetch features from volvox-sorted.cram', async () => {
  const adapter = new Adapter({
    cramLocation: {
      localPath: require.resolve('../../test_data/volvox-sorted.cram'),
    },
    craiLocation: {
      localPath: require.resolve('../../test_data/volvox-sorted.cram.crai'),
    },
  })

  const features = await adapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray[0].get('refName')).toBe('ctgA')
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray.length).toEqual(3809)
  expect(featuresJsonArray.slice(1000, 1010)).toMatchSnapshot()

  expect(await adapter.refIdToName(0)).toBe('ctgA')
  expect(await adapter.refIdToName(1)).toBe(undefined)

  expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
})

test('test usage of cramSlightlyLazyFeature toJSON (used in the drawer widget)', async () => {
  const adapter = new Adapter({
    cramLocation: {
      localPath: require.resolve('../../test_data/volvox-sorted.cram'),
    },
    craiLocation: {
      localPath: require.resolve('../../test_data/volvox-sorted.cram.crai'),
    },
  })

  const features = await adapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 100,
  })
  const featuresArray = await features.pipe(toArray()).toPromise()
  const f = featuresArray[0].toJSON()
  expect(f.refName).toBe('ctgA')
  expect(f.start).toBe(2)
  expect(f.end).toBe(102)
  // don't pass the mismatches to the frontend
  expect(f.mismatches).toEqual(undefined)
})
