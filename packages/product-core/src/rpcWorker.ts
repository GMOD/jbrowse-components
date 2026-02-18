import PluginLoader from '@jbrowse/core/PluginLoader'
import PluginManager from '@jbrowse/core/PluginManager'
import { RpcServer, serializeError } from '@jbrowse/core/util/librpc'

import type { PluginConstructor } from '@jbrowse/core/Plugin'
import type { LoadedPlugin, PluginDefinition } from '@jbrowse/core/PluginLoader'

declare global {
  interface Window {
    rpcServer?: RpcServer
  }
}

interface WorkerConfiguration {
  plugins: PluginDefinition[]
  windowHref: string
}

// waits for a message from the main thread containing our configuration, which
// must be sent on boot
function receiveConfiguration() {
  const configurationP = new Promise<WorkerConfiguration>(resolve => {
    function listener(e: MessageEvent) {
      if (e.data.message === 'config') {
        resolve(e.data.config as WorkerConfiguration)
        removeEventListener('message', listener)
      }
    }
    self.addEventListener('message', listener)
  })
  postMessage({ message: 'readyForConfig' })
  return configurationP
}

async function getPluginManager(
  corePlugins: PluginConstructor[],
  opts: { fetchESM?: (url: string) => Promise<LoadedPlugin> },
) {
  // Load runtime plugins
  const config = await receiveConfiguration()
  const pluginLoader = new PluginLoader(
    config.plugins,
    opts,
  ).installGlobalReExports(self)
  return new PluginManager(
    [
      ...corePlugins.map(p => ({ plugin: p })),
      ...(await pluginLoader.load(config.windowHref)),
    ].map(P => new P.plugin()),
  )
    .createPluggableElements()
    .configure()
}

interface WrappedFuncArgs {
  rpcDriverClassName: string
  channel: string
  [key: string]: unknown
}

type RpcFunc = (args: unknown, rpcDriverClassName: string) => Promise<unknown>

function wrapForRpc(func: RpcFunc) {
  return (args: unknown) => {
    const wrappedArgs = args as WrappedFuncArgs
    const { channel, rpcDriverClassName } = wrappedArgs
    return func(
      {
        ...wrappedArgs,
        statusCallback: (message: string) => {
          self.rpcServer?.emit(channel, message)
        },
      },
      rpcDriverClassName,
    )
  }
}

export async function initializeWorker(
  corePlugins: PluginConstructor[],
  opts: {
    fetchESM?: (url: string) => Promise<LoadedPlugin>
    fetchCJS?: (url: string) => Promise<LoadedPlugin>
  },
) {
  // Add global error handler to catch uncaught errors in the worker
  self.addEventListener('error', event => {
    console.error('[Worker uncaught error]', event.error || event.message)
  })
  self.addEventListener('unhandledrejection', event => {
    console.error('[Worker unhandled rejection]', event.reason)
  })

  try {
    const pluginManager = await getPluginManager(corePlugins, opts)
    const rpcConfig = Object.fromEntries(
      pluginManager
        .getRpcElements()
        .map(e => [e.name, wrapForRpc(e.execute.bind(e))]),
    )

    self.rpcServer = new RpcServer(rpcConfig)

    postMessage({ message: 'ready' })
  } catch (e) {
    postMessage({ message: 'error', error: serializeError(e) })
  }
  /* do nothing */
}
