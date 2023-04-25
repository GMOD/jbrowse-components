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

// locals
import { SessionStateModel } from './sessionModelFactory'
import JBrowseConfigF from './jbrowseConfig'
import RpcManager from '@jbrowse/core/rpc/RpcManager'

// poke some things for testing (this stuff will eventually be removed)
// @ts-expect-error
window.getSnapshot = getSnapshot
// @ts-expect-error
window.resolveIdentifier = resolveIdentifier

function removeAttr(obj: Record<string, unknown>, attr: string) {
  for (const prop in obj) {
    if (prop === attr) {
      delete obj[prop]
    } else if (typeof obj[prop] === 'object') {
      removeAttr(obj[prop] as Record<string, unknown>, attr)
    }
  }
  return obj
}

/**
 * #stateModel JBrowseWebModel
 * the rootModel.jbrowse state model for JBrowse Web
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function JBrowseWeb(
  pluginManager: PluginManager,
  Session: SessionStateModel,
  assemblyConfigSchemasType: AnyConfigurationSchemaType,
) {
  const JBrowseModel = JBrowseConfigF(
    pluginManager,
    assemblyConfigSchemasType,
    Session,
  )
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
      afterCreate() {
        const seen = [] as string[]
        self.assemblyNames.forEach(assemblyName => {
          if (!assemblyName) {
            throw new Error('Encountered an assembly with no "name" defined')
          }
          if (seen.includes(assemblyName)) {
            throw new Error(
              `Found two assemblies with the same name: ${assemblyName}`,
            )
          } else {
            seen.push(assemblyName)
          }
        })
      },
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
        const toRemove = self.assemblies.find(
          assembly => assembly.name === assemblyName,
        )
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
        const { type } = displayConf
        if (!type) {
          throw new Error(`unknown display type ${type}`)
        }
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
        const idx = self.connections.findIndex(
          conn => conn.id === configuration.id,
        )
        if (idx === -1) {
          return undefined
        }
        return self.connections.splice(idx, 1)
      },
      /**
       * #action
       */
      deleteTrackConf(trackConf: AnyConfigurationModel) {
        const { trackId } = trackConf
        const idx = self.tracks.findIndex(t => t.trackId === trackId)
        if (idx === -1) {
          return undefined
        }

        return self.tracks.splice(idx, 1)
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

        // @ts-expect-error complains about name missing, but above line checks this
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
        const { type } = config
        if (!type) {
          throw new Error(`unknown internetAccount type ${type}`)
        }
        const length = self.internetAccounts.push(config)
        return self.internetAccounts[length - 1]
      },
      /**
       * #action
       */
      deleteInternetAccountConf(config: AnyConfigurationModel) {
        const idx = self.internetAccounts.findIndex(a => a.id === config.id)
        if (idx === -1) {
          return undefined
        }
        return self.internetAccounts.splice(idx, 1)
      },
    }))

  return types.snapshotProcessor(JBrowseModel, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    postProcessor(snapshot: { [key: string]: any }) {
      return removeAttr(clone(snapshot), 'baseUri')
    },
  })
}
