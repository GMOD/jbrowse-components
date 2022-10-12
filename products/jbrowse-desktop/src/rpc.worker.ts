/* eslint-disable no-restricted-globals */
import './workerPolyfill'

import RpcServer from 'librpc-web-mod'
import { enableStaticRendering } from 'mobx-react'

import PluginManager from '@jbrowse/core/PluginManager'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { remoteAbortRpcHandler } from '@jbrowse/core/rpc/remoteAbortSignals'
import PluginLoader, { PluginDefinition } from '@jbrowse/core/PluginLoader'
import corePlugins from './corePlugins'

// prevent mobx-react from doing funny things when we render in the worker.
// but only if we are running in the browser.  in node tests, leave it alone.
if (typeof __webpack_require__ === 'function') {
  enableStaticRendering(true)
}

interface WorkerConfiguration {
  plugins: PluginDefinition[]
  windowHref: string
}

let jbPluginManager: PluginManager | undefined

// waits for a message from the main thread containing our configuration, which
// must be sent on boot
function receiveConfiguration(): Promise<WorkerConfiguration> {
  const configurationP: Promise<WorkerConfiguration> = new Promise(resolve => {
    // listen for the configuration
    self.onmessage = (event: MessageEvent) => {
      resolve(event.data as WorkerConfiguration)
      self.onmessage = () => {}
    }
  })
  postMessage('readyForConfig')
  return configurationP
}

async function getPluginManager() {
  if (jbPluginManager) {
    return jbPluginManager
  }
  // Load runtime plugins
  const config = await receiveConfiguration()
  const pluginLoader = new PluginLoader(config.plugins, {
    fetchESM: url => import(/* webpackIgnore:true */ url),
  })
  pluginLoader.installGlobalReExports(self)
  const runtimePlugins = await pluginLoader.load(config.windowHref)
  const plugins = [...corePlugins.map(p => ({ plugin: p })), ...runtimePlugins]
  const pluginManager = new PluginManager(plugins.map(P => new P.plugin()))
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

type RpcFunc = (args: unknown, rpcDriverClassName: string) => unknown

function wrapForRpc(func: RpcFunc) {
  return (args: WrappedFuncArgs) => {
    const { channel, rpcDriverClassName } = args
    return func(
      {
        ...args,
        statusCallback: (message: string) => {
          // @ts-ignore
          self.rpcServer.emit(channel, message)
        },
      },
      rpcDriverClassName,
    )
  }
}

getPluginManager()
  .then(pluginManager => {
    const rpcConfig = Object.fromEntries(
      pluginManager.getElementTypesInGroup('rpc method').map(entry => {
        const { execute, name } = entry as RpcMethodType
        return [name, wrapForRpc((execute as RpcFunc).bind(entry))]
      }),
    )

    // @ts-ignore
    self.rpcServer = new RpcServer.Server({
      ...rpcConfig,
      ...remoteAbortRpcHandler(),
      ping: () => {}, // < the ping method is required by the worker driver for checking the health of the worker
    })
    postMessage('ready')
  })
  .catch(error => {
    // @ts-ignore
    self.rpcServer = new RpcServer.Server({
      ping: () => {
        throw error
      },
    })
  })
