import { toArray } from 'rxjs/operators'

import BigBedAdapter from './BigBedAdapter'

test('adapter can fetch features from volvox.bb', async () => {
  const adapter = new BigBedAdapter(
    {
      assemblyName: 'volvox',
      bigBedLocation: { localPath: require.resolve('./test_data/volvox.bb') },
    },
    {},
  )

  const features = await adapter.getFeatures({
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
  expect(featuresJsonArray.slice(0, 5000)).toMatchSnapshot()
})
