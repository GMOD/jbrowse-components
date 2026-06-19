import { pluginUrl } from '@jbrowse/core/PluginLoader'
import { readConfObject } from '@jbrowse/core/configuration'
import { cast, getParent, getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { migrateConfigSnapshot } from '@jbrowse/product-core'
import { toJS } from 'mobx'

import { JBrowseConfigF } from '../JBrowseConfig/index.ts'

import type { PluginDefinition } from '@jbrowse/core/PluginLoader'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type {
  AnyConfigurationModel,
  ConfigurationSchemaDefinition,
} from '@jbrowse/core/configuration'
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
export function JBrowseModelF({
  pluginManager,
  assemblyConfigSchema,
  extraConfigSlots,
}: {
  adminMode?: boolean
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
      addTrackConf(trackConf: { trackId: string; type: string }) {
        const { type } = trackConf
        if (!type) {
          throw new Error(`track type not specified for "${trackConf.trackId}"`)
        }
        self.tracks = [...self.tracks, trackConf]
        return self.tracks.at(-1)
      },
      /**
       * #action
       */
      addConnectionConf(connectionConf: AnyConfigurationModel) {
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
        const elt = self.connections.find(conn => conn.id === configuration.id)
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
          // Replace the track at that index
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
       */
      removePlugin(pluginDefinition: PluginDefinition) {
        const targetUrl = pluginUrl(pluginDefinition)
        self.plugins = cast(
          self.plugins.filter(plugin => pluginUrl(plugin) !== targetUrl),
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
        const elt = self.internetAccounts.find(a => a.id === configuration.id)
        return elt ? self.internetAccounts.remove(elt) : false
      },
    }))

  // Migrate legacy display types (e.g. LinearPileupDisplay →
  // LinearAlignmentsDisplay) when ingesting config snapshots so saved
  // configs from older JBrowse versions still load.
  return types.snapshotProcessor(model, {
    preProcessor(snapshot: Record<string, unknown>) {
      return migrateConfigSnapshot(snapshot)
    },
  })
}
