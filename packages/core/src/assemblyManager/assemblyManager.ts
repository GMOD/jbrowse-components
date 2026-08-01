import { addDisposer, getParent, types } from '@jbrowse/mobx-state-tree'
import { autorun, untracked } from 'mobx'
import { when } from 'mobx'

import { readConfObject } from '../configuration/index.ts'
import assemblyFactory from './assembly.ts'

import type PluginManager from '../PluginManager.ts'
import type { AnyConfigurationModel } from '../configuration/index.ts'
import type RpcManager from '../rpc/RpcManager.ts'
import type { StatusCallback } from '../util/progress.ts'
import type { StopToken } from '../util/stopToken.ts'
import type { Assembly } from './assembly.ts'
import type { IAnyType, Instance } from '@jbrowse/mobx-state-tree'

type AdapterConf = Record<string, unknown>

// the root the assemblyManager is parented under (the session/root model),
// covering only the fields read here
interface AssemblyManagerParent {
  rpcManager: RpcManager
  jbrowse: { assemblies: AnyConfigurationModel[] }
  session?: {
    sessionAssemblies?: AnyConfigurationModel[]
    temporaryAssemblies?: AnyConfigurationModel[]
  }
}

export interface AssemblyBaseOpts {
  stopToken?: StopToken
  sessionId: string
  statusCallback?: StatusCallback
}

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
        const obj: Record<string, Assembly> = {}
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
      getCanonicalAssemblyName(asmName: string) {
        return self.assemblyNameMap[asmName]?.name
      },
      /**
       * #method
       */
      getDisplayName(asmName: string) {
        return self.assemblyNameMap[asmName]?.displayName || asmName
      },
      /**
       * #method
       * The assembly `asmName` names, or undefined. Reports a name it doesn't
       * know to `Core-handleUnrecognizedAssembly` so a plugin can go supply it,
       * which is a side effect: a caller only asking *whether* the session has
       * the assembly wants {@link has} instead.
       */
      get(asmName: string) {
        if (asmName) {
          const assembly = self.assemblyNameMap[asmName]
          if (assembly) {
            return assembly
          } else if (!this.has(asmName)) {
            // Extension point for loading unrecognized assemblies. Allows
            // plugins to provide custom logic for assembly resolution
            //
            // Note: this does not return any particular value. however, it can
            // trigger things like like adding connections, that will
            // eventually trigger assemblies to be loaded and new evaluations
            // via observable behavior
            pm.evaluateExtensionPoint(
              /** #extensionPoint Core-handleUnrecognizedAssembly | sync | Supply an assembly config when a referenced assembly is unknown */
              'Core-handleUnrecognizedAssembly',
              undefined,
              {
                assemblyName: asmName,
                session: getParent<AssemblyManagerParent>(self).session,
              },
            )
          }
        }

        return undefined
      },

      /**
       * #method
       * Whether the session knows this assembly. Use this, not `get`, to ask
       * only whether the assembly is present: `!has(name)` is exactly the
       * condition under which `get` reports `name` to
       * `Core-handleUnrecognizedAssembly`, so probing with `get` tells every
       * installed plugin to go resolve a name that a caller supplying the
       * assembly itself (a hub connection, MAF row navigation) is about to
       * create.
       */
      // `get` calls this to decide whether to report, so the two can't drift.
      //
      // Both lookups are load-bearing and they miss in opposite directions, so
      // neither alone is a correct probe: assemblyNameMap is keyed by
      // allAliases ([name, ...aliases]), so only it answers for an alias (`vvx`
      // for `volvox`); assemblyNamesList reads canonical names off the configs,
      // so only it answers in the window where a config exists but the
      // afterAttach autorun hasn't built its model. A wrong "no" either way
      // means the caller re-adds an assembly the session already has.
      //
      // Return type annotated because assemblyNameMap is a Record: its index
      // read is never undefined to the compiler, so `!!` on it infers the
      // literal `true` and `!has(name)` would be dead code at every call site.
      has(asmName: string): boolean {
        return (
          !!self.assemblyNameMap[asmName] ||
          this.assemblyNamesList.includes(asmName)
        )
      },

      /**
       * #getter
       * read via readConfObject, matching how the afterAttach autorun names the
       * assemblies it creates: get() treats a name found here as "a config
       * exists, its model is just not built yet", so the two must agree
       */
      get assemblyNamesList(): string[] {
        return this.assemblyList.map(asm => readConfObject(asm, 'name'))
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
        } = getParent<AssemblyManagerParent>(self)
        return [...assemblies, ...sessionAssemblies, ...temporaryAssemblies]
      },

      get rpcManager(): RpcManager {
        return getParent<AssemblyManagerParent>(self).rpcManager
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
            await when(() => Boolean(self.get(assemblyName)), {
              timeout: 10000,
            })
            assembly = self.get(assemblyName)
          } catch (e) {
            // ignore
          }
        }

        if (!assembly) {
          return undefined
        }
        // load() resolves only after setLoaded (regions + refNameAliases) has
        // run and rejects on failure, so awaiting the promise is enough: no
        // extra reactive wait, and no error check, needed
        await assembly.load()
        return assembly
      },

      /**
       * #method
       */
      async getRefNameMapForAdapter(
        adapterConf: AdapterConf,
        assemblyName: string | undefined,
        opts: AssemblyBaseOpts,
      ) {
        if (assemblyName) {
          const asm = await this.waitForAssembly(assemblyName)
          return asm?.getRefNameMapForAdapter(adapterConf, opts) ?? {}
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
          `Failed to look up refName:${refName} on assemblyName:${assemblyName} (assembly does not exist)`,
        )
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(
            () => {
              const assemblyConfs = self.assemblyList
              untracked(() => {
                // filter() returns a new plain array, so removing from
                // self.assemblies in the loop below does not skip elements
                // (removeAssembly splices the live observable array)
                const orphaned = self.assemblies.filter(a => !a.configuration)
                for (const asm of orphaned) {
                  this.removeAssembly(asm)
                }
                for (const conf of assemblyConfs) {
                  const name = readConfObject(conf, 'name')
                  if (!self.assemblies.some(a => a.name === name)) {
                    this.addAssembly(conf)
                  }
                }
              })
            },
            { name: 'assemblyManagerAfterAttach' },
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
