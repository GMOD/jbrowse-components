import { toArray } from 'rxjs/operators'

import Adapter from './IndexedFastaAdapter'

test('adapter can fetch sequence from volvox.fa', async () => {
  const adapter = new Adapter({
    assemblyName: 'volvox',
    fastaLocation: { path: require.resolve('./test_data/volvox.fa') },
    index: { location: { path: require.resolve('./test_data/volvox.fa.fai') } },
  })

  const features = adapter.getFeaturesInRegion({
    assembly: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray).toMatchSnapshot()
})
