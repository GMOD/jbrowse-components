import PluginManager from '../PluginManager'
import { readConfObject } from '../configuration'

import rpcConfigSchema from './configSchema'
import WebWorkerRpcDriver from './WebWorkerRpcDriver'
import MainThreadRpcDriver from './MainThreadRpcDriver'
import { AnyConfigurationModel } from '../configuration/configurationSchema'

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

  pluginManager: PluginManager

  mainConfiguration: AnyConfigurationModel

  backendConfigurations: BackendConfigurations

  constructor(
    pluginManager: PluginManager,
    mainConfiguration: AnyConfigurationModel,
    backendConfigurations: BackendConfigurations,
  ) {
    if (!mainConfiguration) {
      throw new Error('RpcManager requires at least a main configuration')
    }
    this.pluginManager = pluginManager
    this.mainConfiguration = mainConfiguration
    this.backendConfigurations = backendConfigurations
    this.driverObjects = new Map()
  }

  getDriver(backendName: keyof typeof DriverClasses) {
    const driver = this.driverObjects.get(backendName)
    if (driver) {
      return driver
    }

    const backendConfiguration = this.backendConfigurations[backendName]
    const DriverClassImpl = DriverClasses[backendName]

    if (!DriverClassImpl) {
      throw new Error(`requested RPC driver "${backendName}" is not installed`)
    }

    if (!backendConfiguration) {
      throw new Error(`requested RPC driver "${backendName}" is missing config`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newDriver = new DriverClassImpl(backendConfiguration as any, {
      plugins: this.pluginManager.runtimePluginDefinitions,
    })
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
    // console.log(sessionId, functionName)
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
