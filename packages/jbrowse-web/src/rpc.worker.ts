/* eslint-disable no-restricted-globals, no-console, @typescript-eslint/camelcase, react-hooks/rules-of-hooks */
import './workerPolyfill'

import RpcServer from '@librpc/web'
import { useStaticRendering } from 'mobx-react'

import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { remoteAbortRpcHandler } from '@gmod/jbrowse-core/rpc/remoteAbortSignals'
import { isAbortException } from '@gmod/jbrowse-core/util'
import RpcMethodType from '@gmod/jbrowse-core/pluggableElementTypes/RpcMethodType'
import PluginLoader, { PluginDefinition } from '@gmod/jbrowse-core/PluginLoader'
import corePlugins from './corePlugins'

// prevent mobx-react from doing funny things when we render in the worker.
// but only if we are running in the browser.  in node tests, leave it alone.
// @ts-ignore
if (typeof __webpack_require__ === 'function') useStaticRendering(true)

interface WorkerConfiguration {
  plugins: PluginDefinition[]
}

let jbPluginManager: PluginManager | undefined

// waits for a message from the main thread containing our configuration,
// which must be sent on boot
function receiveConfiguration(): Promise<WorkerConfiguration> {
  return new Promise((resolve, reject) => {
    // listen for the configuration
    self.onmessage = (event: MessageEvent) => {
      resolve(event.data as WorkerConfiguration)
      self.onmessage = () => {}
    }
  })
}

async function getPluginManager() {
  if (jbPluginManager) {
    return jbPluginManager
  }
  // Load runtime plugins
  const config = await receiveConfiguration()
  // console.log('got worker boot config', config)
  const pluginLoader = new PluginLoader(config.plugins)
  pluginLoader.installGlobalReExports(self.window)
  const runtimePlugins = await pluginLoader.load()
  const plugins = [...corePlugins, ...runtimePlugins]
  const pluginManager = new PluginManager(plugins.map(P => new P()))
  pluginManager.createPluggableElements()
  pluginManager.configure()
  jbPluginManager = pluginManager
  return pluginManager
}

const logBuffer: [string, ...unknown[]][] = []
function flushLog() {
  if (logBuffer.length) {
    for (const l of logBuffer) {
      const [head, ...rest] = l
      if (head === 'rpc-error') {
        console.error(head, ...rest)
      } else {
        console.log(head, ...rest)
      }
    }
    logBuffer.length = 0
  }
}
setInterval(flushLog, 1000)

let callCounter = 0
function wrapForRpc(
  func: (args: unknown) => unknown,
  funcName: string = func.name,
) {
  return (args: unknown) => {
    callCounter += 1
    const myId = callCounter
    // logBuffer.push(['rpc-call', myId, funcName, args])
    const retP = Promise.resolve()
      .then(() => getPluginManager())
      .then(pluginManager => func(args))
      .catch(error => {
        if (isAbortException(error)) {
          // logBuffer.push(['rpc-abort', myId, funcName, args])
        } else {
          logBuffer.push(['rpc-error', myId, funcName, error])
          flushLog()
        }
        throw error
      })

    // uncomment below to log returns
    // retP.then(
    //   result => logBuffer.push(['rpc-return', myId, funcName, result]),
    //   err => {},
    // )

    return retP
  }
}

getPluginManager()
  .then(pluginManager => {
    const rpcConfig: { [methodName: string]: Function } = {}
    const rpcMethods = pluginManager.getElementTypesInGroup('rpc method')
    rpcMethods.forEach(rpcMethod => {
      if (!(rpcMethod instanceof RpcMethodType))
        throw new Error('invalid rpc method??')

      rpcConfig[rpcMethod.name] = wrapForRpc(
        rpcMethod.execute.bind(rpcMethod),
        rpcMethod.name,
      )
    })

    // @ts-ignore
    self.rpcServer = new RpcServer.Server({
      ...rpcConfig,
      ...remoteAbortRpcHandler(),
      ping: () => {}, // < the ping method is required by the worker driver for checking the health of the worker
    })
  })
  .catch(error => {
    console.error('Worker failed to start:')
    console.error(error)
  })
