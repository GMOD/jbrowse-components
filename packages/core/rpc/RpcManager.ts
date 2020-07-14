import PluginManager from '../PluginManager'
import { readConfObject } from '../configuration'

import rpcConfigSchema from './configSchema'
import WebWorkerRpcDriver from './WebWorkerRpcDriver'
import MainThreadRpcDriver from './MainThreadRpcDriver'
import ElectronRpcDriver from './ElectronRpcDriver'
import { AnyConfigurationModel } from '../configuration/configurationSchema'
import { PluginDefinition } from '../PluginLoader'

type DriverClass = WebWorkerRpcDriver | MainThreadRpcDriver | ElectronRpcDriver
type BackendConfigurations = {
  WebWorkerRpcDriver?: ConstructorParameters<typeof WebWorkerRpcDriver>[0]
  MainThreadRpcDriver?: ConstructorParameters<typeof MainThreadRpcDriver>[0]
  ElectronRpcDriver?: ConstructorParameters<typeof ElectronRpcDriver>[0]
}
const DriverClasses = {
  WebWorkerRpcDriver,
  MainThreadRpcDriver,
  ElectronRpcDriver,
}

export default class RpcManager {
  static configSchema = rpcConfigSchema

  driverObjects: Map<string, DriverClass>

  pluginManager: PluginManager

  mainConfiguration: AnyConfigurationModel

  backendConfigurations: BackendConfigurations

  runtimePluginDefinitions: PluginDefinition[]

  constructor(
    pluginManager: PluginManager,
    runtimePluginDefinitions: PluginDefinition[] = [],
    mainConfiguration: AnyConfigurationModel,
    backendConfigurations: BackendConfigurations,
  ) {
    if (!mainConfiguration) {
      throw new Error('RpcManager requires at least a main configuration')
    }
    this.pluginManager = pluginManager
    this.runtimePluginDefinitions = runtimePluginDefinitions
    this.mainConfiguration = mainConfiguration
    this.backendConfigurations = backendConfigurations
    this.driverObjects = new Map()
  }

  getDriver(backendName: keyof typeof DriverClasses): DriverClass {
    const driver = this.driverObjects.get(backendName)
    if (driver) return driver

    const backendConfiguration = this.backendConfigurations[backendName]
    const DriverClassImpl = DriverClasses[backendName]

    if (!DriverClassImpl) {
      throw new Error(`requested RPC driver "${backendName}" is not installed`)
    } else if (!backendConfiguration) {
      throw new Error(`requested RPC driver "${backendName}" is missing config`)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newDriver = new DriverClassImpl(backendConfiguration as any, {
      plugins: this.runtimePluginDefinitions,
    })
    this.driverObjects.set(backendName, newDriver)
    return newDriver
  }

  getDriverForCall(sessionId: string, functionName: string, args: unknown) {
    // TODO: add logic here so different sessions can have
    // different RPC backends configured

    // otherwise, if there is no specific backend for that session, use the default one
    const backendName = readConfObject(this.mainConfiguration, 'defaultDriver')

    return this.getDriver(backendName)
  }

  async call(sessionId: string, functionName: string, args: {}, opts = {}) {
    // console.log(sessionId, functionName)
    if (!sessionId) {
      throw new Error('sessionId is required')
    }
    return this.getDriverForCall(sessionId, functionName, args).call(
      this.pluginManager,
      sessionId,
      functionName,
      args,
      opts,
    )
  }
}
