import { readConfObject } from '../configuration/index.ts'
import { isAppRootModel, isAuthNeededException } from '../util/types/index.ts'
import MainThreadRpcDriver from './MainThreadRpcDriver.ts'
import WebWorkerRpcDriver from './WebWorkerRpcDriver.ts'
import rpcConfigSchema from './configSchema.ts'

import type PluginManager from '../PluginManager.ts'
import type { AnyConfigurationModel } from '../configuration/index.ts'
import type { StatusCallback } from '../util/progress.ts'
import type BaseRpcDriver from './BaseRpcDriver.ts'
import type { RpcArgs, RpcMethodName, RpcReturn } from './RpcRegistry.ts'

export type RpcDriverFactory = (
  config: AnyConfigurationModel,
  pluginManager: PluginManager,
) => BaseRpcDriver

// `call` accepts any string method name: a registered one resolves to its typed
// args/return (the `& RpcMethodName` re-narrows M inside the conditional, which
// TS won't do on its own), and an unknown one (e.g. a plugin-defined method not
// in the registry) falls back to the loose shapes. Registry args never include
// `sessionId` — `call` injects it from its first argument before dispatch.
type RpcCallArgs<M extends string> = M extends RpcMethodName
  ? Omit<RpcArgs<M & RpcMethodName>, 'sessionId'>
  : Record<string, unknown>
type RpcCallReturn<M extends string> = M extends RpcMethodName
  ? RpcReturn<M & RpcMethodName>
  : unknown

export interface RpcManagerOptions {
  // factory that creates a web worker; required to use the WebWorkerRpcDriver
  makeWorkerInstance?: () => Worker
  // host-application default driver, used when neither the call nor the config
  // names one. web/desktop pass 'WebWorkerRpcDriver'; embedded/headless leave
  // it as the main thread.
  defaultDriverName?: string
}

export default class RpcManager {
  static configSchema = rpcConfigSchema

  pluginManager: PluginManager
  mainConfiguration: AnyConfigurationModel
  defaultDriverName: string
  driverObjects = new Map<string, BaseRpcDriver>()
  driverFactories = new Map<string, RpcDriverFactory>()

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
    this.defaultDriverName = defaultDriverName

    // built-in driver factories close over the host's makeWorkerInstance; every
    // driver reads its config (just workerCount) from the single rpc config
    this.registerDriverFactory(
      'MainThreadRpcDriver',
      config => new MainThreadRpcDriver({ config }),
    )
    this.registerDriverFactory('WebWorkerRpcDriver', (config, pm) => {
      if (!makeWorkerInstance) {
        throw new Error(
          'WebWorkerRpcDriver requested but no makeWorkerInstance was provided',
        )
      }
      return new WebWorkerRpcDriver(
        { config, makeWorkerInstance },
        {
          plugins: pm.runtimePluginDefinitions,
          windowHref: typeof window !== 'undefined' ? window.location.href : '',
        },
      )
    })
  }

  registerDriverFactory(name: string, factory: RpcDriverFactory) {
    this.driverFactories.set(name, factory)
  }

  getDriver(backendName: string) {
    const existingDriver = this.driverObjects.get(backendName)
    if (existingDriver) {
      return existingDriver
    }

    const factory = this.driverFactories.get(backendName)
    if (!factory) {
      throw new Error(`RPC driver "${backendName}" is not registered`)
    }

    const newDriver = factory(this.mainConfiguration, this.pluginManager)
    this.driverObjects.set(backendName, newDriver)
    return newDriver
  }

  private getDriverForCall(
    args: { rpcDriverName?: string },
    opts?: { rpcDriverName?: string },
  ) {
    const backendName =
      args.rpcDriverName ||
      opts?.rpcDriverName ||
      readConfObject(this.mainConfiguration, 'defaultDriver') ||
      this.defaultDriverName

    return this.getDriver(backendName)
  }

  async call<M extends string>(
    sessionId: string,
    functionName: M,
    args: RpcCallArgs<M>,
    opts?: { rpcDriverName?: string } & Record<string, unknown>,
  ): Promise<RpcCallReturn<M>> {
    if (!sessionId) {
      throw new Error('sessionId is required')
    }
    const a = { ...args, sessionId } as Record<string, unknown> & {
      sessionId: string
      rpcDriverName?: string
      statusCallback?: StatusCallback
    }
    const driverForCall = this.getDriverForCall(a, opts)
    try {
      return (await this.withAuthRetry(() =>
        driverForCall.call(
          this.pluginManager,
          sessionId,
          functionName,
          a,
          opts,
        ),
      )) as RpcCallReturn<M>
    } finally {
      if (functionName === 'CoreFreeResources') {
        this.freeSessionOnAllDrivers(sessionId)
      }
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
   * Drop a session's sticky worker assignment on every driver so the
   * workerAssignments map doesn't grow unboundedly as sessions are freed.
   */
  private freeSessionOnAllDrivers(sessionId: string) {
    for (const driver of this.driverObjects.values()) {
      driver.freeSession(sessionId)
    }
  }

  /**
   * Terminate every driver's worker threads. Call when discarding the owning
   * root model (e.g. switching sessions or reloading after a plugin change) so
   * orphaned workers don't accumulate across a desktop run.
   */
  destroy() {
    for (const driver of this.driverObjects.values()) {
      driver.destroy()
    }
    this.driverObjects.clear()
  }
}
