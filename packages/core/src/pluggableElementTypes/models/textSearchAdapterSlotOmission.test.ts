import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../../PluginManager.ts'
import {
  ConfigurationSchema,
  readConfObject,
} from '../../configuration/index.ts'
import TextSearchAdapterType from '../TextSearchAdapterType.ts'
import TrackType from '../TrackType.ts'
import { createBaseTrackConfig } from './index.ts'

// Registration order mirrors products/jbrowse-desktop/src/corePlugins.ts:
// LegacyJBrowsePlugin (JBrowse1TextSearchAdapter) registers before TrixPlugin.
function trackConfigSchema() {
  const pluginManager = new PluginManager()
  const adapterDefaults: [string, string][] = [
    ['JBrowse1TextSearchAdapter', '/volvox/names'],
    ['TrixTextSearchAdapter', ''],
  ]
  for (const [name, uriDefault] of adapterDefaults) {
    pluginManager.addTextSearchAdapterType(
      () =>
        new TextSearchAdapterType({
          name,
          configSchema: ConfigurationSchema(
            name,
            {
              uri: { type: 'string', defaultValue: uriDefault },
              assemblyNames: { type: 'stringArray', defaultValue: [] },
            },
            { explicitlyTyped: true },
          ),
          getAdapterClass: () => Promise.reject(new Error('not instantiated')),
        }),
    )
  }
  pluginManager.addTrackType(() => {
    const configSchema = ConfigurationSchema(
      'FeatureTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'FeatureTrack',
      configSchema,
      stateModel: types.model('FeatureTrack', {}),
    })
  })
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return pluginManager.getTrackType('FeatureTrack').configSchema
}

test('a track with no textSearching configured reads textSearchAdapter as undefined', () => {
  const conf = trackConfigSchema().create({
    trackId: 'no-index',
    type: 'FeatureTrack',
  })
  const adapter = readConfObject(conf, ['textSearching', 'textSearchAdapter'])
  expect(adapter).toBeUndefined()
})

test('a track with a declared textSearchAdapter keeps it intact', () => {
  const conf = trackConfigSchema().create({
    trackId: 'has-index',
    type: 'FeatureTrack',
    textSearching: {
      textSearchAdapter: { type: 'TrixTextSearchAdapter', uri: 'genes.ix' },
    },
  })
  const adapter = readConfObject(conf, ['textSearching', 'textSearchAdapter'])
  expect(adapter).toMatchObject({
    type: 'TrixTextSearchAdapter',
    uri: 'genes.ix',
  })
})

test("v1.3's track-level text search keys move into textSearching", () => {
  const v13Adapter = 'textSearchAdapter'
  const v13Attributes = 'textSearchIndexingAttributes'
  const conf = trackConfigSchema().create({
    trackId: 'v13',
    type: 'FeatureTrack',
    [v13Adapter]: { type: 'TrixTextSearchAdapter', uri: 'genes.ix' },
    [v13Attributes]: ['Name', 'ID'],
  })
  expect(
    readConfObject(conf, ['textSearching', 'textSearchAdapter']),
  ).toMatchObject({ type: 'TrixTextSearchAdapter', uri: 'genes.ix' })
  expect(readConfObject(conf, ['textSearching', 'indexingAttributes'])).toEqual(
    ['Name', 'ID'],
  )
})
