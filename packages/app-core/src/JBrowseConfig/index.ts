import {
  AnyConfigurationSchemaType,
  ConfigurationSchema,
} from '@jbrowse/core/configuration'

import { PluginDefinition } from '@jbrowse/core/PluginLoader'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { types } from 'mobx-state-tree'

/**
 * #config JBrowseRootConfig
 * #category root
 * configuration in a config.json/file.jbrowse
 */
export function JBrowseConfigF({
  pluginManager,
  assemblyConfigSchema,
}: {
  pluginManager: PluginManager
  assemblyConfigSchema: AnyConfigurationSchemaType
}) {
  return types.model('JBrowseConfig', {
    configuration: ConfigurationSchema('Root', {
      /**
       * #slot configuration.rpc
       */
      rpc: RpcManager.configSchema,

      /**
       * #slot configuration.highResolutionScaling
       */
      highResolutionScaling: {
        type: 'number',
        defaultValue: 2,
      },

      formatDetails: ConfigurationSchema('FormatDetails', {
        /**
         * #slot configuration.formatDetails.feature
         */
        feature: {
          type: 'frozen',
          description: 'adds extra fields to the feature details',
          defaultValue: {},
          contextVariable: ['feature'],
        },
        /**
         * #slot configuration.formatDetails.subfeatures
         */
        subfeatures: {
          type: 'frozen',
          description: 'adds extra fields to the subfeatures of a feature',
          defaultValue: {},
          contextVariable: ['feature'],
        },
        /**
         * #slot configuration.formatDetails.depth
         */
        depth: {
          type: 'number',
          defaultValue: 2,
          description: 'depth to iterate on subfeatures',
        },
      }),
      formatAbout: ConfigurationSchema('FormatAbout', {
        /**
         * #slot configuration.formatAbout.config
         */
        config: {
          type: 'frozen',
          description: 'formats configuration object in about dialog',
          defaultValue: {},
          contextVariable: ['config'],
        },
        /**
         * #slot configuration.formatAbout.hideUris
         */

        hideUris: {
          type: 'boolean',
          defaultValue: false,
        },
      }),

      /*
       * #slot configuration.shareURL
       */
      shareURL: {
        type: 'string',
        defaultValue: 'https://share.jbrowse.org/api/v1/',
      },
      /**
       * #slot configuration.disableAnalytics
       */
      disableAnalytics: {
        type: 'boolean',
        defaultValue: false,
      },
      /**
       * #slot configuration.theme
       */
      theme: {
        type: 'frozen',
        defaultValue: {},
      },
      /**
       * #slot configuration.extraThemes
       */
      extraThemes: { type: 'frozen', defaultValue: {} },
      /**
       * #slot configuration.logoPath
       */
      logoPath: {
        type: 'fileLocation',
        defaultValue: { uri: '', locationType: 'UriLocation' },
      },
      ...pluginManager.pluginConfigurationSchemas(),
    }),
    /**
     * #slot
     * defines plugins of the format
     * ```typescript
     * type PluginDefinition=
     *    { umdUrl: string, name:string } |
     *    { url: string, name: string } |
     *    { esmUrl: string } |
     *    { cjsUrl: string } |
     *    { umdLoc: { uri: string } } |
     *    { esmLoc: { uri: string } } |
     * ```
     */
    plugins: types.array(types.frozen<PluginDefinition>()),
    /**
     * #slot
     * configuration of the assemblies in the instance, see BaseAssembly
     */
    assemblies: types.array(assemblyConfigSchema),
    /**
     * #slot
     * track configuration is an array of track config schemas. multiple
     * instances of a track can exist that use the same configuration
     */
    tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),
    /**
     * #slot
     * configuration for internet accounts, see InternetAccounts
     */
    internetAccounts: types.array(
      pluginManager.pluggableConfigSchemaType('internet account'),
    ),
    /**
     * #slot
     */
    aggregateTextSearchAdapters: types.array(
      pluginManager.pluggableConfigSchemaType('text search adapter'),
    ),

    /**
     * #slot
     */
    connections: types.array(
      pluginManager.pluggableConfigSchemaType('connection'),
    ),

    /**
     * #slot
     */
    defaultSession: types.optional(types.frozen(), {
      name: `New Session`,
    }),
  })
}
