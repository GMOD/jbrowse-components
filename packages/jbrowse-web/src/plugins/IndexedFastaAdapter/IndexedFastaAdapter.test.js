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

  const features2 = adapter.getFeaturesInRegion({
    assembly: 'volvox',
    refName: 'ctgC',
    start: 0,
    end: 20000,
  })

  const featuresArray2 = await features2.pipe(toArray()).toPromise()
  expect(featuresArray2).toMatchSnapshot()
})
