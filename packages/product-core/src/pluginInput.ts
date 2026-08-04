import type { PluginConstructor } from '@jbrowse/core/Plugin'
import type { PluginRecord } from '@jbrowse/core/PluginLoader'

/**
 * A plugin an embedded product's caller can register: either the class itself,
 * or the `{ plugin, definition }` record `loadPlugins` returns.
 *
 * Prefer passing the record straight through. The `definition` is what lets the
 * RPC worker load the same plugin on its side — hand it only the class and the
 * plugin exists on the main thread but not in the worker, so anything it
 * contributes that runs there (an adapter, most commonly) fails to resolve.
 */
export type PluginInput = PluginConstructor | PluginRecord

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
  // a plugin class is a function; a loadPlugins record is a plain object
  return typeof p === 'function'
    ? { plugin: new p() }
    : { plugin: new p.plugin(), definition: p.definition }
}
