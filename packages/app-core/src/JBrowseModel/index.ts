import PluginManager from '@jbrowse/core/PluginManager'
import { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import { cast, getParent, getSnapshot } from 'mobx-state-tree'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { PluginDefinition } from '@jbrowse/core/PluginLoader'
import { toJS } from 'mobx'

// locals
import { JBrowseConfigF } from '../JBrowseConfig'

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
  adminMode,
  pluginManager,
  assemblyConfigSchema,
}: {
  adminMode: boolean
  pluginManager: PluginManager
  assemblyConfigSchema: BaseAssemblyConfigSchema
}) {
  return JBrowseConfigF({ pluginManager, assemblyConfigSchema, adminMode })
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        if (adminMode) {
          self.tracks.push(trackConf)
        } else {
          self.tracks = [...self.tracks, trackConf]
        }
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
      deleteTrackConf(trackConf: AnyConfigurationModel) {
        if (adminMode) {
          const elt = self.tracks.find(t => t.trackId === trackConf.trackId)
          // @ts-expect-error
          return self.tracks.remove(elt)
        } else {
          return self.tracks.filter(f => f.trackId !== trackConf.trackId)
        }
      },
      /**
       * #action
       */
      addPlugin(pluginDefinition: PluginDefinition) {
        self.plugins.push(pluginDefinition)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
              plugin.url !== pluginDefinition.url ||
              plugin.umdUrl !== pluginDefinition.umdUrl ||
              plugin.cjsUrl !== pluginDefinition.cjsUrl ||
              plugin.esmUrl !== pluginDefinition.esmUrl,
          ),
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getParent<any>(self).setPluginsUpdated(true)
      },

      /**
       * #action
       */
      setDefaultSessionConf(sessionConf: AnyConfigurationModel) {
        const newDefault =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
