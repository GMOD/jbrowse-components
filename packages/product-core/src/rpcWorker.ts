import PluginLoader from '@jbrowse/core/PluginLoader'
import PluginManager from '@jbrowse/core/PluginManager'
import { setNumberGrouping } from '@jbrowse/core/util'
import { RpcServer, serializeError } from '@jbrowse/core/util/librpc'
import { setStackTraceLimit } from '@jbrowse/core/util/setStackTraceLimit'
import { enableStaticRendering } from 'mobx-react'

import type { PluginConstructor } from '@jbrowse/core/Plugin'
import type { LoadedPlugin } from '@jbrowse/core/PluginLoader'
import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'
import type { RpcStatus } from '@jbrowse/core/util'

declare global {
  interface Window {
    rpcServer?: RpcServer
  }
}

interface WorkerConfiguration {
  plugins: PluginDefinition[]
  windowHref: string
  numberGrouping: boolean
}

// waits for a message from the main thread containing our configuration, which
// must be sent on boot
function receiveConfiguration() {
  const configurationP = new Promise<WorkerConfiguration>(resolve => {
    function listener(
      e: MessageEvent<{ message?: string; config?: WorkerConfiguration }>,
    ) {
      if (e.data.message === 'config' && e.data.config) {
        resolve(e.data.config)
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
  const config = await receiveConfiguration()
  // this realm formats its own strings — a jexl `mouseover` slot renders a
  // tooltip against the full feature here rather than shipping it back — so it
  // needs the main thread's display preference before any RPC method runs
  setNumberGrouping(config.numberGrouping)
  const pluginLoader = new PluginLoader(
    config.plugins,
    opts,
  ).installGlobalReExports(self)
  // Keep each runtime plugin's `definition` on its load record (mirroring the
  // main thread's createPluginManager) so PluginManager populates
  // runtimePluginDefinitions. A plugin that resolves a sibling asset from its
  // own bundle url in the worker — e.g. GraphGenomeView's Bandage layout
  // engine — needs its definition here, not just its instance.
  const runtimePlugins = await pluginLoader.load(config.windowHref)
  return new PluginManager([
    ...corePlugins.map(P => ({ plugin: new P() })),
    ...runtimePlugins.map(({ plugin: P, definition }) => ({
      plugin: new P(),
      definition,
    })),
  ])
    .createPluggableElements()
    .configure()
}

interface WrappedFuncArgs {
  // absent when the caller passed no statusCallback; see wrapForRpc
  channel?: string
  [key: string]: unknown
}

type RpcFunc = (args: unknown) => Promise<unknown>

/**
 * Wire the method's `statusCallback` to the status channel the driver opened
 * for this call — and to nothing at all when it opened none.
 *
 * The `channel` is the driver's statement of whether anyone is listening
 * (`WebWorkerHandle.call`), so a method run without one has to see the
 * `undefined` its caller passed. Injecting a callback regardless made every
 * "no statusCallback" branch in the worker unreachable: the byte reporter an
 * adapter hands its reader, the emit `createProgressReporter` gates, and the
 * postMessage each of those cost to reach a main-thread listener that dropped
 * it.
 *
 * `channel` is transport bookkeeping and comes back OFF here, the mirror of
 * `BaseRpcDriver.call` stripping `statusCallback` on the way out. It used to
 * ride through into every worker method's arguments, where nothing read it and
 * `RpcExecuteArgs<M>` did not declare it — a key the main-thread driver never
 * adds, so the two drivers handed `execute` different bags. `rpcDriverParity`
 * is what says so.
 *
 * Exported for its test and not from the package barrel: `initializeWorker` is
 * the only thing a product's worker entry calls, and the branch here is a claim
 * about the driver on the other side of postMessage that nothing else asserts.
 */
export function wrapForRpc(func: RpcFunc) {
  return (args: unknown) => {
    const { channel, ...rest } = args as WrappedFuncArgs
    return func(
      channel === undefined
        ? rest
        : {
            ...rest,
            statusCallback: (message: RpcStatus) => {
              self.rpcServer?.emit(channel, message)
            },
          },
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
  // a worker error's stack is captured here, not on the main thread, so the
  // frame limit has to be raised in this scope to deepen it
  setStackTraceLimit()

  // Workers fetch data; rendering happens on the main thread, and no RPC method
  // renders React. Kept as a guard: if plugin code ever pulls an observer into
  // this realm, static rendering keeps it from setting up reactions that would
  // leak here. Here rather than in each product's worker entry, where four
  // copies meant a fifth product would silently ship without it — the plugins
  // that could trip it are not loaded until getPluginManager below, so this is
  // still ahead of anything that observes.
  enableStaticRendering(true)

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
        // `invoke`, not `execute`: it deserializes the arguments before handing
        // them on, which is what makes the blob map current and the declared
        // arg types true. MainThreadRpcDriver binds the same one.
        .map(e => [e.name, wrapForRpc(e.invoke.bind(e))]),
    )

    self.rpcServer = new RpcServer(rpcConfig)

    postMessage({ message: 'ready' })
  } catch (e) {
    postMessage({ message: 'error', error: serializeError(e) })
  }
}
