import { toArray } from 'rxjs/operators'
import Adapter from './BgzipFastaAdapter'
import configSchema from './configSchema'
import PluginManager from '@jbrowse/core/PluginManager'

const pluginManager = new PluginManager()

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
    pluginManager,
  )

  const features = adapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray).toMatchSnapshot()

  const features2 = adapter.getFeatures({
    refName: 'ctgC',
    start: 0,
    end: 20000,
  })

  const featuresArray2 = await features2.pipe(toArray()).toPromise()
  expect(featuresArray2).toMatchSnapshot()
})
