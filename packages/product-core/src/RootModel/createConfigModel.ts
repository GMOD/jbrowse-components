import {
  ConfigurationSchema,
  FormatAboutConfigSchemaFactory,
  FormatDetailsConfigSchemaFactory,
  readConfObject,
} from '@jbrowse/core/configuration'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { expandLooseTrackConfig } from '@jbrowse/core/util/tracks'
import { getParent, types } from '@jbrowse/mobx-state-tree'

import { HierarchicalConfigSchemaFactory } from './HierarchicalConfig.ts'
import { PreferencesConfigSchemaFactory } from './PreferencesConfig.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { ConfigurationSnapshot } from '@jbrowse/core/configuration'
import type { IAnyType } from '@jbrowse/mobx-state-tree'

// This config model lives at rootModel.jbrowse, so its MST parent is the root
// model; this is the slice it reaches for. Mirrors app-core's JBrowseModelParent
// — a typed contract in place of getParent<any>.
interface ConfigModelParent {
  rpcManager: RpcManager
}

// A function rather than a module constant so it is still built once per
// createConfigModel call, as it was inline — what the function buys is a name
// for its type, since `SnapshotIn` of the model erases every slot name (a
// schema's MST props are assembled as a `Record<string, any>`).
function rootConfigurationSchema() {
  return ConfigurationSchema('Root', {
    rpc: RpcManager.configSchema,
    hierarchical: HierarchicalConfigSchemaFactory(),
    preferences: PreferencesConfigSchemaFactory(),
    formatDetails: FormatDetailsConfigSchemaFactory(),
    formatAbout: FormatAboutConfigSchemaFactory(),
    theme: { type: 'frozen', defaultValue: {} },
  })
}

/**
 * What an embedder may put in `createViewState`'s `configuration` option: every
 * root slot and sub-schema by name, values unchecked. Derived from the schema
 * above rather than restated, so a slot added there is spellable here the same
 * day.
 */
export type RootConfigurationSnapshot = ConfigurationSnapshot<
  ReturnType<typeof rootConfigurationSchema>
>

export function createConfigModel(
  pluginManager: PluginManager,
  assemblyConfigSchemasType: IAnyType,
) {
  return (
    types
      .model('Configuration', {
        configuration: rootConfigurationSchema(),
        assembly: assemblyConfigSchemasType,
        tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),
        internetAccounts: types.array(
          pluginManager.pluggableConfigSchemaType('internet account'),
        ),
        connections: types.array(
          pluginManager.pluggableConfigSchemaType('connection'),
        ),
        aggregateTextSearchAdapters: types.array(
          pluginManager.pluggableConfigSchemaType('text search adapter'),
        ),
        plugins: types.frozen(),
      })
      // The one assembly is what every loose `{ trackId, uri }` track is on, so
      // a snapshot need not repeat its name per track.
      .preProcessSnapshot((snap: Record<string, unknown> | undefined) => {
        const tracks = snap?.tracks
        const assemblyName = (snap?.assembly as { name?: string } | undefined)
          ?.name
        return Array.isArray(tracks)
          ? {
              ...snap,
              tracks: tracks.map(t =>
                expandLooseTrackConfig(t, pluginManager, assemblyName),
              ),
            }
          : snap
      })
      .views(self => ({
        get assemblies() {
          return [self.assembly]
        },
        get assemblyName(): string {
          return readConfObject(self.assembly, 'name')
        },
        get rpcManager() {
          return getParent<ConfigModelParent>(self).rpcManager
        },
      }))
  )
}
