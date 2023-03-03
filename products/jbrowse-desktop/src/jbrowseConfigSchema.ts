import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'

/**
 * #config JBrowseDesktopGlobalConfiguration
 * configuration here appears as a "configuration" object on the root of
 * config.json
 */
export default function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema('Root', {
    /**
     * #slot
     */
    rpc: RpcManager.configSchema,
    /**
     * #slot
     */
    highResolutionScaling: {
      type: 'number',
      defaultValue: 2,
    },
    featureDetails: ConfigurationSchema('FeatureDetails', {
      /**
       * #slot featureDetails.sequenceTypes
       */
      sequenceTypes: {
        type: 'stringArray',
        defaultValue: ['mRNA', 'transcript', 'gene'],
      },
    }),
    /**
     * #slot
     */
    disableAnalytics: {
      type: 'boolean',
      defaultValue: false,
    },
    /**
     * #slot
     */
    theme: {
      type: 'frozen',
      defaultValue: {},
    },
    /**
     * #slot
     */
    extraThemes: {
      type: 'frozen',
      defaultValue: {},
    },
    /**
     * #slot
     */
    logoPath: {
      type: 'fileLocation',
      defaultValue: { uri: '', locationType: 'UriLocation' },
    },
    ...pluginManager.pluginConfigurationSchemas(),
  })
}
