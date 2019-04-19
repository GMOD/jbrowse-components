import './workerPolyfill'

import RpcServer from '@librpc/web'
import { useStaticRendering } from 'mobx-react'

import PluginManager from './PluginManager'
import corePlugins from './corePlugins'

import * as renderFuncs from './render'
import { remoteAbortRpcHandler } from './rpc/remoteAbortSignals'
import { isAbortException } from './util'

// prevent mobx-react from doing funny things when we render in the worker
useStaticRendering(true)

const jbPluginManager = new PluginManager(corePlugins.map(P => new P()))
jbPluginManager.configure()

const logBuffer = []
function flushLog() {
  if (logBuffer.length) {
    for (const l of logBuffer) {
      console.log(...l)
    }
    logBuffer.length = 0
  }
}
setInterval(flushLog, 1000)

let callCounter = 0
function wrapForRpc(func) {
  return args => {
    callCounter += 1
    const myId = callCounter
    // logBuffer.push(['rpc-call', myId, func.name, ...args])
    const retP = func(jbPluginManager, ...args).catch(error => {
      if (isAbortException(error)) {
        logBuffer.push(['rpc-abort', myId, func.name, ...args])
      } else {
        console.error(error)
        logBuffer.push(['rpc-error', myId, func.name, error])
        flushLog()
      }
      throw error
    })

    // uncomment below to log returns
    // retP.then(
    //   result => logBuffer.push(['rpc-return', myId, func.name, result]),
    //   err => {},
    // )

    return retP
  }
}

const rpcConfig = {}

Object.keys(renderFuncs).forEach(key => {
  rpcConfig[key] = wrapForRpc(renderFuncs[key])
})

// eslint-disable-next-line no-restricted-globals
self.rpcServer = new RpcServer.Server({
  ...rpcConfig,
  ...remoteAbortRpcHandler(),
})
