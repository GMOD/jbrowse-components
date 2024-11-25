import { readConfObject } from '../configuration'
import MainThreadRpcDriver from './MainThreadRpcDriver'
import WebWorkerRpcDriver from './WebWorkerRpcDriver'
import rpcConfigSchema from './configSchema'
import type PluginManager from '../PluginManager'
import type { AnyConfigurationModel } from '../configuration'

type DriverClass = WebWorkerRpcDriver | MainThreadRpcDriver
interface BackendConfigurations {
  WebWorkerRpcDriver?: Omit<
    ConstructorParameters<typeof WebWorkerRpcDriver>[0],
    'config'
  >
  MainThreadRpcDriver?: Omit<
    ConstructorParameters<typeof MainThreadRpcDriver>[0],
    'config'
  >
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DriverClasses = {
  WebWorkerRpcDriver,
  MainThreadRpcDriver,
}

export default class RpcManager {
  static configSchema = rpcConfigSchema

  driverObjects: Map<string, DriverClass>

  constructor(
    public pluginManager: PluginManager,
    public mainConfiguration: AnyConfigurationModel,
    public backendConfigurations: BackendConfigurations,
  ) {
    this.driverObjects = new Map()
  }

  getDriver(backendName: keyof typeof DriverClasses) {
    const driver = this.driverObjects.get(backendName)
    if (driver) {
      return driver
    }
    const config = this.mainConfiguration.drivers.get('WebWorkerRpcDriver')
    if (backendName === 'MainThreadRpcDriver') {
      const backendConfiguration =
        this.backendConfigurations.MainThreadRpcDriver

      if (!backendConfiguration) {
        throw new Error(
          `requested RPC driver "${backendName}" is missing config`,
        )
      }
      const newDriver = new MainThreadRpcDriver({
        ...backendConfiguration,
        config,
      })
      this.driverObjects.set(backendName, newDriver)
      return newDriver
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    else if (backendName === 'WebWorkerRpcDriver') {
      const backendConfiguration = this.backendConfigurations.WebWorkerRpcDriver
      if (!backendConfiguration) {
        throw new Error(
          `requested RPC driver "${backendName}" is missing config`,
        )
      }
      const newDriver = new WebWorkerRpcDriver(
        { ...backendConfiguration, config },
        {
          plugins: this.pluginManager.runtimePluginDefinitions,
          windowHref: window.location.href,
        },
      )
      this.driverObjects.set(backendName, newDriver)
      return newDriver
    } else {
      throw new Error(`requested RPC driver "${backendName}" is not installed`)
    }
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
