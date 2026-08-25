import { readConfObject } from '@jbrowse/core/configuration'
import { isPluginUrl, maybePluginUrl } from '@jbrowse/core/pluginDefinitions'
import { expandLooseTrackConfig } from '@jbrowse/core/util/tracks'
import { cast, getParent, getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { migrateConfigSnapshot } from '@jbrowse/product-core'
import { toJS } from 'mobx'

import { JBrowseConfigF } from '../JBrowseConfig/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type {
  AnyConfiguration,
  AnyConfigurationModel,
  ConfigurationSchemaDefinition,
} from '@jbrowse/core/configuration'
import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'

// This config model always lives at rootModel.jbrowse, so its MST parent is the
// root model. This is the slice of the root model this file reaches for; typing
// it replaces `getParent<any>` so the contract is checked rather than assumed.
// setPluginsUpdated takes no argument: every product reacts to "plugins
// changed" by rebuilding the plugin manager (desktop reloads from disk, web
// reloads the page), so there is no state to pass.
interface JBrowseModelParent {
  rpcManager: RpcManager
  session?: { name: string }
  setPluginsUpdated: () => void
}

/**
 * #stateModel AppCoreJBrowseModel
 * #category root
 * built on the [JBrowseRootConfig](/docs/config/jbrowserootconfig) config model —
 * config models are MST trees themselves, which is why this state model is
 * allowed to build on one. Generally found on a property named rootModel.jbrowse
 */
// A config with exactly one assembly is what every loose track is on, so
// `assemblyNames` may be left off; with several, the track has to say.
function expandLooseTracks(
  snapshot: Record<string, unknown>,
  pluginManager: PluginManager,
) {
  const tracks = snapshot.tracks
  if (!Array.isArray(tracks)) {
    return snapshot
  }
  const assemblies = snapshot.assemblies
  const only =
    Array.isArray(assemblies) && assemblies.length === 1
      ? (assemblies[0] as { name?: string }).name
      : undefined
  const expanded = tracks.map(t =>
    expandLooseTrackConfig(t, pluginManager, only),
  )
  return expanded.every((t, i) => t === tracks[i])
    ? snapshot
    : { ...snapshot, tracks: expanded }
}

