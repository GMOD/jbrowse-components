import { toArray } from 'rxjs/operators'
import Adapter from './SNPAdapter'
import SubadapterBam from '../BamAdapter/BamAdapter'

test('SNP adapter can fetch features from volvox.bam using bam subadapter', async () => {
  const adapter = new Adapter({
    subadapter: new SubadapterBam({
      bamLocation: {
        localPath: require.resolve('../../test_data/volvox-sorted.bam'),
      },
      index: {
        location: {
          localPath: require.resolve('../../test_data/volvox-sorted.bam.bai'),
        },
        indexType: 'BAI',
      },
    }),
  })

  const features = await adapter.getFeatures(
    {
      refName: 'ctgA',
      start: 0,
      end: 20000,
    },
    {
      signal: {
        aborted: false,
        onabort: null,
      },
      bpPerPx: 0.2,
    },
  )

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray[0].get('refName')).toBe('ctgA')
  expect(featuresArray[0].get('snpinfo')).toBeTruthy()

  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray.length).toEqual(20000)
  expect(featuresJsonArray.slice(1000, 1010)).toMatchSnapshot()

  expect(await adapter.refIdToName(0)).toBe('ctgA')
  expect(await adapter.refIdToName(1)).toBe(undefined)

  expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
})

test('test usage of BamSlightlyLazyFeature toJSON in a SNP adapter', async () => {
  const adapter = new Adapter({
    subadapter: new SubadapterBam({
      bamLocation: {
        localPath: require.resolve('../../test_data/volvox-sorted.bam'),
      },
      index: {
        location: {
          localPath: require.resolve('../../test_data/volvox-sorted.bam.bai'),
        },
        indexType: 'BAI',
      },
    }),
  })

  const features = await adapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 100,
  })
  const featuresArray = await features.pipe(toArray()).toPromise()
  const f = featuresArray[0].toJSON()

  expect(f.refName).toBe('ctgA')
  expect(f.start).toBe(0)
  expect(f.end).toBe(1)
  expect(f.snpinfo).toBeTruthy()
})

test('test usage of getMultiRegion stats, SNP adapter can generate a domain from BamFile', async () => {
  const adapter = new Adapter({
    subadapter: new SubadapterBam({
      bamLocation: {
        localPath: require.resolve('../../test_data/volvox-sorted.bam'),
      },
      index: {
        location: {
          localPath: require.resolve('../../test_data/volvox-sorted.bam.bai'),
        },
        indexType: 'BAI',
      },
    }),
  })

  const stats = await adapter.getMultiRegionStats(
    [
      {
        refName: 'ctgA',
        start: 0,
        end: 100,
      },
    ],
    {
      opts: {
        signal: {
          aborted: false,
          onabort: null,
        },
        bpPerPx: 0.2,
      },
    },
  )

  expect(Object.keys(stats).length).toEqual(9)
  expect(stats.scoreMin).toEqual(0)
  expect(stats.scoreMax).toEqual(13)
})
