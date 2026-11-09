import type { PluginConstructor } from '@jbrowse/core/Plugin'
import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'
import type { RpcManagerOptions } from '@jbrowse/core/rpc/RpcManager'

/**
 * A plugin an embedded product's caller can register: either the class itself,
 * or the `{ plugin, definition }` record `loadPlugins` returns.
 *
 * Prefer passing the record straight through. The `definition` is what lets the
 * RPC worker load the same plugin on its side — hand it only the class, or a
 * record without one, and the plugin exists on the main thread but not in the
 * worker, so anything it contributes that runs there (an adapter, most
 * commonly) fails to resolve.
 */
export type PluginInput =
  | PluginConstructor
  | { plugin: PluginConstructor; definition?: PluginDefinition }

/**
 * Turn caller-supplied plugins into `PluginManager` load records, keeping each
 * runtime plugin's `definition` when it has one.
 *
 * That definition is the whole point: `PluginManager.addPlugin` only records
 * `runtimePluginDefinitions` for records that carry one, and `RpcManager` ships
 * that list to the RPC worker as its boot config so the worker can fetch the
 * same plugin. Dropping it leaves the plugin main-thread-only, and the failure
 * surfaces far away — as an unknown adapter/track type inside the worker.
 *
 * Shared by every embedded product rather than restated, because getting it
 * wrong is invisible until someone combines a runtime plugin with a worker.
 */
export function toPluginLoadRecord(p: PluginInput) {
  return typeof p === 'function'
    ? { plugin: new p() }
    : p.definition
      ? { plugin: new p.plugin(), definition: p.definition }
      : { plugin: new p.plugin() }
}

function isMainThreadOnly(p: PluginInput) {
  return typeof p === 'function' || !p.definition
}

let defaultWorker = true

/**
 * Called by a product's `<script>`-tag bundle, whose worker would be served
 * from the bundle's CDN origin, where `new Worker` refuses it.
 */
export function disableDefaultWorker() {
  defaultWorker = false
}

/**
 * Where an embedded product's engine runs RPC, when its caller did not say: in
 * a worker, unless a plugin with no `definition` could not follow it there. The
 * worker module arrives by dynamic import, to stay out of the host's eager
 * bundle.
 */
export function embeddedRpcOptions({
  plugins,
  makeWorkerInstance,
  loadWorkerModule,
}: {
  plugins: PluginInput[]
  makeWorkerInstance?: () => Worker
  loadWorkerModule: () => Promise<{ default: () => Worker }>
}): RpcManagerOptions {
  const factory =
    makeWorkerInstance ??
    (defaultWorker &&
    typeof Worker !== 'undefined' &&
    !plugins.some(isMainThreadOnly)
      ? async () => (await loadWorkerModule()).default()
      : undefined)
  return factory
    ? {
        makeWorkerInstance: factory,
        defaultDriverName: 'WebWorkerRpcDriver',
        fallBackToMainThread: true,
      }
    : {}
}