export function JBrowseModelF({
  pluginManager,
  assemblyConfigSchema,
  extraConfigSlots,
}: {
  pluginManager: PluginManager
  assemblyConfigSchema: BaseAssemblyConfigSchema
  extraConfigSlots?: ConfigurationSchemaDefinition
}) {
  const model = JBrowseConfigF({
    pluginManager,
    assemblyConfigSchema,
    extraConfigSlots,
  })
    .views(self => ({
      /**
       * #getter
       */
      get assemblyNames(): string[] {
        return self.assemblies.map(assembly => readConfObject(assembly, 'name'))
      },
      /**
       * #getter
       */
      get rpcManager(): RpcManager {
        return getParent<JBrowseModelParent>(self).rpcManager
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      addAssemblyConf(conf: AnyConfigurationModel) {
        const { name } = conf
        if (!name) {
          throw new Error('Can\'t add assembly with no "name"')
        }
        if (self.assemblyNames.includes(name)) {
          throw new Error(
            `Can't add assembly with name "${name}", an assembly with that name already exists`,
          )
        }
        const length = self.assemblies.push({
          ...conf,
          sequence: {
            type: 'ReferenceSequenceTrack',
            trackId: `${name}-${Date.now()}`,
            ...conf.sequence,
          },
        })
        return self.assemblies[length - 1]
      },
      /**
       * #action
       */
      removeAssemblyConf(assemblyName: string) {
        const toRemove = self.assemblies.find(a => a.name === assemblyName)
        if (toRemove) {
          self.assemblies.remove(toRemove)
        }
      },
      /**
       * #action
       */
      addTrackConf(loose: { trackId: string; type?: string }) {
        const trackConf = expandLooseTrackConfig(loose, pluginManager)
        const { type } = trackConf
        if (!type) {
          throw new Error(`track type not specified for "${trackConf.trackId}"`)
        }
        self.tracks = [...self.tracks, trackConf]
        return self.tracks.at(-1)
      },
      /**
       * #action
       * Adds to the config's own `connections`, which every visitor to this
       * instance loads. Takes a snapshot as readily as a built config model —
       * the array coerces — since callers hand it plain JSON (a session spec's
       * `sessionConnections`, the CLI's add-connection output).
       */
      addConnectionConf(connectionConf: AnyConfiguration) {
        const { type } = connectionConf
        if (!type) {
          throw new Error('connection type not specified')
        }
        const length = self.connections.push(connectionConf)
        return self.connections[length - 1]
      },
      /**
       * #action
       */
      deleteConnectionConf(configuration: AnyConfigurationModel) {
        // key on connectionId: the connection schema's explicitIdentifier means
        // `.id` is undefined on every entry, so an id-based find always matched
        // the first connection and deleted the wrong one
        const elt = self.connections.find(
          conn => conn.connectionId === configuration.connectionId,
        )
        return elt ? self.connections.remove(elt) : false
      },
      /**
       * #action
       */
      deleteTrackConf(trackConf: AnyConfigurationModel | { trackId: string }) {
        const trackId = trackConf.trackId
        self.tracks = self.tracks.filter(t => t.trackId !== trackId)
      },
      /**
       * #action
       * Updates an existing track configuration. Used to sync editable configs
       * back to the frozen tracks array.
       */
      updateTrackConf(trackConf: { trackId: string; [key: string]: unknown }) {
        const { trackId } = trackConf
        const idx = self.tracks.findIndex(t => t.trackId === trackId)
        if (idx !== -1) {
          const newTracks = [...self.tracks]
          newTracks[idx] = trackConf
          self.tracks = newTracks
        }
      },
      /**
       * #action
       */
      addPlugin(pluginDefinition: PluginDefinition) {
        self.plugins.push(pluginDefinition)
        getParent<JBrowseModelParent>(self).setPluginsUpdated()
      },
      /**
       * #action
       * Removes the entry that loads from the same url — the version-pinned
       * definition, not every entry sharing a name, so the update flow's
       * remove-then-add swaps one version for another.
       *
       * A definition naming no loader matches nothing (`isPluginUrl`) rather than
       * every other url-less entry: `pluginUrl`'s miss value is the display string
       * 'unknown url', so removing one hand-written broken entry used to filter out
       * all of them. Such an entry has no InstalledPlugin row to remove it from
       * either — it never loads, so it is never in `runtimePluginDefinitions` — so
       * matching nothing costs nothing the UI could reach.
       */
      removePlugin(pluginDefinition: PluginDefinition) {
        const targetUrl = maybePluginUrl(pluginDefinition)
        self.plugins = cast(
          self.plugins.filter(plugin => !isPluginUrl(plugin, targetUrl)),
        )
        getParent<JBrowseModelParent>(self).setPluginsUpdated()
      },

      /**
       * #action
       */
      setDefaultSessionConf(sessionConf: AnyConfigurationModel) {
        const newDefault =
          getParent<JBrowseModelParent>(self).session?.name === sessionConf.name
            ? getSnapshot(sessionConf)
            : toJS(sessionConf)

        if (!newDefault.name) {
          throw new Error('default session must have a name')
        }

        self.defaultSession = cast(newDefault)
      },
      /**
       * #action
       */
      addInternetAccountConf(internetAccountConf: AnyConfigurationModel) {
        const { type } = internetAccountConf
        if (!type) {
          throw new Error('internet account type not specified')
        }
        const length = self.internetAccounts.push(internetAccountConf)
        return self.internetAccounts[length - 1]
      },
      /**
       * #action
       */
      deleteInternetAccountConf(configuration: AnyConfigurationModel) {
        // key on internetAccountId, not the undefined `.id` (see
        // deleteConnectionConf) so the correct account is removed
        const elt = self.internetAccounts.find(
          a => a.internetAccountId === configuration.internetAccountId,
        )
        return elt ? self.internetAccounts.remove(elt) : false
      },
    }))

  // Migrate legacy display types (e.g. LinearPileupDisplay →
  // LinearAlignmentsDisplay) when ingesting config snapshots so saved
  // configs from older JBrowse versions still load. `tracks` stays frozen
  // (ADR-032), so the loose `{ trackId, uri }` form is expanded here, where
  // the track selector and the trackId index read it, and never by a schema.
  return types.snapshotProcessor(model, {
    preProcessor(snapshot: Record<string, unknown>) {
      return migrateConfigSnapshot(expandLooseTracks(snapshot, pluginManager))
    },
  })
}
