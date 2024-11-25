import { ConfigurationSchema } from '@jbrowse/core/configuration'

import RpcManager from '@jbrowse/core/rpc/RpcManager'
import {
  FormatAboutConfigSchemaFactory,
  FormatDetailsConfigSchemaFactory,
  HierarchicalConfigSchemaFactory,
} from '@jbrowse/product-core'
import { types } from 'mobx-state-tree'
import type { PluginDefinition } from '@jbrowse/core/PluginLoader'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

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

      formatDetails: FormatDetailsConfigSchemaFactory(),
      formatAbout: FormatAboutConfigSchemaFactory(),

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

      hierarchical: HierarchicalConfigSchemaFactory(),
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
      extraThemes: {
        type: 'frozen',
        defaultValue: {},
      },
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
     * configuration for aggregate text search adapters (created by e.g.
     * jbrowse text-index, but can be a pluggable TextSearchAdapter type)
     */
    aggregateTextSearchAdapters: types.array(
      pluginManager.pluggableConfigSchemaType('text search adapter'),
    ),

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
      name: 'New Session',
    }),
  })
}
