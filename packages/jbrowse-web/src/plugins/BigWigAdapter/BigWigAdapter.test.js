import { toArray } from 'rxjs/operators'

import BigWigAdapter from './BigWigAdapter'

test('adapter can fetch features from volvox.bw', async () => {
  const adapter = new BigWigAdapter({
    assemblyName: 'volvox',
    bigWigLocation: { path: require.resolve('./test_data/volvox.bw') },
  })

  const features = adapter.getFeaturesInRegion({
    assembly: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featuresArray = await features.pipe(toArray()).toPromise()
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray.slice(1000, 1010)).toMatchSnapshot()
})
