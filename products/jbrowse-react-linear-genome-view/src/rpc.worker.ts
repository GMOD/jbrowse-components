/* eslint-disable no-restricted-globals */
import './workerPolyfill'

// @ts-ignore
import RpcServer from 'librpc-web-mod'
import { enableStaticRendering } from 'mobx-react'

import PluginManager from '@jbrowse/core/PluginManager'
import { remoteAbortRpcHandler } from '@jbrowse/core/rpc/remoteAbortSignals'
import PluginLoader, { PluginDefinition } from '@jbrowse/core/PluginLoader'
import { serializeError } from 'serialize-error'

// locals
import corePlugins from './corePlugins'

// static rendering is used for "SSR" style rendering which is done on the
// worker
enableStaticRendering(true)

interface WorkerConfiguration {
  plugins: PluginDefinition[]
  windowHref: string
}

// waits for a message from the main thread containing our configuration, which
// must be sent on boot
function receiveConfiguration() {
  const configurationP: Promise<WorkerConfiguration> = new Promise(resolve => {
    function listener(event: MessageEvent) {
      if (event.data.message === 'config') {
        resolve(event.data.config as WorkerConfiguration)
        removeEventListener('message', listener)
      }
    }
    self.addEventListener('message', listener)
  })
  postMessage({ message: 'readyForConfig' })
  return configurationP
}

async function getPluginManager() {
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
      pluginManager
        .getRpcElements()
        .map(entry => [entry.name, wrapForRpc(entry.execute.bind(entry))]),
    )

    // @ts-ignore
    self.rpcServer = new RpcServer.Server({
      ...rpcConfig,
      ...remoteAbortRpcHandler(),
      ping: () => {
        // the ping method is required by the worker driver for checking the
        // health of the worker
      },
    })
    postMessage({ message: 'ready' })
  })
  .catch(error => {
    postMessage({ message: 'error', error: serializeError(error) })
  })

export default () => {
  /* do nothing */
}
