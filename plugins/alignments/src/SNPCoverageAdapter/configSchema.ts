import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'

/**
 * !config
 */
const SNPCoverageAdapter = (pluginManager: PluginManager) =>
  ConfigurationSchema(
    'SNPCoverageAdapter',
    {
      /**
       * !slot
       * normally refers to a BAM or CRAM adapter
       */
      subadapter: pluginManager.pluggableConfigSchemaType('adapter'),
    },
    { explicitlyTyped: true },
  )

export default SNPCoverageAdapter
