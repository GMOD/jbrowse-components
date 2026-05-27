import MainThreadRpcDriver from './MainThreadRpcDriver.ts'
import WebWorkerRpcDriver from './WebWorkerRpcDriver.ts'
import rpcConfigSchema from './configSchema.ts'
import { readConfObject } from '../configuration/index.ts'

import type BaseRpcDriver from './BaseRpcDriver.ts'
import type PluginManager from '../PluginManager.ts'
import type { RpcArgs, RpcMethodName, RpcReturn } from './RpcRegistry.ts'
import type { AnyConfigurationModel } from '../configuration/index.ts'

type DriverClass = BaseRpcDriver

interface BackendConfigurations {
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
  backendConfigurations: BackendConfigurations
  driverObjects: Map<string, DriverClass>
  driverFactories: Map<string, RpcDriverFactory>

  constructor(
    pluginManager: PluginManager,
    mainConfiguration: AnyConfigurationModel,
    backendConfigurations: BackendConfigurations,
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
      return (await driverForCall.call(
        this.pluginManager,
        sessionId,
        functionName,
        a,
        opts ?? {},
      )) as M extends RpcMethodName ? RpcReturn<M & RpcMethodName> : unknown
    } finally {
      // when a session is freed, drop its sticky worker assignment on every
      // driver so the workerAssignments map doesn't grow unboundedly
      if (functionName === 'CoreFreeResources') {
        for (const driver of this.driverObjects.values()) {
          driver.freeSession(sessionId)
        }
      }
    }
  }
}
