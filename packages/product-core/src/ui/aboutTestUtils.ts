import PluginManager from '@jbrowse/core/PluginManager'
import {
  ConfigurationSchema,
  FormatAboutConfigSchemaFactory,
} from '@jbrowse/core/configuration'

import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

// a real PluginManager provides the jexl instance a callback slot evaluates with
export const aboutTestPluginManager = new PluginManager(
  [],
).createPluggableElements()
aboutTestPluginManager.configure()

// the slots the About dialog reads off a track config, without registering a
// track type to get them
export const TestTrackConf = ConfigurationSchema(
  'TestTrack',
  {
    name: { type: 'string', defaultValue: '' },
    assemblyNames: { type: 'stringArray', defaultValue: [] },
    adapter: ConfigurationSchema('TestAdapter', {
      type: { type: 'string', defaultValue: 'TestAdapter' },
      bamLocation: {
        type: 'fileLocation',
        defaultValue: { uri: '', locationType: 'UriLocation' },
      },
    }),
    metadata: { type: 'frozen', defaultValue: {} },
    formatAbout: FormatAboutConfigSchemaFactory(),
  },
  { explicitIdentifier: 'trackId' },
)

export function makeTrackConf(snapshot: SnapshotIn<typeof TestTrackConf>) {
  return TestTrackConf.create(snapshot, {
    pluginManager: aboutTestPluginManager,
  })
}
