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
  WebWorkerRpcDriver?: Omit<
    ConstructorParameters<typeof WebWorkerRpcDriver>[0],
    'config'
  >
  MainThreadRpcDriver?: Omit<
    ConstructorParameters<typeof MainThreadRpcDriver>[0],
    'config'
  >
  ElectronRpcDriver?: Omit<
    ConstructorParameters<typeof ElectronRpcDriver>[0],
    'config'
  >
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

  getDriver(driverName: string): DriverClass {
    const driverConfig = this.mainConfiguration.drivers.get(driverName)
    if (!driverConfig) {
      throw new Error(`could not find driver config for "${driverName}"`)
    }
    const driver = this.driverObjects.get(driverName)
    if (driver) return driver

    // a bit verbose, but it keeps TypeScript happy
    let newDriver
    const backendName = driverConfig.type as keyof typeof DriverClasses
    if (backendName === 'MainThreadRpcDriver') {
      const backendConfiguration = this.backendConfigurations
        .MainThreadRpcDriver
      if (!backendConfiguration) {
        throw new Error(
          `requested RPC driver "${backendName}" is missing config`,
        )
      }
      const DriverClass = DriverClasses[backendName]
      newDriver = new DriverClass({
        ...backendConfiguration,
        config: driverConfig,
      })
    } else if (backendName === 'ElectronRpcDriver') {
      const backendConfiguration = this.backendConfigurations.ElectronRpcDriver
      if (!backendConfiguration) {
        throw new Error(
          `requested RPC driver "${backendName}" is missing config`,
        )
      }
      const DriverClass = DriverClasses[backendName]
      newDriver = new DriverClass(
        { ...backendConfiguration, config: driverConfig },
        { plugins: this.runtimePluginDefinitions },
      )
    } else if (backendName === 'WebWorkerRpcDriver') {
      const backendConfiguration = this.backendConfigurations.WebWorkerRpcDriver
      if (!backendConfiguration) {
        throw new Error(
          `requested RPC driver "${backendName}" is missing config`,
        )
      }
      const DriverClass = DriverClasses[backendName]
      newDriver = new DriverClass(
        { ...backendConfiguration, config: driverConfig },
        { plugins: this.runtimePluginDefinitions },
      )
    } else {
      throw new Error(`requested RPC driver "${backendName}" is not installed`)
    }

    this.driverObjects.set(driverName, newDriver)
    return newDriver
  }

  getDriverForCall(
    _sessionId: string,
    _functionName: string,
    args: { rpcDriverName?: string },
  ) {
    const driverName =
      args.rpcDriverName ||
      readConfObject(this.mainConfiguration, 'defaultDriver')

    return this.getDriver(driverName)
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
