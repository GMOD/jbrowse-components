import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

export default (pluginManager: PluginManager) => {
  return types.late(() =>
    ConfigurationSchema(
      'CramAdapter',
      {
        fetchSizeLimit: {
          type: 'number',
          defaultValue: 5_000_000,
        },
        cramLocation: {
          type: 'fileLocation',
          defaultValue: {
            uri: '/path/to/my.cram',
            locationType: 'UriLocation',
          },
        },
        craiLocation: {
          type: 'fileLocation',
          defaultValue: {
            uri: '/path/to/my.cram.crai',
            locationType: 'UriLocation',
          },
        },
        sequenceAdapter: pluginManager.pluggableConfigSchemaType('adapter'),
      },
      { explicitlyTyped: true },
    ),
  )
}
