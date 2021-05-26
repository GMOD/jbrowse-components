import { toArray } from 'rxjs/operators'
import { LocalFile } from 'generic-filehandle'
import PluginManager from '@jbrowse/core/PluginManager'
import { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import Adapter from './CramAdapter'
import { SequenceAdapter } from './CramTestAdapters'
import configSchemaF from './configSchema'

const pluginManager = new PluginManager()
const configSchema = pluginManager.load(configSchemaF)

const getVolvoxSequenceSubAdapter: getSubAdapterType = async () => {
  return {
    dataAdapter: new SequenceAdapter(
      new LocalFile(require.resolve('../../test_data/volvox.fa')),
    ),
    sessionIds: new Set(),
  }
}

test('adapter can fetch features from volvox-sorted.cram', async () => {
  const adapter = new Adapter(
    configSchema.create({
      cramLocation: {
        localPath: require.resolve('../../test_data/volvox-sorted.cram'),
      },
      craiLocation: {
        localPath: require.resolve('../../test_data/volvox-sorted.cram.crai'),
      },
    }),
    getVolvoxSequenceSubAdapter,
  )

  const features = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  })

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray[0].get('refName')).toBe('ctgA')
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray.length).toEqual(3809)
  expect(featuresJsonArray.slice(1000, 1010)).toMatchSnapshot()

  expect(adapter.refIdToName(0)).toBe('ctgA')
  expect(adapter.refIdToName(1)).toBe(undefined)

  expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
})

test('test usage of cramSlightlyLazyFeature toJSON (used in the widget)', async () => {
  const adapter = new Adapter(
    configSchema.create({
      cramLocation: {
        localPath: require.resolve('../../test_data/volvox-sorted.cram'),
      },
      craiLocation: {
        localPath: require.resolve('../../test_data/volvox-sorted.cram.crai'),
      },
    }),
    getVolvoxSequenceSubAdapter,
  )

  const features = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 100,
  })
  const featuresArray = await features.pipe(toArray()).toPromise()
  const f = featuresArray[0].toJSON()
  expect(f.refName).toBe('ctgA')
  expect(f.start).toBe(2)
  expect(f.end).toBe(102)
  // don't pass the mismatches to the frontend
  expect(f.mismatches).toEqual(undefined)
})
