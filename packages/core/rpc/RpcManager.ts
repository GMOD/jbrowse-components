import { readConfObject } from '../configuration'
import MainThreadRpcDriver from './MainThreadRpcDriver'
import WebWorkerRpcDriver from './WebWorkerRpcDriver'
import rpcConfigSchema from './configSchema'

import type BaseRpcDriver from './BaseRpcDriver'
import type PluginManager from '../PluginManager'
import type { AnyConfigurationModel } from '../configuration'

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

export default class RpcManager {
  static configSchema = rpcConfigSchema

  driverObjects: Map<string, DriverClass>
  driverFactories: Map<string, RpcDriverFactory>

  constructor(
    public pluginManager: PluginManager,
    public mainConfiguration: AnyConfigurationModel,
    public backendConfigurations: BackendConfigurations,
  ) {
    this.driverObjects = new Map()
    this.driverFactories = new Map()

    // Register built-in drivers
    this.registerDriverFactory(
      'MainThreadRpcDriver',
      (config, backendConfig) =>
        new MainThreadRpcDriver({
          ...(backendConfig as ConstructorParameters<
            typeof MainThreadRpcDriver
          >[0]),
          config,
        }),
    )
    this.registerDriverFactory(
      'WebWorkerRpcDriver',
      (config, backendConfig, pm) =>
        new WebWorkerRpcDriver(
          {
            ...(backendConfig as ConstructorParameters<
              typeof WebWorkerRpcDriver
            >[0]),
            config,
          },
          {
            plugins: pm.runtimePluginDefinitions,
            windowHref:
              typeof window !== 'undefined' ? window.location.href : '',
          },
        ),
    )
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

    const config = this.mainConfiguration.drivers.get('WebWorkerRpcDriver')
    const newDriver = factory(config, backendConfig, this.pluginManager)
    this.driverObjects.set(backendName, newDriver)
    return newDriver
  }

  async getDriverForCall(
    _sessionId: string,
    _functionName: string,
    args: { rpcDriverName?: string },
  ) {
    const backendName =
      args.rpcDriverName ||
      readConfObject(this.mainConfiguration, 'defaultDriver')

    return this.getDriver(backendName)
  }

  async call(
    sessionId: string,
    functionName: string,
    args: Record<string, unknown>,
    opts = {},
  ) {
    if (!sessionId) {
      throw new Error('sessionId is required')
    }
    const driverForCall = await this.getDriverForCall(
      sessionId,
      functionName,
      args,
    )
    return driverForCall.call(
      this.pluginManager,
      sessionId,
      functionName,
      args,
      opts,
    )
  }
}
