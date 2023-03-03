import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'

export default function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema('Root', {
    rpc: RpcManager.configSchema,
    // possibly consider this for global config editor
    highResolutionScaling: {
      type: 'number',
      defaultValue: 2,
    },
    useUrlSession: {
      type: 'boolean',
      defaultValue: true,
    },
    useLocalStorage: {
      type: 'boolean',
      defaultValue: false,
    },
    featureDetails: ConfigurationSchema('FeatureDetails', {
      sequenceTypes: {
        type: 'stringArray',
        defaultValue: ['mRNA', 'transcript', 'gene'],
      },
    }),
    disableAnalytics: {
      type: 'boolean',
      defaultValue: false,
    },
    theme: { type: 'frozen', defaultValue: {} },
    logoPath: {
      type: 'fileLocation',
      defaultValue: { uri: '', locationType: 'UriLocation' },
    },
    ...pluginManager.pluginConfigurationSchemas(),
  })
}
