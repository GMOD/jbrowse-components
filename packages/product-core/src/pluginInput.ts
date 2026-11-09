import type { PluginConstructor } from '@jbrowse/core/Plugin'
import type { PluginRecord } from '@jbrowse/core/PluginLoader'
import type { RpcManagerOptions } from '@jbrowse/core/rpc/RpcManager'

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

/**
 * Where an embedded product's engine runs RPC, when its caller did not say.
 *
 * In a worker, unless a plugin can't follow it there: a bare class has no
 * `definition`, so the worker would boot without it and whatever it registers
 * for the worker — an adapter, most often — would fail on a track that loads
 * fine on the main thread. That case stays on the main thread and says why.
 *
 * The product's worker module arrives by dynamic import, so the worker chunk
 * and the plugin graph behind it stay out of the host's eager bundle. With no
 * `Worker` at all — jest, a server render — there is nothing to choose.
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
  const canBuild = typeof Worker !== 'undefined'
  const bareClass = canBuild
    ? plugins.find(p => typeof p === 'function')
    : undefined
  const factory =
    makeWorkerInstance ??
    (canBuild && !bareClass
      ? async () => (await loadWorkerModule()).default()
      : undefined)
  return factory
    ? { makeWorkerInstance: factory, defaultDriverName: 'WebWorkerRpcDriver' }
    : {
        mainThreadReason: bareClass
          ? `plugins includes the class ${bareClass.name}, which the RPC worker cannot load. Pass the records loadPlugins returns instead, or pass makeWorkerInstance a worker that registers it.`
          : undefined,
      }
}
