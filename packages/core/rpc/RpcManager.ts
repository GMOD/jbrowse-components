import { getSnapshot, isStateTreeNode, isAlive } from 'mobx-state-tree'
import PluginManager from '../PluginManager'
import { readConfObject } from '../configuration'

import rpcConfigSchema from './configSchema'
import WebWorkerRpcDriver from './WebWorkerRpcDriver'
import MainThreadRpcDriver from './MainThreadRpcDriver'
import ElectronRpcDriver from './ElectronRpcDriver'
import { AnyConfigurationModel } from '../configuration/configurationSchema'
import { IRegion } from '../mst-types'

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

class RpcManager {
  static configSchema = rpcConfigSchema

  driverObjects: Map<string, DriverClass>

  pluginManager: PluginManager

  mainConfiguration: AnyConfigurationModel

  backendConfigurations: BackendConfigurations

  getRefNameMapForAdapter: Function

  constructor(
    pluginManager: PluginManager,
    mainConfiguration: AnyConfigurationModel,
    backendConfigurations: BackendConfigurations,
    getRefNameMapForAdapter = async () => {},
  ) {
    if (!mainConfiguration) {
      throw new Error('RpcManager requires at least a main configuration')
    }
    this.pluginManager = pluginManager
    this.mainConfiguration = mainConfiguration
    this.backendConfigurations = backendConfigurations
    this.getRefNameMapForAdapter = getRefNameMapForAdapter
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
    const newDriver = new DriverClassImpl(backendConfiguration as any)
    this.driverObjects.set(backendName, newDriver)
    return newDriver
  }

  getDriverForCall(
    stateGroupName: string,
    functionName: string,
    args: unknown,
  ) {
    // TODO: add logic here so different sessions can have
    // different RPC backends configured

    // otherwise, if there is no specific backend for that session, use the default one
    const backendName = readConfObject(this.mainConfiguration, 'defaultDriver')

    return this.getDriver(backendName)
  }

  renameRegionIfNeeded(refNameMap: Map<string, string>, region: IRegion) {
    if (isStateTreeNode(region) && !isAlive(region)) {
      return region
    }
    if (region && refNameMap && refNameMap.has(region.refName)) {
      // clone the region so we don't modify it
      if (isStateTreeNode(region)) {
        region = { ...getSnapshot(region) }
      } else {
        region = { ...region }
      }

      // modify it directly in the container
      const newRef = refNameMap.get(region.refName)
      if (newRef) {
        region.refName = newRef
      }
    }
    return region
  }

  async call(
    stateGroupName: string,
    functionName: string,
    args: {
      assemblyName?: string
      signal?: AbortSignal
      regions?: IRegion[]
      region?: IRegion
      adapterConfig: unknown
    },
    opts = {},
  ) {
    const { assemblyName, signal, regions, region, adapterConfig } = args
    const newArgs: typeof args & {
      originalRegion?: IRegion
      originalRegions?: IRegion[]
    } = {
      ...args,
      regions: [...(args.regions || [])],
    }
    if (assemblyName) {
      const refNameMap = await this.getRefNameMapForAdapter(
        adapterConfig,
        assemblyName,
        { signal },
      )

      if (regions && newArgs.regions) {
        for (let i = 0; i < regions.length; i += 1) {
          newArgs.originalRegions = args.regions
          newArgs.regions[i] =
            this.renameRegionIfNeeded(refNameMap, regions[i]) || regions[i]
        }
      }
    }
    return this.getDriverForCall(stateGroupName, functionName, newArgs).call(
      this.pluginManager,
      stateGroupName,
      functionName,
      newArgs,
      opts,
    )
  }
}

export default RpcManager
