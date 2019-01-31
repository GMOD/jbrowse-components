import { toArray } from 'rxjs/operators'

import BigWigAdapter from './BigWigAdapter'

test('adapter can fetch features from volvox.bw', async () => {
  const adapter = new BigWigAdapter({
    assemblyName: 'volvox',
    bigWigLocation: { path: require.resolve('./test_data/volvox.bw') },
  })

  const features = adapter.regularizeAndGetFeaturesInRegion({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })
  expect(await adapter.refIdToName(0)).toBe('ctgA')
  expect(await adapter.refIdToName(1)).toBe(undefined)
  expect(
    await adapter.hasDataForRefSeq({ assemblyName: 'volvox', refName: 'ctgA' }),
  ).toBe(true)
  expect(
    await adapter.hasDataForRefSeq({ assemblyName: 'volvox', refName: 'ctgB' }),
  ).toBe(false)
  expect(
    await adapter.hasDataForRefSeq({
      assemblyName: 'nonexist',
      refName: 'ctgA',
    }),
  ).toBe(false)

  const featuresArray = await features.pipe(toArray()).toPromise()
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray.slice(1000, 1010)).toMatchSnapshot()
})
