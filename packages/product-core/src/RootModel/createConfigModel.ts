import {
  ConfigurationSchema,
  FormatAboutConfigSchemaFactory,
  FormatDetailsConfigSchemaFactory,
  readConfObject,
} from '@jbrowse/core/configuration'
import { migrateRetiredDisplays } from '@jbrowse/core/pluggableElementTypes/models'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { expandLooseSearchIndex } from '@jbrowse/core/util/expandLooseSearchIndex'
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
        /**
         * One genome in the ordinary case, several where the view draws them
         * together — a circular view's synteny ribbons need both ends of an
         * alignment on the circle. The order is the order a view lays them out
         * in.
         */
        assemblies: types.array(assemblyConfigSchemasType),
        tracks: types.frozen([] as Record<string, unknown>[]),
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
      // The first assembly is what every loose `{ trackId, uri }` track is on,
      // so a snapshot need not repeat its name per track. `tracks` is frozen,
      // so a retired display type stays spelt as written until the track
      // hydrates — and the track selector reads these entries before that, so
      // they carry the current name here as they do in app-core's JBrowseModel.
      .preProcessSnapshot((snap: Record<string, unknown> | undefined) => {
        const { tracks, aggregateTextSearchAdapters: indexes } = snap ?? {}
        const assemblyName = (
          snap?.assemblies as { name?: string }[] | undefined
        )?.[0]?.name
        return snap
          ? {
              ...snap,
              ...(Array.isArray(tracks)
                ? {
                    tracks: tracks.map(t => {
                      const track = expandLooseTrackConfig(
                        t,
                        pluginManager,
                        assemblyName,
                      )
                      return track && typeof track === 'object'
                        ? migrateRetiredDisplays(pluginManager, track)
                        : track
                    }),
                  }
                : {}),
              ...(Array.isArray(indexes)
                ? {
                    aggregateTextSearchAdapters: indexes.map(i =>
                      expandLooseSearchIndex(
                        i,
                        assemblyName ? [assemblyName] : undefined,
                      ),
                    ),
                  }
                : {}),
            }
          : snap
      })
      .views(self => ({
        get assemblyNames(): string[] {
          return self.assemblies.map(a => readConfObject(a, 'name'))
        },
        get rpcManager() {
          return getParent<ConfigModelParent>(self).rpcManager
        },
      }))
  )
}
