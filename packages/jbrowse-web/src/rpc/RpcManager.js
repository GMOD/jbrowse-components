import { decorate, observable } from 'mobx'
import { readConfObject } from '../configuration'

import WebWorkerRpcDriver from './WebWorkerRpcDriver'

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
  constructor(mainConfiguration, backendConfigurations = {}) {
    if (!mainConfiguration)
      throw new Error('RpcManager requires at least a main configuration')

    this.mainConfiguration = mainConfiguration
    this.backendConfigurations = backendConfigurations
  }

  getDriver(backendName) {
    const backendConfiguration = this.backendConfigurations[backendName]
    const DriverClass = {
      WebWorkerRpcDriver,
      //     MainThreadRpcDriver,
    }[backendName]
    if (!DriverClass) {
      throw new Error(
        `no RPC driver registered for RPC backend "${backendName}"`,
      )
    }
    return new DriverClass(backendConfiguration)
  }

  getDriverForCall(/* stateGroupName, functionName, args */) {
    // TODO: add logic here so different sessions can have
    // different RPC backends configured

    // otherwise, if there is no specific backend for that session, use the default one
    const backendName = readConfObject(this.mainConfiguration, 'defaultDriver')

    return this.getDriver(backendName)
  }

  call(stateGroupName, functionName, args) {
    return this.getDriverForCall(stateGroupName, functionName, args).call(
      stateGroupName,
      functionName,
      args,
    )
  }
}

decorate(RpcManager, {
  mainConfiguration: observable,
  backendConfigurations: observable,
})

export default RpcManager
