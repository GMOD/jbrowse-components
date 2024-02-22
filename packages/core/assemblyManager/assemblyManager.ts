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
import RpcManager from '../rpc/RpcManager'

type AdapterConf = Record<string, unknown>

/**
 * #stateModel AssemblyManager
 */
function assemblyManagerFactory(conf: IAnyType, pm: PluginManager) {
  type Conf = Instance<typeof conf> // this is type any, try to narrow...
  return types
    .model({
      /**
       * #property
       * this is automatically managed by an autorun which looks in the parent
       * session.assemblies, session.sessionAssemblies, and
       * session.temporaryAssemblies
       */
      assemblies: types.array(assemblyFactory(conf, pm)),
    })
    .views(self => ({
      get assemblyNameMap() {
        const obj = {} as Record<string, Assembly | undefined>
        for (const assembly of self.assemblies) {
          for (const name of assembly.allAliases) {
            obj[name] = assembly
          }
        }
        return obj
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      get(asmName: string) {
        return self.assemblyNameMap[asmName]
      },

      /**
       * #getter
       */
      get assemblyNamesList() {
        return this.assemblyList.map(asm => asm.name)
      },

      /**
       * #getter
       * looks at jbrowse.assemblies, session.sessionAssemblies, and
       * session.temporaryAssemblies to load from
       */
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

      get rpcManager(): RpcManager {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return getParent<any>(self).rpcManager
      },
    }))
    .views(self => ({
      /**
       * #method
       * use this method instead of assemblyManager.get(assemblyName)
       * to get an assembly with regions loaded
       */
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
            !!(assembly?.regions && assembly.refNameAliases) ||
            !!assembly?.error,
        )
        if (assembly.error) {
          throw assembly.error
        }
        return assembly
      },

      /**
       * #method
       */
      async getRefNameMapForAdapter(
        adapterConf: AdapterConf,
        assemblyName: string | undefined,
        opts: { signal?: AbortSignal; sessionId: string },
      ) {
        if (assemblyName) {
          const asm = await this.waitForAssembly(assemblyName)
          return asm?.getRefNameMapForAdapter(adapterConf, opts)
        }
        return {}
      },

      /**
       * #method
       */
      async getReverseRefNameMapForAdapter(
        adapterConf: AdapterConf,
        assemblyName: string | undefined,
        opts: { signal?: AbortSignal; sessionId: string },
      ) {
        if (assemblyName) {
          const asm = await this.waitForAssembly(assemblyName)
          return asm?.getReverseRefNameMapForAdapter(adapterConf, opts)
        }
        return {}
      },

      /**
       * #method
       */
      isValidRefName(refName: string, assemblyName: string) {
        const assembly = self.get(assemblyName)
        if (assembly) {
          return assembly.isValidRefName(refName)
        }
        throw new Error(
          `Failed to look up refName ${refName} on ${assemblyName} because assembly does not exist`,
        )
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          reaction(
            () => self.assemblyList,
            assemblyConfs => {
              self.assemblies.forEach(asm => {
                if (!asm.configuration) {
                  this.removeAssembly(asm)
                }
              })
              assemblyConfs.forEach(conf => {
                if (
                  !self.assemblies.some(
                    a => a.name === readConfObject(conf, 'name'),
                  )
                ) {
                  this.addAssembly(conf)
                }
              })
            },
            { fireImmediately: true, name: 'assemblyManagerAfterAttach' },
          ),
        )
      },

      /**
       * #action
       * private: you would generally want to add to manipulate
       * jbrowse.assemblies, session.sessionAssemblies, or
       * session.temporaryAssemblies instead of using this directly
       */
      removeAssembly(asm: Assembly) {
        self.assemblies.remove(asm)
      },

      /**
       * #action
       * private: you would generally want to add to manipulate
       * jbrowse.assemblies, session.sessionAssemblies, or
       * session.temporaryAssemblies instead of using this directly
       *
       * this can take an active instance of an assembly, in which case it is
       * referred to, or it can take an identifier e.g. assembly name, which is
       * used as a reference. snapshots cannot be used
       */
      addAssembly(configuration: Conf) {
        self.assemblies.push({ configuration })
      },

      /**
       * #action
       * private: you would generally want to add to manipulate
       * jbrowse.assemblies, session.sessionAssemblies, or
       * session.temporaryAssemblies instead of using this directly
       */
      replaceAssembly(idx: number, configuration: Conf) {
        self.assemblies[idx] = cast({ configuration })
      },
    }))
}

export default assemblyManagerFactory
