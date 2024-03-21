import { toArray } from 'rxjs/operators'
import Adapter from './BgzipFastaAdapter'
import configSchema from './configSchema'

test('can use a indexed fasta with gzi', async () => {
  const adapter = new Adapter(
    configSchema.create({
      faiLocation: {
        localPath: require.resolve('../../test_data/volvox.fa.gz.fai'),
        locationType: 'LocalPathLocation',
      },
      fastaLocation: {
        localPath: require.resolve('../../test_data/volvox.fa.gz'),
        locationType: 'LocalPathLocation',
      },
      gziLocation: {
        localPath: require.resolve('../../test_data/volvox.fa.gz.gzi'),
        locationType: 'LocalPathLocation',
      },
    }),
  )

  const features = adapter.getFeatures({
    end: 20000,
    refName: 'ctgA',
    start: 0,
  })

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray).toMatchSnapshot()

  const features2 = adapter.getFeatures({
    end: 20000,
    refName: 'ctgC',
    start: 0,
  })

  const featuresArray2 = await features2.pipe(toArray()).toPromise()
  expect(featuresArray2).toMatchSnapshot()
})
