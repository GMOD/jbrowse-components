import { map, toArray } from 'rxjs/operators'

import Adapter from './BamAdapter'

test('adapter can fetch features from volvox.bam', async () => {
  const adapter = new Adapter({
    bamLocation: { path: require.resolve('./test_data/volvox-sorted.bam') },
    index: {
      location: {
        path: require.resolve('./test_data/volvox-sorted.bam.bai'),
      },
      indexType: 'BAI',
    },
  })

  const features = adapter.getFeaturesInRegion({
    assembly: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featuresJsonArray = await features
    .pipe(
      map(f => f.toJSON()),
      toArray(),
    )
    .toPromise()
  expect(featuresJsonArray.length).toEqual(3809)
  expect(featuresJsonArray.slice(1000, 1010)).toMatchSnapshot()
})
