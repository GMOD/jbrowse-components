import { readConfObject } from '@jbrowse/core/configuration'
import { cast, getParent, getSnapshot } from '@jbrowse/mobx-state-tree'
import { toJS } from 'mobx'

import { JBrowseConfigF } from '../JBrowseConfig'

import type { PluginDefinition } from '@jbrowse/core/PluginLoader'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'

/**
 * #stateModel AppCoreJBrowseModel
 * note that JBrowseRootConfig is a config model, but config models are MST
 * trees themselves, which is why this stateModel is allowed to extend it
 *
 * the AppCoreJBrowseModel is generally on a property named rootModel.jbrowse
 *
 * extends
 * - [JBrowseRootConfig](/docs/config/jbrowserootconfig)

 */
export function JBrowseModelF({
  pluginManager,
  assemblyConfigSchema,
}: {
  adminMode?: boolean
  pluginManager: PluginManager
  assemblyConfigSchema: BaseAssemblyConfigSchema
}) {
  return JBrowseConfigF({ pluginManager, assemblyConfigSchema })
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
        return getParent<any>(self).rpcManager
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
          throw new Error(`unknown track type ${type}`)
        }
        // For frozen tracks, create new array with added track
        self.tracks = [...self.tracks, trackConf]
        return self.tracks.at(-1)
      },
      /**
       * #action
       */
      addConnectionConf(connectionConf: AnyConfigurationModel) {
        const { type } = connectionConf
        if (!type) {
          throw new Error(`unknown connection type ${type}`)
        }
        const length = self.connections.push(connectionConf)
        return self.connections[length - 1]
      },
      /**
       * #action
       */
      deleteConnectionConf(configuration: AnyConfigurationModel) {
        const elt = self.connections.find(conn => conn.id === configuration.id)
        return self.connections.remove(elt)
      },
      /**
       * #action
       */
      deleteTrackConf(trackConf: AnyConfigurationModel | { trackId: string }) {
        const trackId = trackConf.trackId
        // For frozen tracks, filter and reassign
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

        const rootModel = getParent<any>(self)
        rootModel.setPluginsUpdated(true)
      },
      /**
       * #action
       */
      removePlugin(pluginDefinition: PluginDefinition) {
        self.plugins = cast(
          self.plugins.filter(
            plugin =>
              // @ts-expect-error
              plugin.url !== pluginDefinition.url ||
              // @ts-expect-error
              plugin.umdUrl !== pluginDefinition.umdUrl ||
              // @ts-expect-error
              plugin.cjsUrl !== pluginDefinition.cjsUrl ||
              // @ts-expect-error
              plugin.esmUrl !== pluginDefinition.esmUrl,
          ),
        )

        getParent<any>(self).setPluginsUpdated(true)
      },

      /**
       * #action
       */
      setDefaultSessionConf(sessionConf: AnyConfigurationModel) {
        const newDefault =
          getParent<any>(self).session.name === sessionConf.name
            ? getSnapshot(sessionConf)
            : toJS(sessionConf)

        if (!newDefault.name) {
          throw new Error(`unable to set default session to ${newDefault.name}`)
        }

        self.defaultSession = cast(newDefault)
      },
      /**
       * #action
       */
      addInternetAccountConf(internetAccountConf: AnyConfigurationModel) {
        const { type } = internetAccountConf
        if (!type) {
          throw new Error(`unknown internetAccount type ${type}`)
        }
        const length = self.internetAccounts.push(internetAccountConf)
        return self.internetAccounts[length - 1]
      },
      /**
       * #action
       */
      deleteInternetAccountConf(configuration: AnyConfigurationModel) {
        const elt = self.internetAccounts.find(a => a.id === configuration.id)
        return self.internetAccounts.remove(elt)
      },
    }))
}
