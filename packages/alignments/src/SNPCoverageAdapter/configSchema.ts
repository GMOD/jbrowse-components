import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import PluginManager from '@gmod/jbrowse-core/PluginManager'

export default (pluginManager: PluginManager) =>
  ConfigurationSchema(
    'SNPCoverageAdapter',
    {
      subadapter: pluginManager.pluggableConfigSchemaType('adapter'),
    },
    { explicitlyTyped: true },
  )
