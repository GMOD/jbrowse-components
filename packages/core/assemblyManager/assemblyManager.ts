import { reaction } from 'mobx'
import { addDisposer, getParent, types } from 'mobx-state-tree'

// locals
import { readConfObject } from '../configuration'
import { when } from '../util'
import assemblyFactory from './assembly'
import type { Assembly } from './assembly'
import type PluginManager from '../PluginManager'
import type { AnyConfigurationModel } from '../configuration'
import type RpcManager from '../rpc/RpcManager'
import type { Instance, IAnyType } from 'mobx-state-tree'

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
      /**
       * #getter
       */
      get assemblyNameMap() {
        const obj = {} as Record<string, Assembly>
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
       * combined jbrowse.assemblies, session.sessionAssemblies, and
       * session.temporaryAssemblies
       */
      get assemblyList() {
        const {
          jbrowse: { assemblies },
          session: { sessionAssemblies = [], temporaryAssemblies = [] } = {},
        } = getParent<any>(self)
        return [
          ...assemblies,
          ...sessionAssemblies,
          ...temporaryAssemblies,
        ] as AnyConfigurationModel[]
      },

      get rpcManager(): RpcManager {
        return getParent<any>(self).rpcManager
      },
    }))
    .views(self => ({
      /**
       * #method
       * use this method instead of assemblyManager.get(assemblyName) to get an
       * assembly with regions loaded
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
            !!(assembly.regions && assembly.refNameAliases) || !!assembly.error,
        )
        if (assembly.error) {
          // eslint-disable-next-line @typescript-eslint/only-throw-error
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
        opts: { stopToken?: string; sessionId: string },
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
        opts: { stopToken?: string; sessionId: string },
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
              for (const asm of self.assemblies) {
                if (!asm.configuration) {
                  this.removeAssembly(asm)
                }
              }
              for (const conf of assemblyConfs) {
                const name = readConfObject(conf, 'name')
                if (!self.assemblies.some(a => a.name === name)) {
                  this.addAssembly(conf)
                }
              }
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
    }))
}

export default assemblyManagerFactory
