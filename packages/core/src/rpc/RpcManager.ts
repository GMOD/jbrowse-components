import { readConfObject } from '../configuration/index.ts'
import { getNumberGrouping } from '../util/numericUtils.ts'
import { isAppRootModel, isAuthNeededException } from '../util/types/index.ts'
import MainThreadRpcDriver from './MainThreadRpcDriver.ts'
import WebWorkerRpcDriver from './WebWorkerRpcDriver.ts'
import rpcConfigSchema from './configSchema.ts'

import type PluginManager from '../PluginManager.ts'
import type BaseRpcDriver from './BaseRpcDriver.ts'
import type { RpcCallArgs, RpcCallReturn } from './RpcRegistry.ts'
import type { RpcConfigModel } from './configSchema.ts'

export interface RpcManagerOptions {
  // factory that creates a web worker; required to use the WebWorkerRpcDriver
  makeWorkerInstance?: () => Worker | Promise<Worker>
  // host-application default driver, used when the config names none. web,
  // desktop and an embedded product whose host passed makeWorkerInstance pass
  // 'WebWorkerRpcDriver'; headless leaves it as the main thread.
  defaultDriverName?: string
  // move to the main thread when the worker fails to boot; an embedded
  // product's host may have passed a factory its bundler did not build
  fallBackToMainThread?: boolean
}

export default class RpcManager {
  static configSchema = rpcConfigSchema

  private pluginManager: PluginManager
  private mainConfiguration: RpcConfigModel
  private hostDriverName: string
  private makeWorkerInstance?: () => Worker | Promise<Worker>
  private fallBackToMainThread: boolean
  private driver?: BaseRpcDriver
  private destroyed = false
  private workerFailed = false

  constructor(
    pluginManager: PluginManager,
    mainConfiguration: RpcConfigModel,
    {
      makeWorkerInstance,
      defaultDriverName = 'MainThreadRpcDriver',
      fallBackToMainThread = false,
    }: RpcManagerOptions = {},
  ) {
    this.pluginManager = pluginManager
    this.mainConfiguration = mainConfiguration
    this.hostDriverName = defaultDriverName
    this.makeWorkerInstance = makeWorkerInstance
    this.fallBackToMainThread = fallBackToMainThread
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
    return this.workerFailed
      ? 'MainThreadRpcDriver'
      : readConfObject(this.mainConfiguration, 'defaultDriver') ||
          this.hostDriverName
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
    if (
      this.fallBackToMainThread &&
      this.driver instanceof WebWorkerRpcDriver &&
      this.driver.bootFailure !== undefined
    ) {
      this.leaveFailedWorker(this.driver)
    }
    return (this.driver ??= this.makeDriver(this.driverName))
  }

  // warned, because a pool that quietly stops being a pool goes unnoticed
  private leaveFailedWorker(driver: WebWorkerRpcDriver) {
    console.warn(
      `JBrowse: the RPC web worker failed to start, so data now loads on the main thread, which is slower. The error below says why; https://jbrowse.org/jb2/docs/embedded_components/#the-rpc-worker has the fixes. Set configuration.rpc.defaultDriver to 'MainThreadRpcDriver' to choose the main thread and silence this.`,
      driver.bootFailure,
    )
    this.workerFailed = true
    driver.destroy()
    this.driver = undefined
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
   * the signal and the status callback. Both handles are always accepted,
   * for every method, because {@link RpcHandles} is part of `RpcCallArgs` rather
   * than of any registry entry.
   *
   * There is deliberately no second position for either. The handles were
   * accepted in an `opts` parameter as well, and the two disagreed:
   * `WebWorkerRpcDriver` honored a `statusCallback` there and
   * `MainThreadRpcDriver` ignored `opts` entirely, so the same call had a
   * working progress bar under a worker and a silent one on the main thread.
   * One position.
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
    const pending = this.runOnDriver(driver =>
      driver.call(sessionId, functionName, { ...args, sessionId }),
    )
    const calls =
      this.callsInFlight.get(sessionId) ?? new Set<Promise<unknown>>()
    this.callsInFlight.set(sessionId, calls)
    calls.add(pending)
    const settle = () => {
      calls.delete(pending)
      if (calls.size === 0) {
        this.callsInFlight.delete(sessionId)
      }
    }
    void pending.then(settle, settle)
    return (await pending) as RpcCallReturn<M>
  }

  private callsInFlight = new Map<string, Set<Promise<unknown>>>()

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
   *
   * Waits for the session's calls in flight, auth retries included: one still
   * serializing would otherwise reach the worker after the free and rebuild
   * the adapter under an id nothing releases again. `unclaimed` is asked again
   * after every wait, so a track reopened under the same id while the old
   * calls drain keeps its adapter, and calls it issues meanwhile are waited on
   * too.
   */
  async freeSession(sessionId: string, unclaimed = () => true) {
    let calls = this.callsInFlight.get(sessionId)
    while (unclaimed() && calls) {
      await Promise.allSettled([...calls])
      calls = this.callsInFlight.get(sessionId)
    }
    if (unclaimed() && !this.destroyed) {
      await this.getDriver().freeSession(sessionId)
    }
  }

  /**
   * Run an RPC thunk on the driver, and run it exactly once more if it fails
   * because a location needs auth: credentials for the origin are set up first.
   * The single retry is structural — there is no loop — so a persistent auth
   * failure surfaces the error instead of spinning. The retry re-runs
   * serializeArguments, which now finds the new account and injects
   * pre-authorization (prompting the user). If auth can't be set up, the
   * original error is rethrown unchanged. A call that failed on a driver the
   * session has since left runs again on its replacement.
   */
  private async runOnDriver<T>(
    run: (driver: BaseRpcDriver) => Promise<T>,
  ): Promise<T> {
    const driver = this.getDriver()
    try {
      return await run(driver)
    } catch (error) {
      if (isAuthNeededException(error) && this.ensureAuthForOrigin(error.url)) {
        return run(driver)
      } else if (!this.destroyed && this.getDriver() !== driver) {
        return this.runOnDriver(run)
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

  /**
   * Build the driver and let it start what the first call would wait for — a
   * web worker's bundle and runtime plugins — while the host is still building
   * its session.
   */
  warmUp() {
    if (!this.destroyed) {
      this.getDriver().warmUp()
    }
  }
}
