import { toArray } from 'rxjs/operators'
import Adapter from './BamAdapter'

test('adapter can fetch features from volvox.bam', async () => {
  const adapter = new Adapter({
    bamLocation: {
      localPath: require.resolve('../../test_data/volvox-sorted.bam'),
    },
    index: {
      location: {
        localPath: require.resolve('../../test_data/volvox-sorted.bam.bai'),
      },
      indexType: 'BAI',
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

test('test usage of BamSlightlyLazyFeature toJSON (used in the drawer widget)', async () => {
  const adapter = new Adapter({
    bamLocation: {
      localPath: require.resolve('../../test_data/volvox-sorted.bam'),
    },
    index: {
      location: {
        localPath: require.resolve('../../test_data/volvox-sorted.bam.bai'),
      },
      indexType: 'BAI',
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
  expect(f.mismatches).not.toBeTruthy()
})

test('test usage of getMultiRegion stats, adapter can generate a domain', async () => {
  const adapter = new Adapter({
    bamLocation: {
      localPath: require.resolve('../../test_data/volvox-sorted.bam'),
    },
    index: {
      location: {
        localPath: require.resolve('../../test_data/volvox-sorted.bam.bai'),
      },
      indexType: 'BAI',
    },
  })

  const stats = await adapter.getMultiRegionStats({
    regions: {
      refName: 'ctgA',
      start: 0,
      end: 100,
      parentRegion: {
        refName: 'ctgA',
        start: 0,
        end: 10000,
      },
    },
    opts: {
      signal: {
        aborted: false,
        onabort: null,
      },
      bpPerPx: 0.2,
    },
    length: 100,
  })
  const statsArray = await stats.pipe(toArray()).toPromise()
  const s = statsArray[0].toJSON()
  expect(s.scoreMin).toBe(0)
  expect(s.scoreMax).toBeTruthy()
})
