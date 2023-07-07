/* eslint-disable no-restricted-globals */
import RpcServer from 'librpc-web-mod'
import PluginManager from '@jbrowse/core/PluginManager'
import { remoteAbortRpcHandler } from '@jbrowse/core/rpc/remoteAbortSignals'
import PluginLoader, {
  LoadedPlugin,
  PluginDefinition,
} from '@jbrowse/core/PluginLoader'
import { PluginConstructor } from '@jbrowse/core/Plugin'
import { serializeError } from 'serialize-error'

interface WorkerConfiguration {
  plugins: PluginDefinition[]
  windowHref: string
}

// waits for a message from the main thread containing our configuration, which
// must be sent on boot
function receiveConfiguration() {
  const configurationP: Promise<WorkerConfiguration> = new Promise(resolve => {
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
  const pluginLoader = new PluginLoader(config.plugins, opts)
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
          // @ts-expect-error
          self.rpcServer.emit(channel, message)
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
  try {
    const pluginManager = await getPluginManager(corePlugins, opts)
    const rpcConfig = Object.fromEntries(
      pluginManager
        .getRpcElements()
        .map(e => [e.name, wrapForRpc(e.execute.bind(e))]),
    )

    // @ts-expect-error
    self.rpcServer = new RpcServer.Server({
      ...rpcConfig,
      ...remoteAbortRpcHandler(),
      ping: () => {
        // the ping method is required by the worker driver for checking the
        // health of the worker
      },
    })
    postMessage({ message: 'ready' })
  } catch (e) {
    postMessage({ message: 'error', error: serializeError(e) })
  }
  /* do nothing */
}
