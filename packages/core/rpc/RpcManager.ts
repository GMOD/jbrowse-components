import PluginManager from '../PluginManager'
import { readConfObject, AnyConfigurationModel } from '../configuration'
import rpcConfigSchema from './configSchema'
import WebWorkerRpcDriver from './WebWorkerRpcDriver'
import MainThreadRpcDriver from './MainThreadRpcDriver'

type DriverClass = WebWorkerRpcDriver | MainThreadRpcDriver
type BackendConfigurations = {
  WebWorkerRpcDriver?: Omit<
    ConstructorParameters<typeof WebWorkerRpcDriver>[0],
    'config'
  >
  MainThreadRpcDriver?: Omit<
    ConstructorParameters<typeof MainThreadRpcDriver>[0],
    'config'
  >
}
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
    if (!mainConfiguration) {
      throw new Error('RpcManager requires at least a main configuration')
    }
    this.driverObjects = new Map()
  }

  getDriver(backendName: keyof typeof DriverClasses) {
    const driver = this.driverObjects.get(backendName)
    if (driver) {
      return driver
    }
    let newDriver
    const config = this.mainConfiguration.drivers.get('WebWorkerRpcDriver')
    if (backendName === 'MainThreadRpcDriver') {
      const backendConfiguration =
        this.backendConfigurations.MainThreadRpcDriver

      if (!backendConfiguration) {
        throw new Error(
          `requested RPC driver "${backendName}" is missing config`,
        )
      }
      newDriver = new MainThreadRpcDriver({ ...backendConfiguration, config })
    } else if (backendName === 'WebWorkerRpcDriver') {
      const backendConfiguration = this.backendConfigurations.WebWorkerRpcDriver
      if (!backendConfiguration) {
        throw new Error(
          `requested RPC driver "${backendName}" is missing config`,
        )
      }
      newDriver = new WebWorkerRpcDriver(
        { ...backendConfiguration, config },
        {
          plugins: this.pluginManager.runtimePluginDefinitions,
          windowHref: window.location.href,
        },
      )
    } else {
      throw new Error(`requested RPC driver "${backendName}" is not installed`)
    }
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

  async call(sessionId: string, functionName: string, args: {}, opts = {}) {
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
