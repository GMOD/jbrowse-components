import { toArray } from 'rxjs/operators'
import BigBedAdapter from './BigBedAdapter'
import configSchema from './configSchema'
import PluginManager from '@jbrowse/core/PluginManager'

const pluginManager = new PluginManager()

test('adapter can fetch features from volvox.bb', async () => {
  const adapter = new BigBedAdapter(
    configSchema.create({
      bigBedLocation: {
        localPath: require.resolve('./test_data/volvox.bb'),
        locationType: 'LocalPathLocation',
      },
    }),
    pluginManager,
  )

  const features = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })
  expect(await adapter.refIdToName(0)).toBe('ctgA')
  expect(await adapter.refIdToName(1)).toBe(undefined)
  expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
  expect(await adapter.hasDataForRefName('ctgB')).toBe(false)

  const featuresArray = await features.pipe(toArray()).toPromise()
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray).toMatchSnapshot()
})
