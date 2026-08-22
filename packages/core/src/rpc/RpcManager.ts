import { readConfObject } from '../configuration/index.ts'
import { getNumberGrouping } from '../util/numericUtils.ts'
import { isAppRootModel, isAuthNeededException } from '../util/types/index.ts'
import MainThreadRpcDriver from './MainThreadRpcDriver.ts'
import WebWorkerRpcDriver from './WebWorkerRpcDriver.ts'
import rpcConfigSchema from './configSchema.ts'

import type PluginManager from '../PluginManager.ts'
import type { AnyConfigurationModel } from '../configuration/index.ts'
import type BaseRpcDriver from './BaseRpcDriver.ts'
import type { RpcCallArgs, RpcCallReturn } from './RpcRegistry.ts'

export interface RpcManagerOptions {
  // factory that creates a web worker; required to use the WebWorkerRpcDriver
  makeWorkerInstance?: () => Worker
  // host-application default driver, used when the config names none. web and
  // desktop pass 'WebWorkerRpcDriver'; embedded/headless leave it as the main
  // thread.
  defaultDriverName?: string
}

export default class RpcManager {
  static configSchema = rpcConfigSchema

  private pluginManager: PluginManager
  private mainConfiguration: AnyConfigurationModel
  private hostDriverName: string
  private makeWorkerInstance?: () => Worker
  private driver?: BaseRpcDriver
  private destroyed = false

  constructor(
    pluginManager: PluginManager,
    mainConfiguration: AnyConfigurationModel,
    {
      makeWorkerInstance,
      defaultDriverName = 'MainThreadRpcDriver',
    }: RpcManagerOptions = {},
  ) {
    this.pluginManager = pluginManager
    this.mainConfiguration = mainConfiguration
    this.hostDriverName = defaultDriverName
    this.makeWorkerInstance = makeWorkerInstance
  }

  /**
   * Which driver this session runs on: the config's `defaultDriver` if set,
   * otherwise the host application's default.
   *
   * A getter rather than the two fields it replaces, because the diagnostic
   * surfaces that want to print it — the About widget and the error-stack dialog
   * — were each re-deriving the resolution from `mainConfiguration` and
   * `defaultDriverName`, so the rule for where a call goes was written three
   * times and one copy carried a cast.
   */
  get driverName(): string {
    return (
      readConfObject(this.mainConfiguration, 'defaultDriver') ||
      this.hostDriverName
    )
  }

  /**
   * The driver itself, built once and kept. The config read above is a tracked
   * MobX read and `call` reaches it synchronously, so resolving per call also
   * made the RPC configuration a dependency of every autorun that fetches.
   *
   * There is no per-call, per-track or per-display override. One existed, and
   * one call site in the app ever passed it — a tag-value scan in the alignments
   * plugin — so a track pinned to the main thread had its tag scan run there and
   * every one of its data fetches go to the worker pool anyway. Routing a single
   * call somewhere else is only meaningful with a backend that differs in what it
   * can do, which is the tabled server-side-driver idea; add it back with that,
   * not before.
   *
   * There is no registry of driver factories either: naming a driver means
   * naming `BaseRpcDriver`, which `@jbrowse/core` has no export path for, so
   * the two built-ins below are the whole set. ADR-086.
   */
  getDriver() {
    if (this.destroyed) {
      throw new Error('RpcManager was destroyed')
    }
    return (this.driver ??= this.makeDriver(this.driverName))
  }

  private makeDriver(backendName: string): BaseRpcDriver {
    if (backendName === 'MainThreadRpcDriver') {
      return new MainThreadRpcDriver(this.pluginManager, this.mainConfiguration)
    } else if (backendName === 'WebWorkerRpcDriver') {
      const { makeWorkerInstance } = this
      if (!makeWorkerInstance) {
        throw new Error(
          'WebWorkerRpcDriver requested but no makeWorkerInstance was provided',
        )
      }
      return new WebWorkerRpcDriver(
        this.pluginManager,
        this.mainConfiguration,
        {
          makeWorkerInstance,
          plugins: this.pluginManager.runtimePluginDefinitions,
          windowHref: typeof window === 'undefined' ? '' : window.location.href,
          // workers format their own strings (a jexl `mouseover` slot runs
          // against the full feature worker-side), so they need the display
          // preference too. Read at driver construction — workers boot lazily and
          // are not rebooted on a preference change, which is why the preference
          // asks for a reload.
          numberGrouping: getNumberGrouping(),
        },
      )
    } else {
      throw new Error(`RPC driver "${backendName}" is not registered`)
    }
  }

