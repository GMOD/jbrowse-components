import { map, toArray } from 'rxjs/operators'

import Adapter from './TwoBitAdapter'

test('adapter can fetch features from volvox.2bit', async () => {
  const adapter = new Adapter({
    assemblyName: 'volvox',
    bamLocation: { path: require.resolve('./test_data/volvox.2bit') },
  })

  const features = adapter.getSequence({
    assembly: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })
  console.log(features)

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray[0].get('seq_id')).toBe('ctgA')
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray.length).toEqual(3809)
  expect(featuresJsonArray.slice(1000, 1010)).toMatchSnapshot()

  expect(await adapter.refIdToName(0)).toBe('ctgA')
  expect(await adapter.refIdToName(1)).toBe(undefined)

  expect(
    await adapter.hasDataForRefSeq({ assembly: 'volvox', refName: 'ctgA' }),
  ).toBe(true)
})
