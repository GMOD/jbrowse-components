import { toArray } from 'rxjs/operators'
import Adapter from './BgzipFastaAdapter'

test('can use a indexed fasta with gzi', async () => {
  const adapter = new Adapter({
    fastaLocation: {
      localPath: require.resolve('../../test_data/volvox.fa.gz'),
    },
    faiLocation: {
      localPath: require.resolve('../../test_data/volvox.fa.gz.fai'),
    },
    gziLocation: {
      localPath: require.resolve('../../test_data/volvox.fa.gz.gzi'),
    },
  })

  const features = await adapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray).toMatchSnapshot()

  const features2 = await adapter.getFeatures({
    refName: 'ctgC',
    start: 0,
    end: 20000,
  })

  const featuresArray2 = await features2.pipe(toArray()).toPromise()
  expect(featuresArray2).toMatchSnapshot()
})
