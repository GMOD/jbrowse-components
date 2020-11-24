import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default (pluginManager: PluginManager) => {
  const { types } = pluginManager.lib['mobx-state-tree']
  return types.late(() =>
    ConfigurationSchema(
      'CramAdapter',
      {
        cramLocation: {
          type: 'fileLocation',
          defaultValue: { uri: '/path/to/my.cram' },
        },
        craiLocation: {
          type: 'fileLocation',
          defaultValue: { uri: '/path/to/my.cram.crai' },
        },
        sequenceAdapter: pluginManager.pluggableConfigSchemaType('adapter'),
      },
      { explicitlyTyped: true },
    ),
  )
}
