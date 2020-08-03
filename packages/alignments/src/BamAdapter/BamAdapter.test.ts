import { toArray } from 'rxjs/operators'
import Adapter from './BamAdapter'
import configSchema from './configSchema'

test('adapter can fetch features from volvox.bam', async () => {
  const adapter = new Adapter(
    configSchema.create({
      bamLocation: {
        localPath: require.resolve('../../test_data/volvox-sorted.bam'),
      },
      index: {
        location: {
          localPath: require.resolve('../../test_data/volvox-sorted.bam.bai'),
        },
      },
    }),
  )

  const features = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray[0].get('refName')).toBe('ctgA')
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray.length).toEqual(3809)
  expect(featuresJsonArray.slice(1000, 1010)).toMatchSnapshot()

  expect(adapter.refIdToName(0)).toBe('ctgA')
  expect(adapter.refIdToName(1)).toBe(undefined)

  expect(await adapter.hasDataForRefName('ctgA')).toBe(true)

  const adapterCSI = new Adapter(
    configSchema.create({
      bamLocation: {
        localPath: require.resolve('../../test_data/volvox-sorted.bam'),
      },
      index: {
        indexType: 'CSI',
        location: {
          localPath: require.resolve('../../test_data/volvox-sorted.bam.csi'),
        },
      },
    }),
  )

  const featuresCSI = adapterCSI.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })
  const featuresArrayCSI = await featuresCSI.pipe(toArray()).toPromise()
  const featuresJsonArrayCSI = featuresArrayCSI.map(f => f.toJSON())
  expect(featuresJsonArrayCSI).toEqual(featuresJsonArray)
})

test('test usage of BamSlightlyLazyFeature toJSON (used in the widget)', async () => {
  const adapter = new Adapter(
    configSchema.create({
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
  )

  const features = adapter.getFeatures({
    assemblyName: 'volvox',
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

test('test usage of BamSlightlyLazyFeature for extended CIGAR', async () => {
  const adapter = new Adapter(
    configSchema.create({
      bamLocation: {
        localPath: require.resolve('../../test_data/extended_cigar.bam'),
      },
      index: {
        location: {
          localPath: require.resolve('../../test_data/extended_cigar.bam.bai'),
        },
        indexType: 'BAI',
      },
    }),
  )

  const features = adapter.getFeatures({
    assemblyName: 'hg19',
    refName: '1',
    start: 13260,
    end: 13340,
  })
  const featuresArray = await features.pipe(toArray()).toPromise()
  const f = featuresArray[0]
  expect(f.get('mismatches')).toMatchSnapshot()
})
