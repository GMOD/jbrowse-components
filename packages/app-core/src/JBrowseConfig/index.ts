import { types } from '@jbrowse/mobx-state-tree'

import RootConfiguration from './RootConfiguration.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AnyConfigurationSchemaType,
  ConfigurationSchemaDefinition,
} from '@jbrowse/core/configuration'
import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

export { DEFAULT_SHARE_URL } from './defaultShareUrl.ts'

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
  extraConfigSlots,
}: {
  pluginManager: PluginManager
  assemblyConfigSchema: AnyConfigurationSchemaType
  extraConfigSlots?: ConfigurationSchemaDefinition
}) {
  return types.model('JBrowseConfig', {
    configuration: RootConfiguration({
      pluginManager,
      extraConfigSlots,
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
     * search indexes covering whole assemblies, as `jbrowse text-index` writes
     * them or any pluggable text search adapter. A trix index can be just its
     * `.ix` (`["trix/hg38.ix"]`), which takes the config's assembly when it
     * has one; with several, write `{ uri, assemblyNames }`.
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
     * the session loaded when no session is otherwise specified, e.g. the
     * initial view shown on first load
     */
    defaultSession: types.optional(types.frozen(), {
      name: 'New Session',
    }),

    /**
     * #slot
     * named sessions bundled with the config that a user can open from the
     * session selector
     */
    preConfiguredSessions: types.array(types.frozen()),

    ...pluginManager.pluginConfigurationRootSchemas(),
  })
}
