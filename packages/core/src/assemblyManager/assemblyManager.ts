import { addDisposer, getParent, types } from '@jbrowse/mobx-state-tree'
import { autorun, untracked, when } from 'mobx'

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
    // only `loading` is read: a connection mid-fetch is something that could
    // still add an assembly, and settleAssemblyResolution waits for that to
    // finish rather than for a timeout
    connectionInstances?: { loading: boolean }[]
  }
}

export interface AssemblyBaseOpts {
  stopToken?: StopToken
  sessionId: string
  statusCallback?: StatusCallback
}

// How long waitForAssembly gives a handler that did NOT return a promise.
// Nothing about such a handler is observable — it was told a name and said
// nothing back — so there is no event to wait on and the only choices are a
// clock or giving up immediately, which would break a fire-and-forget handler
// that resolves the name a moment later. A handler that returns a promise gets
// waited on properly and never reaches this.
const UNDECLARED_HANDLER_GRACE_MS = 10000

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as PromiseLike<unknown> | undefined)?.then === 'function'
}

interface AssemblyReport {
  /** at least one handler was called, i.e. somebody might be working on it */
  handled: boolean
  /** the promise a handler returned, settling when it has finished trying */
  claim?: Promise<void>
}

/**
 * Per-session record of the `Core-handleUnrecognizedAssembly` reports this
 * manager has made, and of what the handlers said back.
 *
 * Each name is reported once. Handlers resolve a name asynchronously and out of
 * band — the hubs plugin probes a url and adds a connection — and the assembly
 * turning up is itself the reactive signal, so there is nothing for a second
 * report to accomplish. `get` is called from render paths and computeds, so
 * without this every re-render re-reported, and a handler that answers by
 * fetching re-fetched: for exactly the names nothing can supply (a session
 * naming a genome this host has never heard of) that is an unbounded stream of
 * requests.
 *
 * A handler may return a promise, which is its statement that it is working on
 * the name and that resolution is over when the promise settles. That is what
 * lets `waitForAssembly` wait on an event rather than on a clock, so the promise
 * should cover everything the handler does before the session gains anything
 * observable — for a handler that adds a connection, at least the probe that
 * decides whether to add one. The value is remembered here, so a later waiter
 * can await the same attempt the first lookup started.
 *
 * Keyed on the session node so replacing the session (`setSession`) starts
 * over: the connections and session assemblies a handler created for the old
 * session went with it, so a name it already answered for has to be answerable
 * again.
 *
 * Not observable state: `get` records into this from inside a derivation, where
 * writing an observable would be a state change inside a computed. A closure
 * rather than a class, because this is the type of a volatile and so reaches the
 * inferred root-model type of every product, where a class loses either way —
 * `private` members are still written into the declaration and then rejected as
 * inaccessible (TS4094), while a field typed `Map<string, AssemblyReport>` names
 * a module-local type (TS4058). Neither fires in this package; both fire in
 * jbrowse-web, the embedded products and the react components. Two methods
 * closing over the state name nothing but their own signatures.
 */
