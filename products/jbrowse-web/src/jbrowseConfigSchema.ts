import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'

/**
 * #config JBrowseWebConfiguration
 * configuration here appears as a "configuration" object on the root of
 * config.json e.g. {configuration:{...this stuff here}}
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
    /**
     * #slot
     */
    shareURL: {
      type: 'string',
      defaultValue: 'https://share.jbrowse.org/api/v1/',
    },

    featureDetails: ConfigurationSchema('FeatureDetails', {
      /**
       * #slot featureDetails.sequenceTypes
       */
      sequenceTypes: {
        type: 'stringArray',
        defaultValue: ['mRNA', 'transcript', 'gene', 'CDS'],
      },
    }),
    formatDetails: ConfigurationSchema('FormatDetails', {
      /**
       * #slot formatDetails.feature
       */
      feature: {
        type: 'frozen',
        description: 'adds extra fields to the feature details',
        defaultValue: {},
        contextVariable: ['feature'],
      },
      /**
       * #slot formatDetails.subfeatures
       */
      subfeatures: {
        type: 'frozen',
        description: 'adds extra fields to the subfeatures of a feature',
        defaultValue: {},
        contextVariable: ['feature'],
      },
      /**
       * #slot formatDetails.depth
       */
      depth: {
        type: 'number',
        defaultValue: 2,
        description: 'depth to iterate on subfeatures',
      },
    }),
    formatAbout: ConfigurationSchema('FormatAbout', {
      /**
       * #slot formatAbout.conf
       */
      config: {
        type: 'frozen',
        description: 'formats configuration object in about dialog',
        defaultValue: {},
        contextVariable: ['config'],
      },
      /**
       * #slot formatAbout.hideUris
       */
      hideUris: {
        type: 'boolean',
        defaultValue: false,
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
