import { count } from 'rxjs/operators'

import Adapter from './BamAdapter'

test('adapter can fetch features from volvox.bam', async () => {
  const adapter = new Adapter({
    bamLocation: { path: require.resolve('./test_data/volvox-sorted.bam') },
    indexLocation: {
      path: require.resolve('./test_data/volvox-sorted.bam.bai'),
    },
    indexType: 'BAI',
  })

  const features = adapter.getFeaturesInRegion({
    assembly: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 10000,
  })

  const numFeatures = await features.pipe(count()).toPromise()

  expect(numFeatures).toEqual(1860)
})
