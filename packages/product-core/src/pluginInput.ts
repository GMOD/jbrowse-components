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

/**
 * Where an embedded product's engine runs RPC: in a worker when the host passed
 * a factory, falling back to the main thread if that worker fails to boot, and
 * on the main thread otherwise.
 *
 * A worker by default was tried and reverted: the code-split worker in the
 * host's module graph made Vite 6 and 7 hosts set `worker.format: 'es'`, and
 * an embed asks no bundler config of its host. A prebuilt single-file worker
 * loaded as an asset fails the same rule: Next.js recompiles it into a file
 * that cannot boot, and Vite 6 and 7 dev servers 404 it from pre-bundled
 * dependencies.
 */
export function embeddedRpcOptions(
  makeWorkerInstance?: () => Worker,
): RpcManagerOptions {
  return makeWorkerInstance
    ? {
        makeWorkerInstance,
        defaultDriverName: 'WebWorkerRpcDriver',
        fallBackToMainThread: true,
      }
    : {}
}
