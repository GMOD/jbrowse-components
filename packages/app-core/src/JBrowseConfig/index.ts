import { types } from '@jbrowse/mobx-state-tree'

import RootConfiguration from './RootConfiguration'

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
  adminMode?: boolean
}) {
  return types.model('JBrowseConfig', {
    configuration: RootConfiguration({
      pluginManager,
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
     * instances of a track can exist that use the same configuration.
     * Always uses frozen for performance - editing creates temporary MST models.
     */
    tracks: types.frozen([] as { trackId: string; [key: string]: unknown }[]),
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

    /**
     * #slot
     */
    preConfiguredSessions: types.array(types.frozen()),

    ...pluginManager.pluginConfigurationRootSchemas(),
  })
}
