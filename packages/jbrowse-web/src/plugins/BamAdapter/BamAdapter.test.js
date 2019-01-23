import { toArray } from 'rxjs/operators'

import Adapter from './BamAdapter'

test('adapter can fetch features from volvox.bam', async () => {
  const adapter = new Adapter({
    assemblyName: 'volvox',
    bamLocation: { path: require.resolve('./test_data/volvox-sorted.bam') },
    index: {
      location: {
        path: require.resolve('./test_data/volvox-sorted.bam.bai'),
      },
      indexType: 'BAI',
    },
  })

  const features = adapter.getFeaturesInRegion({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray[0].get('seq_id')).toBe('ctgA')
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray.length).toEqual(3809)
  expect(featuresJsonArray.slice(1000, 1010)).toMatchSnapshot()

  expect(await adapter.refIdToName(0)).toBe('ctgA')
  expect(await adapter.refIdToName(1)).toBe(undefined)

  expect(
    await adapter.hasDataForRefSeq({ assemblyName: 'volvox', refName: 'ctgA' }),
  ).toBe(true)
})
