import {
  AnyConfigurationSchemaType,
  ConfigurationSchema,
} from '@jbrowse/core/configuration'

import { PluginDefinition } from '@jbrowse/core/PluginLoader'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import {
  FormatAboutConfigSchemaFactory,
  FormatDetailsConfigSchemaFactory,
  HierarchicalConfigSchemaFactory,
} from '@jbrowse/product-core'
import { types } from 'mobx-state-tree'

/**
 * #config JBrowseRootConfig
 * #category root
 *
 * this is a config model representing a config.json (for jbrowse-web) or
 * somefile.jbrowse (for jbrowse-desktop, where configs have the .jbrowse
 * extension)
 *
 * includes
 * - [FormatDetails](../formatdetails) for global (instead of per-track)
 *   feature detail formatters
 * - [FormatAbout](../formatabout) for global (instead of per-track) about
 *   track formatters
 * - [HierarchicalConfigSchema](../hierarchicalconfigschema) for track selector
 *   configs
 *
 * also includes any pluginManager.pluginConfigurationSchemas(), so plugins
 * that have a configurationSchema field on their class are mixed into this
 * object
 */
export function JBrowseConfigF({
  pluginManager,
  assemblyConfigSchema,
}: {
  pluginManager: PluginManager
  assemblyConfigSchema: AnyConfigurationSchemaType
}) {
  return types.model('JBrowseConfig', {
    /**
     * #slot
     * configuration for aggregate text search adapters (created by e.g.
     * jbrowse text-index, but can be a pluggable TextSearchAdapter type)
     */
    aggregateTextSearchAdapters: types.array(
      pluginManager.pluggableConfigSchemaType('text search adapter'),
    ),

    /**
     * #slot
     * configuration of the assemblies in the instance, see BaseAssembly
     */
    assemblies: types.array(assemblyConfigSchema),

    configuration: ConfigurationSchema('Root', {
      /**
       * #slot configuration.disableAnalytics
       */
      disableAnalytics: {
        defaultValue: false,
        type: 'boolean',
      },

      /**
       * #slot configuration.extraThemes
       */
      extraThemes: {
        defaultValue: {},
        type: 'frozen',
      },

      formatAbout: FormatAboutConfigSchemaFactory(),

      formatDetails: FormatDetailsConfigSchemaFactory(),

      hierarchical: HierarchicalConfigSchemaFactory(),

      /**
       * #slot configuration.highResolutionScaling
       */
      highResolutionScaling: {
        defaultValue: 2,
        type: 'number',
      },

      /**
       * #slot configuration.logoPath
       */
      logoPath: {
        defaultValue: { locationType: 'UriLocation', uri: '' },
        type: 'fileLocation',
      },

      /**
       * #slot configuration.rpc
       */
      rpc: RpcManager.configSchema,

      /*
       * #slot configuration.shareURL
       */
      shareURL: {
        defaultValue: 'https://share.jbrowse.org/api/v1/',
        type: 'string',
      },

      /**
       * #slot configuration.theme
       */
      theme: {
        defaultValue: {},
        type: 'frozen',
      },
      ...pluginManager.pluginConfigurationSchemas(),
    }),

    /**
     * #slot
     * configuration for connections
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

    /**
     * #slot
     * configuration for internet accounts, see InternetAccounts
     */
    internetAccounts: types.array(
      pluginManager.pluggableConfigSchemaType('internet account'),
    ),

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
     * track configuration is an array of track config schemas. multiple
     * instances of a track can exist that use the same configuration
     */
    tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),
  })
}
