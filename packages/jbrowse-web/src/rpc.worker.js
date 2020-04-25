/* eslint-disable no-restricted-globals */
import './workerPolyfill'

import RpcServer from '@librpc/web'
import { useStaticRendering } from 'mobx-react'

import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { remoteAbortRpcHandler } from '@gmod/jbrowse-core/rpc/remoteAbortSignals'
import { isAbortException } from '@gmod/jbrowse-core/util'
import * as rpcMethods from './rpcMethods'
import corePlugins from './corePlugins'

// prevent mobx-react from doing funny things when we render in the worker.
// but only if we are running in the browser.  in node tests, leave it alone.
// eslint-disable-next-line @typescript-eslint/camelcase,react-hooks/rules-of-hooks
if (typeof __webpack_require__ === 'function') useStaticRendering(true)

let jbPluginManager

async function getPluginManager() {
  if (jbPluginManager) {
    return jbPluginManager
  }
  // TODO: Runtime plugins
  // Loading runtime plugins will look something like this
  // const pluginLoader = new PluginLoader(config.plugins)
  // const runtimePlugins = await pluginLoader.load()
  // const plugins = [...corePlugins, ...runtimePlugins]
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  pluginManager.configure()
  jbPluginManager = pluginManager
  return pluginManager
}

const logBuffer = []
function flushLog() {
  if (logBuffer.length) {
    for (const l of logBuffer) {
      const [head, ...rest] = l
      if (head === 'rpc-error') {
        console.error(head, ...rest)
      } else {
        // eslint-disable-next-line no-console
        console.log(head, ...rest)
      }
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
    // logBuffer.push(['rpc-call', myId, func.name, args])
    const retP = Promise.resolve()
      .then(() => getPluginManager())
      .then(pluginManager => func(pluginManager, args))
      .catch(error => {
        if (isAbortException(error)) {
          // logBuffer.push(['rpc-abort', myId, func.name, args])
        } else {
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

Object.keys(rpcMethods).forEach(key => {
  rpcConfig[key] = wrapForRpc(rpcMethods[key])
})

self.rpcServer = new RpcServer.Server({
  ...rpcConfig,
  ...remoteAbortRpcHandler(),
  ping: () => {}, // < the ping method is required by the worker driver for checking the health of the worker
})