function createUnrecognizedAssemblyReports() {
  let current: unknown
  const reports = new Map<string, AssemblyReport>()

  return {
    /**
     * Report `name` via `fire`, once per session, and keep what came back.
     * `handlerCount` separates "every handler declined" from "nobody
     * listening": the folded result is the same either way, and only the first
     * is worth waiting out.
     */
    report(
      session: unknown,
      name: string,
      handlerCount: number,
      fire: () => unknown,
    ) {
      if (current !== session) {
        current = session
        reports.clear()
      }
      if (reports.has(name)) {
        return
      }
      const report: AssemblyReport = { handled: handlerCount > 0 }
      // recorded before firing: a handler that synchronously reads back through
      // `get` must not re-enter and report the same name again
      reports.set(name, report)
      const result = fire()
      if (isThenable(result)) {
        // a rejection is the handler's own to log; here it only means "done"
        report.claim = Promise.resolve(result).then(
          () => {},
          () => {},
        )
      }
    },

    /** what `report` recorded for `name` under `session`, if anything */
    reportFor(
      session: unknown,
      name: string,
    ): { handled: boolean; claim?: Promise<void> } | undefined {
      return current === session ? reports.get(name) : undefined
    },
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
      unrecognizedReports: createUnrecognizedAssemblyReports(),
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
          if (!this.has(asmName)) {
            // Extension point for loading unrecognized assemblies. Allows
            // plugins to provide custom logic for assembly resolution.
            //
            // A handler normally works out of band — adding a connection, say —
            // and the assembly turning up is what this manager reacts to, so
            // nothing here reads a result. But a handler that returns a promise
            // is telling waitForAssembly when it has finished trying, which is
            // the difference between waiting on an event and waiting on a
            // clock; UnrecognizedAssemblyReports keeps it, and keeps each name
            // from being reported more than once per session.
            const point = 'Core-handleUnrecognizedAssembly'
            self.unrecognizedReports.report(
              session,
              asmName,
              pm.extensionPointCallbackCount(point),
              () =>
                pm.evaluateExtensionPoint(
                  /** #extensionPoint Core-handleUnrecognizedAssembly | sync | Supply an assembly config when a referenced assembly is unknown. May return a promise settling when the handler has finished trying, which is what lets waitForAssembly stop waiting without a timeout */
                  'Core-handleUnrecognizedAssembly',
                  undefined,
                  {
                    assemblyName: asmName,
                    session,
                  },
                ),
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
      // Both lookups are load-bearing, and the config one has to cover aliases
      // as well: assemblyNameMap is keyed by allAliases ([name, ...aliases]) but
      // only exists once the afterAttach autorun has built the models, while
      // configuredAssemblyNames answers off the configs from the first render.
      // Screening on the canonical names alone left `vvx` unknown for the whole
      // startup window even though the config for `volvox` names it — a wrong
      // "no", which means the caller re-adds an assembly the session already
      // has, or (the synteny import forms) decides the session has nothing it
      // can open.
      //
      // The map is still asked first, and is not redundant: an assembly whose
      // config has just left the list still has a model until the autorun
      // disposes of it.
      //
      // Return type annotated because assemblyNameMap is a Record: its index
      // read is never undefined to the compiler, so `!!` on it infers the
      // literal `true` and `!has(name)` would be dead code at every call site.
      has(asmName: string): boolean {
        return (
          !!self.assemblyNameMap[asmName] ||
          this.configuredAssemblyNames.has(asmName)
        )
      },

      /**
       * #method
       * The first of `asmNames` that hasn't finished loading — the one a view
       * blocked on them is waiting for, and whose `statusMessage` /
       * `statusProgress` its spinner should show. Returns the assembly itself
       * (a stable reference, so a consuming getter doesn't invalidate on every
       * read) or undefined once they are all loaded.
       */
      loadingAssembly(asmNames: string[]) {
        return asmNames
          .map(name => this.get(name))
          .find(asm => !asm?.initialized)
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
       * Every name the *configs* answer to — each assembly's `name` and its
       * `aliases`. What {@link has} knows before the models exist.
       *
       * Separate from assemblyNamesList rather than widening it: `get` treats a
       * name found in that list as "a config exists, its model is just not built
       * yet", which has to stay the canonical name the autorun will create the
       * assembly under. A Set because `has` is called per name by per-render
       * scans over every track in the session.
       */
      get configuredAssemblyNames(): Set<string> {
        return new Set(
          this.assemblyList.flatMap(asm => [
            readConfObject(asm, 'name') as string,
            ...((readConfObject(asm, 'aliases') as string[] | undefined) ?? []),
          ]),
        )
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
       * Wait out whatever might still be about to supply `assemblyName`, and
       * resolve once nothing is.
       *
       * Resolution is a chain of events, not a duration: a handler probes and
       * adds a connection, the connection fetches a config, the config's
       * assemblies land in the session. Each link is observable, so each is
       * waited on rather than guessed at.
       *
       * - the handler's own promise, if it returned one, covers the part before
       *   the session gains anything to watch (the hubs plugin's HEAD probe)
       * - any connection still fetching could be carrying the assembly, so its
       *   `loading` flag going false is the next event. Every loading
       *   connection counts, not just one naming this assembly: a connection
       *   config need not declare what it will turn out to provide, and waiting
       *   for one connection too many costs a moment while missing one returns
       *   the wrong answer.
       *
       * A handler that returned nothing gets {@link UNDECLARED_HANDLER_GRACE_MS}
       * instead, because it left nothing to wait on.
       */
      async settleAssemblyResolution(assemblyName: string) {
        const { session } = getParent<AssemblyManagerParent>(self)
        // read through assemblyNameMap, not get(): a predicate `when`
        // re-evaluates should stay pure, and the report get() would make has
        // already been made by waitForAssembly
        const present = () => !!self.assemblyNameMap[assemblyName]
        if (present()) {
          return
        }
        const report = self.unrecognizedReports.reportFor(session, assemblyName)
        if (report?.claim) {
          await report.claim
        } else if (report?.handled) {
          await when(present, { timeout: UNDECLARED_HANDLER_GRACE_MS }).catch(
            () => {},
          )
        }
        // Nothing left that could still produce it. Both clauses are things
        // that end on their own, so this needs no bound of its own.
        const settled = () =>
          // a config carrying the name is already in the tree and the
          // afterAttach autorun is about to build its model
          !self.assemblyNamesList.includes(assemblyName) &&
          // a connection mid-fetch could be carrying it. Every loading
          // connection counts, not just one naming this assembly: a connection
          // config need not declare what it will turn out to provide, and
          // waiting for one connection too many costs a moment while missing
          // one returns the wrong answer.
          !session?.connectionInstances?.some(conn => conn.loading)
        if (!present()) {
          await when(() => present() || settled())
        }
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
        // get() rather than a bare map read: an unknown name has to reach
        // Core-handleUnrecognizedAssembly before there is anything to wait for
        let assembly = self.get(assemblyName)
        if (!assembly) {
          await self.settleAssemblyResolution(assemblyName)
          assembly = self.get(assemblyName)
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
       * {@link waitForAssembly}, but a name that cannot be resolved is an error
       * rather than an `undefined` for the caller to interpret.
       *
       * For callers whose result is silently *wrong* without the assembly, not
       * merely absent: a refName map is the obvious one, since an empty map
       * means an adapter gets queried with un-renamed refNames, finds nothing,
       * and the track draws blank with nothing to say why. Failing here instead
       * puts the name in front of the user, who is the only one who can add the
       * assembly or fix the track.
       *
       * Worth using only because the wait is causal now. It used to give up
       * after a fixed ten seconds, where "not resolved" could equally mean "not
       * resolved yet" and throwing would have been a race; today it returns
       * only once every handler and connection that could supply the name has
       * finished, so there is a real answer to report.
       */
      async requireAssembly(assemblyName: string) {
        const assembly = await this.waitForAssembly(assemblyName)
        if (!assembly) {
          throw new Error(
            `assembly "${assemblyName}" could not be resolved: it is not one of this session's assemblies and nothing supplied it`,
          )
        }
        return assembly
      },

      /**
       * #method
       * The refName map for an adapter under `assemblyName`. Throws if the
       * assembly cannot be resolved — see {@link requireAssembly}. No
       * `assemblyName` at all is not a failure, just nothing to rename.
       */
      async getRefNameMapForAdapter(
        adapterConf: AdapterConf,
        assemblyName: string | undefined,
        opts: AssemblyBaseOpts,
      ) {
        if (assemblyName) {
          const asm = await this.requireAssembly(assemblyName)
          return asm.getRefNameMapForAdapter(adapterConf, opts)
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
              // eslint-disable-next-line no-restricted-syntax -- self-write: removes from the assemblies it reads
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
