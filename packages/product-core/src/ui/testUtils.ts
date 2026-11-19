import PluginManager from '@jbrowse/core/PluginManager'
import {
  ConfigurationSchema,
  FormatAboutConfigSchemaFactory,
} from '@jbrowse/core/configuration'
import {
  AdapterType,
  TrackType,
  createBaseTrackConfig,
  preprocessTrackConfigSnapshot,
} from '@jbrowse/core/pluggableElementTypes'
import { types } from '@jbrowse/mobx-state-tree'

import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

function testTrackConfigSchema(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'TestTrack',
    {
      textSearching: ConfigurationSchema('TestTextSearching', {
        searchLabel: { type: 'string', defaultValue: '' },
        indexingAttributes: {
          type: 'stringArray',
          defaultValue: [],
          advanced: true,
        },
      }),
    },
    {
      baseConfiguration: createBaseTrackConfig(pluginManager),
      explicitIdentifier: 'trackId',
      explicitlyTyped: true,
    },
  )
}

// the real ReferenceSequenceTrack's slots, which declare no `assemblyNames`
function referenceSequenceTrackConfigSchema(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'ReferenceSequenceTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      displays: types.array(pluginManager.pluggableConfigSchemaType('display')),
      name: { type: 'string', defaultValue: '' },
      description: { type: 'string', defaultValue: '' },
      metadata: { type: 'frozen', defaultValue: {} },
      formatAbout: FormatAboutConfigSchemaFactory(),
    },
    {
      preProcessSnapshot: s => preprocessTrackConfigSnapshot(pluginManager, s),
      explicitIdentifier: 'trackId',
      explicitlyTyped: true,
    },
  )
}

// a real PluginManager provides the jexl instance a callback slot evaluates with
export const aboutTestPluginManager = new PluginManager([])
aboutTestPluginManager.addAdapterType(
  () =>
    new AdapterType({
      name: 'TestAdapter',
      configSchema: ConfigurationSchema(
        'TestAdapter',
        {
          bamLocation: {
            type: 'fileLocation',
            defaultValue: { uri: '', locationType: 'UriLocation' },
          },
          baiLocation: {
            type: 'fileLocation',
            defaultValue: { uri: '', locationType: 'UriLocation' },
            advanced: true,
          },
        },
        { explicitlyTyped: true },
      ),
      getAdapterClass: () =>
        Promise.reject(new Error('no adapter is instantiated in these tests')),
    }),
)
for (const [name, configSchema] of [
  ['TestTrack', testTrackConfigSchema],
  ['ReferenceSequenceTrack', referenceSequenceTrackConfigSchema],
] as const) {
  aboutTestPluginManager.addTrackType(
    pluginManager =>
      new TrackType({
        name,
        configSchema: configSchema(pluginManager),
        stateModel: types.model(name, {}),
      }),
  )
}
aboutTestPluginManager.createPluggableElements()
aboutTestPluginManager.configure()

export const TestTrackConf = testTrackConfigSchema(aboutTestPluginManager)

export const ReferenceSequenceTrackConf = referenceSequenceTrackConfigSchema(
  aboutTestPluginManager,
)

export function makeTrackConf(snapshot: SnapshotIn<typeof TestTrackConf>) {
  return TestTrackConf.create(
    { type: 'TestTrack', ...snapshot },
    { pluginManager: aboutTestPluginManager },
  )
}
