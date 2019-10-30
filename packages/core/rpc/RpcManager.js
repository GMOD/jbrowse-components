import { getSnapshot, isStateTreeNode, isAlive } from 'mobx-state-tree'
import { readConfObject } from '../configuration'

import rpcConfigSchema from './configSchema'
import WebWorkerRpcDriver from './WebWorkerRpcDriver'
import MainThreadRpcDriver from './MainThreadRpcDriver'
import ElectronRpcDriver from './ElectronRpcDriver'

/*
 requirements

 multiple web workers, divide tracks among them
 main-thread driver
 server-side workers, divide tracks among them

 single worker per worker driver
 single server per server driver

 configuration assigns track to a group, then
 assigns it stably to a worker according to the session ID
*/

class RpcManager {
  static configSchema = rpcConfigSchema

  driverObjects = {}

  constructor(
    pluginManager,
    mainConfiguration,
    backendConfigurations = {},
    getRefNameMapForAdapter = () => {},
  ) {
    if (!mainConfiguration) {
      throw new Error('RpcManager requires at least a main configuration')
    }
    this.pluginManager = pluginManager
    this.mainConfiguration = mainConfiguration
    // try {
    //   this.getDriverForCall()
    // } catch(e) {
    //   debugger
    // }
    this.backendConfigurations = backendConfigurations
    this.getRefNameMapForAdapter = getRefNameMapForAdapter
  }

  getDriver(backendName) {
    if (!this.driverObjects[backendName]) {
      const backendConfiguration = this.backendConfigurations[backendName]
      const DriverClass = {
        WebWorkerRpcDriver,
        MainThreadRpcDriver,
        ElectronRpcDriver,
      }[backendName]
      if (!DriverClass) {
        throw new Error(
          `requested RPC driver "${backendName}" is not installed`,
        )
      }

      this.driverObjects[backendName] = new DriverClass(backendConfiguration)
    }
    return this.driverObjects[backendName]
  }

  getDriverForCall(/* stateGroupName, functionName, args */) {
    // TODO: add logic here so different sessions can have
    // different RPC backends configured

    // otherwise, if there is no specific backend for that session, use the default one
    const backendName = readConfObject(this.mainConfiguration, 'defaultDriver')

    return this.getDriver(backendName)
  }

  renameRegionIfNeeded(refNameMap, container, keyForRegion) {
    let region = container[keyForRegion]
    if (isStateTreeNode(region) && !isAlive(region)) return
    if (region && refNameMap && refNameMap.has(region.refName)) {
      // clone the region so we don't modify it
      if (isStateTreeNode(region)) region = { ...getSnapshot(region) }
      else region = { ...region }

      // modify it directly in the container
      region.refName = refNameMap.get(region.refName)
      container[keyForRegion] = region
    }
  }

  async call(stateGroupName, functionName, args, opts = {}) {
    const { assemblyName, signal, regions, adapterConfig } = args

    // TODO: this renaming stuff should probably be moved to the session model
    // when we have a session model
    if (assemblyName) {
      const refNameMap = await this.getRefNameMapForAdapter(
        adapterConfig,
        assemblyName,
        { signal },
      )

      this.renameRegionIfNeeded(refNameMap, args, 'region')

      if (regions) {
        regions.forEach((r, index) => {
          this.renameRegionIfNeeded(refNameMap, regions, index)
        })
      }
    }
    return this.getDriverForCall(stateGroupName, functionName, args).call(
      this.pluginManager,
      stateGroupName,
      functionName,
      args,
      opts,
    )
  }
}

export default RpcManager
