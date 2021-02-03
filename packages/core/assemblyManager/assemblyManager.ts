import { reaction, runInAction } from 'mobx'
import {
  addDisposer,
  cast,
  getParent,
  IAnyType,
  SnapshotOrInstance,
  types,
  Instance,
} from 'mobx-state-tree'
import { when } from '../util'
import { readConfObject } from '../configuration'
import { AnyConfigurationModel } from '../configuration/configurationSchema'

import assemblyFactory from './assembly'
import PluginManager from '../PluginManager'

export default function assemblyManagerFactory(
  assemblyConfigType: IAnyType,
  pluginManager: PluginManager,
) {
  const Assembly = assemblyFactory(assemblyConfigType, pluginManager)
  return types
    .model({
      assemblies: types.array(Assembly),
    })
    .volatile(() => ({
      ready: false,
    }))
    .views(self => ({
      get(assemblyName: string) {
        const canonicalName = this.aliasMap.get(assemblyName)
        return self.assemblies.find(
          assembly => assembly.name === (canonicalName || assemblyName),
        )
      },

      get assemblyList() {
        return getParent(self).jbrowse.assemblies.slice()
      },
      get connectionConfigs() {
        return getParent(self).jbrowse.connections.slice()
      },

      get aliasMap() {
        const aliases: Map<string, string> = new Map()
        self.assemblies.forEach(assembly => {
          if (assembly.aliases.length) {
            assembly.aliases.forEach(assemblyAlias => {
              aliases.set(assemblyAlias, assembly.name)
            })
          }
        })
        return aliases
      },
      get rpcManager() {
        return getParent(self).rpcManager
      },
      get pluginManager() {
        return getParent(self).pluginManager
      },
      get allPossibleRefNames() {
        let refNames: string[] = []
        for (const assembly of self.assemblies) {
          if (!assembly.allRefNames) {
            return undefined
          }
          refNames = refNames.concat(assembly.allRefNames)
        }
        return refNames
      },
    }))
    .views(self => ({
      // use this method instead of assemblyManager.get(assemblyName)
      // get an assembly with regions loaded
      async waitForAssembly(assemblyName: string) {
        if (!assemblyName) {
          throw new Error('no assembly name supplied to waitForAssembly')
        }
        const canonicalName = self.aliasMap.get(assemblyName)
        const assembly = self.assemblies.find(
          asm => asm.name === (canonicalName || assemblyName),
        )
        if (assembly) {
          await when(() => Boolean(assembly.regions && assembly.refNameAliases))
          return assembly
        }
        return undefined
      },

      async getRefNameMapForAdapter(
        adapterConf: unknown,
        assemblyName: string,
        opts: { signal?: AbortSignal; sessionId: string },
      ) {
        await when(() => Boolean(self.get(assemblyName)), {
          signal: opts.signal,
          name: 'when assembly ready',
        })

        const assembly = self.get(assemblyName)
        if (assembly) {
          return assembly.getRefNameMapForAdapter(adapterConf, opts)
        }
        return undefined
      },
      async getReverseRefNameMapForAdapter(
        adapterConf: unknown,
        assemblyName: string,
        opts: { signal?: AbortSignal; sessionId: string },
      ) {
        await when(() => Boolean(self.get(assemblyName)), {
          signal: opts.signal,
          name: 'when assembly ready',
        })
        const assembly = self.get(assemblyName)
        if (assembly) {
          return assembly.getReverseRefNameMapForAdapter(adapterConf, opts)
        }
        return undefined
      },
      isValidRefName(refName: string, assemblyName?: string) {
        if (assemblyName) {
          const assembly = self.get(assemblyName)
          if (assembly) {
            return assembly.isValidRefName(refName)
          }
          throw new Error(
            `isValidRefName for ${assemblyName} failed, assembly does not exist`,
          )
        }
        if (!self.allPossibleRefNames) {
          throw new Error(
            `isValidRefName not available, assemblyManager has not yet finished loading. If you are looking for a refname in a specific assembly, pass assembly argument`,
          )
        }
        return self.allPossibleRefNames.includes(refName)
      },
    }))
    .actions(self => ({
      setReady(isReady: boolean) {
        self.ready = isReady
      },
      removeAssembly(asm: Instance<typeof Assembly>) {
        self.assemblies.remove(asm)
      },
      afterAttach() {
        addDisposer(
          self,
          reaction(
            // have to slice it to be properly reacted to
            () => ({
              assemblyConfigs: self.assemblyList,
              connectionConfigs: self.connectionConfigs,
            }),
            ({
              assemblyConfigs,
              connectionConfigs,
            }: {
              assemblyConfigs: Instance<typeof Assembly> &
                AnyConfigurationModel[]
              connectionConfigs: AnyConfigurationModel[]
            }) => {
              this.setReady(false)
              self.assemblies.forEach(asm => {
                if (!asm.configuration) {
                  this.removeAssembly(asm)
                }
              })
              assemblyConfigs.forEach(assemblyConfig => {
                const existingAssemblyIdx = self.assemblies.findIndex(
                  assembly =>
                    assembly.name === readConfObject(assemblyConfig, 'name'),
                )
                if (existingAssemblyIdx === -1) {
                  this.addAssembly(assemblyConfig)
                }
              })
              const connectionPromises = connectionConfigs.map(
                connectionConfig => {
                  const connectionType = pluginManager.getConnectionType(
                    connectionConfig.type,
                  )
                  if (!connectionType) {
                    throw new Error(
                      `unknown connection type ${connectionConfig.type}`,
                    )
                  }
                  return connectionType
                    .getAssemblies(connectionConfig)
                    .then(connectionAssemblyConfigs => {
                      runInAction(() => {
                        connectionAssemblyConfigs.forEach(assemblyConfig => {
                          const existingAssemblyIdx = self.assemblies.findIndex(
                            assembly => assembly.name === assemblyConfig?.name,
                          )
                          if (existingAssemblyIdx === -1) {
                            const conf = getParent(
                              self,
                            ).jbrowse.addAssemblyConf({
                              ...assemblyConfig,
                              ephemeral: true,
                            })
                            this.addAssembly(conf)
                          }
                        })
                      })
                    })
                },
              )
              Promise.all(connectionPromises).then(() => {
                this.setReady(true)
              })
            },
            { fireImmediately: true, name: 'assemblyManagerAfterAttach' },
          ),
        )
      },
      addAssembly(
        assemblyConfig: SnapshotOrInstance<typeof assemblyConfigType> | string,
      ) {
        self.assemblies.push({ configuration: assemblyConfig })
      },
      replaceAssembly(
        idx: number,
        assemblyConfig: SnapshotOrInstance<typeof assemblyConfigType> | string,
      ) {
        self.assemblies[idx] = cast({
          configuration: assemblyConfig,
        })
      },
    }))
}