  /**
   * `args` carries the method's data and the caller's handles on the operation —
   * the stop token and the status callback. Both handles are always accepted,
   * for every method, because {@link RpcHandles} is part of `RpcCallArgs` rather
   * than of any registry entry.
   *
   * There is deliberately no second position for either. The handles were
   * accepted in an `opts` parameter as well, and the two disagreed:
   * `WebWorkerRpcDriver` honored a `statusCallback` there and
   * `MainThreadRpcDriver` ignored `opts` entirely, so the same call had a
   * working progress bar under a worker and a silent one under the driver every
   * embedded component defaults to. One position.
   *
   * The cast on the way out is at the driver boundary, where the method is an
   * unparameterized {@link RpcMethodType} and `deserializeReturn` is therefore
   * `unknown`. It is not the only thing holding the return type up: the same
   * type is what that hook is declared to produce, checked against the registry
   * at each method that overrides it.
   */
  async call<M extends string>(
    sessionId: string,
    functionName: M,
    args: RpcCallArgs<M>,
  ): Promise<RpcCallReturn<M>> {
    if (!sessionId) {
      throw new Error('sessionId is required')
    }
    const driverForCall = this.getDriver()
    return (await this.withAuthRetry(() =>
      driverForCall.call(sessionId, functionName, { ...args, sessionId }),
    )) as RpcCallReturn<M>
  }

  /**
   * Drop everything held for a session — the worker-side adapter cache, and the
   * driver's own bookkeeping for it. Reached from `releaseAdapterSession` when
   * the last track model holding an `rpcSessionId` goes away.
   *
   * A lifecycle operation rather than `call(sessionId, 'CoreFreeResources')`,
   * so that it neither boots a transport to free a session that never used one
   * nor outlives {@link destroy}; see {@link BaseRpcDriver.freeSession}.
   *
   * Silent on a destroyed manager, because the destroy already freed strictly
   * more than this would: it terminated the workers the cache lived in.
   */
  async freeSession(sessionId: string) {
    if (!this.destroyed) {
      await this.getDriver().freeSession(sessionId)
    }
  }

  /**
   * Run an RPC thunk, and if it fails because a location needs auth, set up
   * credentials for the origin and run it exactly once more. The single retry
   * is structural — there is no loop — so a persistent auth failure surfaces
   * the error instead of spinning. The retry re-runs serializeArguments, which
   * now finds the new account and injects pre-authorization (prompting the
   * user). If auth can't be set up, the original error is rethrown unchanged.
   */
  private async withAuthRetry<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run()
    } catch (error) {
      if (isAuthNeededException(error) && this.ensureAuthForOrigin(error.url)) {
        return run()
      } else {
        throw error
      }
    }
  }

  /**
   * Ensure an ephemeral HTTP-basic internet account exists for a location's
   * origin so a retried RPC call can authenticate. The account id is derived
   * from the origin and reused if already present: when a track first loads,
   * many block RPC calls fail auth near-simultaneously, and a single shared
   * account collapses them into one credential prompt (BaseInternetAccountModel
   * memoizes the token via a per-account promise). Returns false when the root
   * model can't hold accounts or no HTTPBasicInternetAccount type is registered
   * (authentication plugin not loaded), signaling the caller not to retry.
   */
  private ensureAuthForOrigin(url: string) {
    const { rootModel } = this.pluginManager
    let ready = false
    if (isAppRootModel(rootModel)) {
      try {
        const internetAccountId = `HTTPBasicInternetAccount-${new URL(url).origin}`
        const hasExisting = rootModel.internetAccounts.some(
          account => account.internetAccountId === internetAccountId,
        )
        if (!hasExisting) {
          rootModel.createEphemeralInternetAccount(internetAccountId, {}, url)
        }
        ready = true
      } catch {
        // no HTTPBasicInternetAccount type registered; leave ready=false so the
        // caller surfaces the original auth error instead of retrying
      }
    }
    return ready
  }

  /**
   * Terminate the driver's worker threads. Call when discarding the owning root
   * model (e.g. switching sessions or reloading after a plugin change) so
   * orphaned workers don't accumulate across a desktop run.
   *
   * **Terminal.** ADR-069 destroys the tree a task after `detach()`, so calls
   * still arrive in that gap; a later one throws rather than quietly building a
   * second driver and a second pool that nothing will ever destroy. ADR-086.
   */
  destroy() {
    this.destroyed = true
    this.driver?.destroy()
    this.driver = undefined
  }
}
