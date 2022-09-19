import { reaction } from 'mobx'
import {
  addDisposer,
  cast,
  getParent,
  types,
  Instance,
  IAnyType,
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
    .views(self => ({
      get(assemblyName: string) {
        return self.assemblies.find(assembly => assembly.hasName(assemblyName))
      },

      get assemblyNamesList() {
        return this.assemblyList.map(asm => asm.name)
      },

      get assemblyList() {
        // name is the explicit identifier and can be accessed without getConf,
        // hence the union with {name:string}
        const {
          jbrowse: { assemblies },
          session: { sessionAssemblies = [], temporaryAssemblies = [] } = {},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } = getParent<any>(self)
        return [
          ...assemblies,
          ...sessionAssemblies,
          ...temporaryAssemblies,
        ] as (AnyConfigurationModel & { name: string })[]
      },

      get rpcManager() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return getParent<any>(self).rpcManager
      },
      get pluginManager() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return getParent<any>(self).pluginManager
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
        let assembly = self.get(assemblyName)
        if (!assembly) {
          try {
            await when(() => Boolean(self.get(assemblyName)), { timeout: 1000 })
            assembly = self.get(assemblyName)
          } catch (e) {
            // ignore
          }
        }
        if (!assembly) {
          return undefined
        }
        await when(
          () =>
            Boolean(assembly?.regions && assembly.refNameAliases) ||
            !!assembly?.error,
        )
        if (assembly.error) {
          throw assembly.error
        }
        return assembly
      },

      async getRefNameMapForAdapter(
        adapterConf: unknown,
        assemblyName: string | undefined,
        opts: { signal?: AbortSignal; sessionId: string },
      ) {
        if (assemblyName) {
          const asm = await this.waitForAssembly(assemblyName)
          return asm?.getRefNameMapForAdapter(adapterConf, opts)
        }
        return {}
      },
      async getReverseRefNameMapForAdapter(
        adapterConf: unknown,
        assemblyName: string | undefined,
        opts: { signal?: AbortSignal; sessionId: string },
      ) {
        if (assemblyName) {
          const asm = await this.waitForAssembly(assemblyName)
          return asm?.getReverseRefNameMapForAdapter(adapterConf, opts)
        }
        return {}
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
      removeAssembly(asm: Instance<typeof Assembly>) {
        self.assemblies.remove(asm)
      },
      afterAttach() {
        addDisposer(
          self,
          reaction(
            // have to slice it to be properly reacted to
            () => self.assemblyList,
            assemblyConfigs => {
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
            },
            { fireImmediately: true, name: 'assemblyManagerAfterAttach' },
          ),
        )
      },

      // this can take an active instance of an assembly, in which case it is
      // referred to, or it can take an identifier e.g. assembly name, which is
      // used as a reference. snapshots cannot be used
      addAssembly(
        assemblyConfig: Instance<typeof assemblyConfigType> | string,
      ) {
        self.assemblies.push({ configuration: assemblyConfig })
      },

      replaceAssembly(
        idx: number,
        assemblyConfig: Instance<typeof assemblyConfigType> | string,
      ) {
        self.assemblies[idx] = cast({
          configuration: assemblyConfig,
        })
      },
    }))
}
