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
 * Which assembly names have already been reported to
 * `Core-handleUnrecognizedAssembly`, so each is reported once per session.
 *
 * Handlers resolve a name asynchronously and out of band — the hubs plugin
 * probes a url and adds a connection — and the assembly turning up is itself
 * the reactive signal, so there is nothing for a second report to accomplish.
 * `get` is called from render paths and computeds, so without this every
 * re-render re-reported, and a handler that answers by fetching re-fetched:
 * for exactly the names nothing can supply (a session naming a genome this
 * host has never heard of) that is an unbounded stream of requests.
 *
 * Keyed on the session node so replacing the session (`setSession`) starts
 * over: the connections and session assemblies a handler created for the old
 * session went with it, so a name it already answered for has to be
 * answerable again.
 *
 * A class instance rather than volatile fields because `get` records into it
 * from inside a derivation: MST leaves a class instance in volatile state
 * un-enhanced, while writing an observable volatile there is a state change
 * inside a computed.
 */
class UnrecognizedAssemblyReports {
  session: unknown = undefined
  names = new Set<string>()

  /** true the first time `name` comes up under `session`, false afterwards */
  shouldReport(session: unknown, name: string) {
    if (this.session !== session) {
      this.session = session
      this.names.clear()
    }
    if (this.names.has(name)) {
      return false
    }
    this.names.add(name)
    return true
  }
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
    .volatile(() => ({
      /**
       * #volatile
       * rate limiter for `get`'s `Core-handleUnrecognizedAssembly` reports, so
       * each unknown name reaches the extension point once per session
       */
      unrecognizedReports: new UnrecognizedAssemblyReports(),
    }))
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
       * the assembly wants {@link has} instead. Each name is reported at most
       * once per session, since a handler resolves it out of band and the
       * assembly turning up is itself the reactive signal.
       */
      get(asmName: string) {
        if (asmName) {
          const assembly = self.assemblyNameMap[asmName]
          if (assembly) {
            return assembly
          }
          const { session } = getParent<AssemblyManagerParent>(self)
          if (
            !this.has(asmName) &&
            self.unrecognizedReports.shouldReport(session, asmName)
          ) {
            // Extension point for loading unrecognized assemblies. Allows
            // plugins to provide custom logic for assembly resolution
            //
            // Note: this does not return any particular value. however, it can
            // trigger things like like adding connections, that will
            // eventually trigger assemblies to be loaded and new evaluations
            // via observable behavior. Which is also why each name is reported
            // only once per session — see UnrecognizedAssemblyReports.
            pm.evaluateExtensionPoint(
              /** #extensionPoint Core-handleUnrecognizedAssembly | sync | Supply an assembly config when a referenced assembly is unknown */
              'Core-handleUnrecognizedAssembly',
              undefined,
              {
                assemblyName: asmName,
                session,
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
      // (`get` also reports each name at most once per session; the dedupe is a
      // rate limit on top of this condition, not a second answer to it.)
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
