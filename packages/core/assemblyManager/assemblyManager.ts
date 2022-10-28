import {
  addDisposer,
  cast,
  getParent,
  types,
  Instance,
  IAnyType,
} from 'mobx-state-tree'
import { when } from '../util'
import { reaction } from 'mobx'
import { readConfObject, AnyConfigurationModel } from '../configuration'
import assemblyFactory, { Assembly } from './assembly'
import PluginManager from '../PluginManager'

function assemblyManagerFactory(conf: IAnyType, pm: PluginManager) {
  type Conf = Instance<typeof conf> | string
  return types
    .model({
      assemblies: types.array(assemblyFactory(conf, pm)),
    })
    .views(self => ({
      get(asmName: string) {
        return self.assemblies.find(asm => asm.hasName(asmName))
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
        ] as AnyConfigurationModel[]
      },

      get rpcManager() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return getParent<any>(self).rpcManager
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
        await assembly.load()
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
      isValidRefName(refName: string, assemblyName: string) {
        const assembly = self.get(assemblyName)
        if (assembly) {
          return assembly.isValidRefName(refName)
        }
        throw new Error(
          `isValidRefName for ${assemblyName} failed, assembly does not exist`,
        )
      },
    }))
    .actions(self => ({
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
      removeAssembly(asm: Assembly) {
        self.assemblies.remove(asm)
      },

      // this can take an active instance of an assembly, in which case it is
      // referred to, or it can take an identifier e.g. assembly name, which is
      // used as a reference. snapshots cannot be used
      addAssembly(configuration: Conf) {
        self.assemblies.push({ configuration })
      },

      replaceAssembly(idx: number, configuration: Conf) {
        self.assemblies[idx] = cast({ configuration })
      },
    }))
}

export default assemblyManagerFactory
