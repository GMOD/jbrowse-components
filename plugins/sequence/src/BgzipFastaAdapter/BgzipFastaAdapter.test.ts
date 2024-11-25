import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import Adapter from './BgzipFastaAdapter'
import configSchema from './configSchema'

test('can use a indexed fasta with gzi', async () => {
  const adapter = new Adapter(
    configSchema.create({
      fastaLocation: {
        localPath: require.resolve('../../test_data/volvox.fa.gz'),
        locationType: 'LocalPathLocation',
      },
      faiLocation: {
        localPath: require.resolve('../../test_data/volvox.fa.gz.fai'),
        locationType: 'LocalPathLocation',
      },
      gziLocation: {
        localPath: require.resolve('../../test_data/volvox.fa.gz.gzi'),
        locationType: 'LocalPathLocation',
      },
    }),
  )

  const features = adapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featuresArray = await firstValueFrom(features.pipe(toArray()))
  expect(featuresArray).toMatchSnapshot()

  const features2 = adapter.getFeatures({
    refName: 'ctgC',
    start: 0,
    end: 20000,
  })

  const featuresArray2 = await firstValueFrom(features2.pipe(toArray()))
  expect(featuresArray2).toMatchSnapshot()
})
