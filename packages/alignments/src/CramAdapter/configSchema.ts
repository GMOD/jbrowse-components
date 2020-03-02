import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export default (pluginManager: PluginManager) => {
  const { types } = pluginManager.lib['mobx-state-tree']
  return ConfigurationSchema(
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
      sequenceAdapter: types.late(() =>
        pluginManager.pluggableConfigSchemaType('adapter'),
      ),
    },
    { explicitlyTyped: true },
  )
}
