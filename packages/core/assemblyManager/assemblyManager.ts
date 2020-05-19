import { autorun } from 'mobx'
import {
  addDisposer,
  cast,
  getParent,
  IAnyType,
  SnapshotOrInstance,
  types,
} from 'mobx-state-tree'
import { readConfObject } from '../configuration'
import { AnyConfigurationModel } from '../configuration/configurationSchema'
import assemblyFactory from './assembly'

export default function assemblyManagerFactory(assemblyConfigType: IAnyType) {
  return types
    .model({
      assemblies: types.array(assemblyFactory(assemblyConfigType)),
    })
    .views(self => ({
      get(assemblyName: string) {
        const canonicalName = this.aliasMap.get(assemblyName)
        return self.assemblies.find(
          assembly => assembly.name === (canonicalName || assemblyName),
        )
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
      get allPossibleRefNames() {
        const refNames: string[] = []
        for (const assembly of self.assemblies) {
          if (!assembly.allRefNames) {
            return undefined
          }
          refNames.push(...assembly.allRefNames)
        }
        return refNames
      },
    }))
    .views(self => ({
      getRefNameMapForAdapter(
        adapterConf: unknown,
        assemblyName: string,
        opts: { signal?: AbortSignal } = {},
      ) {
        const assembly = self.get(assemblyName)
        if (assembly) {
          return assembly.getRefNameMapForAdapter(adapterConf, opts)
        }
        return undefined
      },
      getReverseRefNameMapForAdapter(
        adapterConf: unknown,
        assemblyName: string,
        opts: { signal?: AbortSignal } = {},
      ) {
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
        }
        if (!self.allPossibleRefNames) {
          return undefined
        }
        return self.allPossibleRefNames.includes(refName)
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            getParent(self).jbrowse.assemblies.forEach(
              (assemblyConfig: AnyConfigurationModel) => {
                const existingAssemblyIdx = self.assemblies.findIndex(
                  assembly =>
                    assembly.name === readConfObject(assemblyConfig, 'name'),
                )
                if (existingAssemblyIdx !== -1) {
                  this.replaceAssembly(existingAssemblyIdx, assemblyConfig)
                } else {
                  this.addAssembly(assemblyConfig)
                }
              },
            )
          }),
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
