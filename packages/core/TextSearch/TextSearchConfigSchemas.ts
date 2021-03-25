import { SnapshotIn } from 'mobx-state-tree'
import { ConfigurationSchema } from '../configuration'
import PluginManager from '../PluginManager'

export default (pluginManager: PluginManager) => {
  const TextSearchAdapterConfigSchema = ConfigurationSchema(
    'TextSearchAdapter',
    {
      tracks: {
        type: 'stringArray',
        defaultValue: [],
        description: 'List of tracks covered by text search adapter',
      },
      assemblies: {
        type: 'stringArray',
        defaultValue: [],
        description: 'List of assemblies covered by text search adapter',
      },
    },
    { explicitIdentifier: 'name' },
  )

  function dispatcher(
    snapshot: SnapshotIn<typeof TextSearchAdapterConfigSchema>,
  ) {}

  return {
    TextSearchAdapterConfigSchemas: [TextSearchAdapterConfigSchema],
    dispatcher,
  }
}
