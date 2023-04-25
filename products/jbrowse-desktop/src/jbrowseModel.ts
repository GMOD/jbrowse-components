import { readConfObject } from '@jbrowse/core/configuration'
import {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import { PluginDefinition } from '@jbrowse/core/PluginLoader'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import {
  cast,
  getParent,
  getSnapshot,
  resolveIdentifier,
} from 'mobx-state-tree'
import { SessionStateModel } from './sessionModelFactory'
import JBrowseConfigF from './jbrowseConfig'

// poke some things for testing (this stuff will eventually be removed)
// @ts-expect-error
window.getSnapshot = getSnapshot

// @ts-expect-error
window.resolveIdentifier = resolveIdentifier

/**
 * #stateModel JBrowseDesktopModel
 * the rootModel.jbrowse state model for JBrowse Desktop
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function JBrowseDesktop(
  pluginManager: PluginManager,
  Session: SessionStateModel,
  assemblyConfigSchemasType: AnyConfigurationSchemaType,
) {
  return JBrowseConfigF(pluginManager, Session, assemblyConfigSchemasType)
    .views(self => ({
      /**
       * #getter
       */
      get savedSessionNames(): string[] {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return getParent<any>(self).savedSessionNames
      },
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
        if (self.assemblyNames.includes(name)) {
          throw new Error(
            `Can't add assembly with name "${name}", an assembly with that name already exists`,
          )
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
        const length = self.tracks.push(trackConf)
        return self.tracks[length - 1]
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
        const idx = self.internetAccounts.findIndex(
          acct => acct.id === configuration.id,
        )
        if (idx === -1) {
          return undefined
        }
        return self.internetAccounts.splice(idx, 1)
      },
    }))
}
