import { decorate, observable } from 'mobx'
import { isStateTreeNode, isAlive } from 'mobx-state-tree'
import { readConfObject } from '../configuration'

import rpcConfigSchema from './configSchema'
import WebWorkerRpcDriver from './WebWorkerRpcDriver'
import MainThreadRpcDriver from './MainThreadRpcDriver'

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
    this.backendConfigurations = backendConfigurations
    this.getRefNameMapForAdapter = getRefNameMapForAdapter
  }

  getDriver(backendName) {
    if (!this.driverObjects[backendName]) {
      const backendConfiguration = this.backendConfigurations[backendName]
      const DriverClass = {
        WebWorkerRpcDriver,
        MainThreadRpcDriver,
      }[backendName]
      if (!DriverClass) {
        throw new Error(
          `requested RPC driver "${backendName}" is not installed`,
        )
      }

      this.driverObjects[backendName] = new DriverClass(
        this.pluginManager,
        backendConfiguration,
      )
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

  async call(stateGroupName, functionName, ...args) {
    const { assemblyName, signal } = args[0]
    if (assemblyName) {
      const { region } = args[0]
      const { refName } = region
      const refNameMap = await this.getRefNameMapForAdapter(
        args[0].adapterConfig,
        assemblyName,
        { signal },
      )
      if (refNameMap && refNameMap.has(refName)) {
        if (isStateTreeNode(region) && isAlive(region)) {
          region.setRefName(refNameMap.get(refName))
        } else {
          args[0].region.refName = refNameMap.get(refName)
        }
      }
    }
    return this.getDriverForCall(stateGroupName, functionName, args).call(
      this.pluginManager,
      stateGroupName,
      functionName,
      args,
      { signal },
    )
  }
}

decorate(RpcManager, {
  mainConfiguration: observable,
  backendConfigurations: observable,
})

export default RpcManager
