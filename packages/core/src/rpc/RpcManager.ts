import MainThreadRpcDriver from './MainThreadRpcDriver.ts'
import WebWorkerRpcDriver from './WebWorkerRpcDriver.ts'
import rpcConfigSchema from './configSchema.ts'
import { readConfObject } from '../configuration/index.ts'
import { isAppRootModel, isAuthNeededException } from '../util/types/index.ts'

import type BaseRpcDriver from './BaseRpcDriver.ts'
import type PluginManager from '../PluginManager.ts'
import type { RpcArgs, RpcMethodName, RpcReturn } from './RpcRegistry.ts'
import type { AnyConfigurationModel } from '../configuration/index.ts'

type DriverClass = BaseRpcDriver

interface RenderingBackendConfigurations {
  WebWorkerRpcDriver?: Omit<
    ConstructorParameters<typeof WebWorkerRpcDriver>[0],
    'config'
  >
  MainThreadRpcDriver?: Omit<
    ConstructorParameters<typeof MainThreadRpcDriver>[0],
    'config'
  >
  [key: string]: unknown
}

export type RpcDriverFactory = (
  config: AnyConfigurationModel,
  backendConfig: unknown,
  pluginManager: PluginManager,
) => BaseRpcDriver

const makeMainThreadDriver: RpcDriverFactory = (config, backendConfig) =>
  new MainThreadRpcDriver({
    ...(backendConfig as ConstructorParameters<typeof MainThreadRpcDriver>[0]),
    config,
  })

const makeWebWorkerDriver: RpcDriverFactory = (config, backendConfig, pm) =>
  new WebWorkerRpcDriver(
    {
      ...(backendConfig as ConstructorParameters<typeof WebWorkerRpcDriver>[0]),
      config,
    },
    {
      plugins: pm.runtimePluginDefinitions,
      windowHref: typeof window !== 'undefined' ? window.location.href : '',
    },
  )

export default class RpcManager {
  static configSchema = rpcConfigSchema

  pluginManager: PluginManager
  mainConfiguration: AnyConfigurationModel
  backendConfigurations: RenderingBackendConfigurations
  driverObjects: Map<string, DriverClass>
  driverFactories: Map<string, RpcDriverFactory>

  constructor(
    pluginManager: PluginManager,
    mainConfiguration: AnyConfigurationModel,
    backendConfigurations: RenderingBackendConfigurations,
  ) {
    this.pluginManager = pluginManager
    this.mainConfiguration = mainConfiguration
    this.backendConfigurations = backendConfigurations
    this.driverObjects = new Map()
    this.driverFactories = new Map()

    this.registerDriverFactory('MainThreadRpcDriver', makeMainThreadDriver)
    this.registerDriverFactory('WebWorkerRpcDriver', makeWebWorkerDriver)
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

    const backendConfig = this.backendConfigurations[backendName]
    if (!backendConfig) {
      throw new Error(`RPC driver "${backendName}" is missing configuration`)
    }

    // plugin-registered custom drivers have no config entry of their own, so
    // fall back to the WebWorkerRpcDriver config for them (xref c0de7e44)
    const config =
      this.mainConfiguration.drivers.get(backendName) ??
      this.mainConfiguration.drivers.get('WebWorkerRpcDriver')
    const newDriver = factory(config, backendConfig, this.pluginManager)
    this.driverObjects.set(backendName, newDriver)
    return newDriver
  }

  getDriverForCall(
    args: { rpcDriverName?: string },
    opts?: { rpcDriverName?: string },
  ) {
    const backendName =
      args.rpcDriverName ||
      opts?.rpcDriverName ||
      readConfObject(this.mainConfiguration, 'defaultDriver')

    return this.getDriver(backendName)
  }

  async call<M extends string>(
    sessionId: string,
    functionName: M,
    args: M extends RpcMethodName
      ? RpcArgs<M & RpcMethodName>
      : Record<string, unknown>,
    opts?: { rpcDriverName?: string } & Record<string, unknown>,
  ): Promise<M extends RpcMethodName ? RpcReturn<M & RpcMethodName> : unknown> {
    if (!sessionId) {
      throw new Error('sessionId is required')
    }
    const a = { ...args, sessionId } as Record<string, unknown> & {
      sessionId: string
      rpcDriverName?: string
      statusCallback?: (message: unknown) => void
    }
    const driverForCall = this.getDriverForCall(a, opts)
    try {
      return (await this.withAuthRetry(() =>
        driverForCall.call(
          this.pluginManager,
          sessionId,
          functionName,
          a,
          opts ?? {},
        ),
      )) as M extends RpcMethodName ? RpcReturn<M & RpcMethodName> : unknown
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
        const existing = rootModel.internetAccounts.find(
          account => account.internetAccountId === internetAccountId,
        )
        if (!existing) {
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
