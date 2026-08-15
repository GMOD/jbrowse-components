import type { DiagonalizeExecuteArgs } from './executeDiagonalize.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * The diagonalize RPC body, behind a dynamic import so the algorithm and its
 * alignment-extraction graph stay out of the callers' initial chunk. Named
 * imports off this package's barrel tree-shake to leaf modules, so the deferral
 * survives the two plugins importing this one statically.
 *
 * Two plugins register a method over it — linear-comparative-view and
 * dotplot-view, because a method is only callable if the plugin registering it
 * is loaded and either view can be installed without the other. Each does so as
 * an ordinary `RpcMethodType<'ItsOwnKey'>`, three lines apiece.
 *
 * There was a shared abstract base instead, and being GENERIC over the key is
 * what made it a special case: `RpcWireReturn<MethodName>` is a conditional
 * TypeScript will not resolve while the name is still a parameter, so the base
 * had to pin the wire return as a second type argument and then constrain
 * `MethodName` to the keys whose wire actually was that type to keep the pin
 * honest. It also could not name `RpcExecuteArgs<MethodName>` alone for the same
 * reason, and intersected what the body needed on top. All of that bought the
 * sharing of a three-line delegation that a function shares anyway — and the
 * second type parameter it needed was the last one left on `RpcMethodType`, so
 * deleting the base deleted that too.
 *
 * Neither method extends `RpcMethodTypeWithFiltersAndRenameRegions`, which a
 * comparative RPC normally reaches for. These args carry no `filters`, and no
 * top-level `regions` either — a diagonalize call renames per adapter on the
 * main thread (see `prepareDiagonalizeAdapter`), because each of a level's
 * adapters has its own refName namespace and one shared `regions` key cannot
 * express that. The rename base only ever renames a top-level `regions` array,
 * so for these args its work was a no-op while its `serializeArguments` type
 * demanded a top-level `adapterConfig` per-adapter args have no place to put.
 * The pieces that do matter — location/blob augmentation on the wire and blobMap
 * rehydration in the worker, which is what lets a local-file track diagonalize —
 * live in `RpcMethodType` itself. Location handling walks the whole args tree,
 * so each `adapters[].adapterConfig` is still augmented at its nested position.
 */
export async function runDiagonalize(
  pluginManager: PluginManager,
  args: DiagonalizeExecuteArgs,
) {
  const { executeDiagonalize } = await import('./executeDiagonalize.ts')
  return executeDiagonalize(pluginManager, args)
}
