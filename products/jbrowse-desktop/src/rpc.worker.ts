/* eslint-disable no-restricted-globals, react-hooks/rules-of-hooks */
import './workerPolyfill'

import RpcServer from 'librpc-web-mod'
import { useStaticRendering } from 'mobx-react'

import PluginManager from '@jbrowse/core/PluginManager'
import { remoteAbortRpcHandler } from '@jbrowse/core/rpc/remoteAbortSignals'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import PluginLoader, { PluginDefinition } from '@jbrowse/core/PluginLoader'
import corePlugins from './corePlugins'

// prevent mobx-react from doing funny things when we render in the worker.
// but only if we are running in the browser.  in node tests, leave it alone.
if (typeof __webpack_require__ === 'function') {
  useStaticRendering(true)
}

interface WorkerConfiguration {
  plugins: PluginDefinition[]
}

let jbPluginManager: PluginManager | undefined

// waits for a message from the main thread containing our configuration,
// which must be sent on boot
function receiveConfiguration(): Promise<WorkerConfiguration> {
  return new Promise(resolve => {
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
  const pluginLoader = new PluginLoader(config.plugins)
  pluginLoader.installGlobalReExports(self)
  const runtimePlugins = await pluginLoader.load()
  const plugins = [...corePlugins.map(p => ({ plugin: p })), ...runtimePlugins]
  const pluginManager = new PluginManager(
    plugins.map(({ plugin: P }) => new P()),
  )
  pluginManager.createPluggableElements()
  pluginManager.configure()
  jbPluginManager = pluginManager
  return pluginManager
}

interface WrappedFuncArgs {
  rpcDriverClassName: string
  channel: string
  [key: string]: unknown
}

function wrapForRpc(
  func: (args: unknown, rpcDriverClassName: string) => unknown,
) {
  return (args: WrappedFuncArgs) => {
    return func(
      {
        ...args,
        statusCallback: (message: string) => {
          // @ts-ignore
          self.rpcServer.emit(args.channel, message)
        },
      },
      args.rpcDriverClassName,
    )
  }
}

getPluginManager()
  .then(pluginManager => {
    const rpcConfig: { [methodName: string]: Function } = {}
    const rpcMethods = pluginManager.getElementTypesInGroup('rpc method')
    rpcMethods.forEach(rpcMethod => {
      if (!(rpcMethod instanceof RpcMethodType)) {
        throw new Error('invalid rpc method??')
      }

      rpcConfig[rpcMethod.name] = wrapForRpc(rpcMethod.execute.bind(rpcMethod))
    })

    // @ts-ignore
    self.rpcServer = new RpcServer.Server({
      ...rpcConfig,
      ...remoteAbortRpcHandler(),
      ping: () => {}, // < the ping method is required by the worker driver for checking the health of the worker
    })
  })
  .catch(error => {
    // @ts-ignore
    self.rpcServer = new RpcServer.Server({
      ping: () => {
        throw error
      },
    })
  })
