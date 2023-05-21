import {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
  readConfObject,
} from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { PluginDefinition } from '@jbrowse/core/PluginLoader'
import {
  getParent,
  getRoot,
  getSnapshot,
  resolveIdentifier,
  types,
  cast,
} from 'mobx-state-tree'
import { toJS } from 'mobx'
import clone from 'clone'
import RpcManager from '@jbrowse/core/rpc/RpcManager'

// locals
import { removeAttr } from './util'
import { JBrowseConfigF } from '@jbrowse/app-core'

// poke some things for testing (this stuff will eventually be removed)
// @ts-expect-error
window.getSnapshot = getSnapshot
// @ts-expect-error
window.resolveIdentifier = resolveIdentifier

/**
 * #stateModel JBrowseWebConfigModel
 * #category root
 * the rootModel.jbrowse state model for JBrowse Web
 */
export default function JBrowseWeb(
  pluginManager: PluginManager,
  assemblyConfigSchemasType: AnyConfigurationSchemaType,
) {
  const JBrowseModel = JBrowseConfigF(pluginManager, assemblyConfigSchemasType)
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
      addAssemblyConf(assemblyConf: AnyConfigurationModel) {
        const { name } = assemblyConf
        if (!name) {
          throw new Error('Can\'t add assembly with no "name"')
        }
        const assembly = self.assemblies.find(asm => asm.name === name)
        if (assembly) {
          return assembly
        }
        const length = self.assemblies.push({
          ...assemblyConf,
          sequence: {
            type: 'ReferenceSequenceTrack',
            trackId: `${name}-${Date.now()}`,
            ...assemblyConf.sequence,
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
      addTrackConf(trackConf: AnyConfigurationModel) {
        const { type } = trackConf
        if (!type) {
          throw new Error(`unknown track type ${type}`)
        }
        const track = self.tracks.find(t => t.trackId === trackConf.trackId)
        if (track) {
          return track
        }
        const length = self.tracks.push(trackConf)
        return self.tracks[length - 1]
      },
      /**
       * #action
       */
      addDisplayConf(trackId: string, displayConf: AnyConfigurationModel) {
        const track = self.tracks.find(t => t.trackId === trackId)
        if (!track) {
          throw new Error(`could not find track with id ${trackId}`)
        }
        return track.addDisplayConf(displayConf)
      },
      /**
       * #action
       */
      addConnectionConf(connectionConf: AnyConfigurationModel) {
        const length = self.connections.push(connectionConf)
        return self.connections[length - 1]
      },
      /**
       * #action
       */
      deleteConnectionConf(conf: AnyConfigurationModel) {
        const elt = self.connections.find(conn => conn.id === conf.id)
        self.connections.remove(elt)
      },
      /**
       * #action
       */
      deleteTrackConf(trackConf: AnyConfigurationModel) {
        const elt = self.tracks.find(t => t.trackId === trackConf.trackId)
        self.tracks.remove(elt)
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
      addPlugin(pluginDefinition: PluginDefinition) {
        self.plugins.push(pluginDefinition)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getRoot<any>(self).setPluginsUpdated(true)
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
      addInternetAccountConf(config: AnyConfigurationModel) {
        const length = self.internetAccounts.push(config)
        return self.internetAccounts[length - 1]
      },
      /**
       * #action
       */
      deleteInternetAccountConf(config: AnyConfigurationModel) {
        const elt = self.internetAccounts.find(a => a.id === config.id)
        self.internetAccounts.remove(elt)
      },
    }))

  return types.snapshotProcessor(JBrowseModel, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    postProcessor(snapshot: { [key: string]: any }) {
      return removeAttr(clone(snapshot), 'baseUri')
    },
  })
}
