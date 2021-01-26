import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default (pluginManager: PluginManager) => {
  return ConfigurationSchema(
    'GCContentAdapter',
    {
      sequenceAdapter: pluginManager.pluggableConfigSchemaType('adapter'),
    },
    { explicitlyTyped: true },
  )
}
