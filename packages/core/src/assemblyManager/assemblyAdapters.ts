import { isRegionsAdapter } from '../data_adapters/BaseAdapter/util.ts'

import type PluginManager from '../PluginManager.ts'
import type { AnyConfigurationModel } from '../configuration/index.ts'
import type {
  BaseOptions,
  BaseRefNameAliasAdapter,
  CytobandAdapter,
} from '../data_adapters/BaseAdapter/index.ts'
import type { AnyDataAdapter } from '../data_adapters/BaseAdapter/util.ts'

interface AdapterArgs {
  config: AnyConfigurationModel
  pluginManager: PluginManager
  // the assembly load's status channel. These adapters run on the main thread
  // (instantiated below, no RPC hop), so this is a plain function call rather
  // than the worker side-channel — but it is the same `statusCallback` every
  // adapter already reads out of BaseOptions, so nothing downstream is special
  // cased. Without it every adapter's own "Downloading …" reporting is dropped
  // on the floor and the view spins on a bare "Loading".
  opts: BaseOptions
}

async function instantiateAdapter<T>(
  config: AnyConfigurationModel,
  pluginManager: PluginManager,
) {
  const CLASS = await pluginManager
    .getAdapterType(config.type)
    .getAdapterClass()
  return new CLASS(config, undefined, pluginManager) as T
}

export async function getRefNameAliases({
  config,
  pluginManager,
  opts,
}: AdapterArgs) {
  const adapter = await instantiateAdapter<BaseRefNameAliasAdapter>(
    config,
    pluginManager,
  )
  return adapter.getRefNameAliases(opts)
}

export async function getCytobands({
  config,
  pluginManager,
  opts,
}: AdapterArgs) {
  const adapter = await instantiateAdapter<CytobandAdapter>(
    config,
    pluginManager,
  )
  return adapter.getData(opts)
}

export async function getAssemblyRegions({
  config,
  pluginManager,
  opts,
}: AdapterArgs) {
  const adapter = await instantiateAdapter<AnyDataAdapter>(
    config,
    pluginManager,
  )
  // an assembly written with no sequence at all gets whatever adapter the
  // union defaults to, which lists no regions
  if (!isRegionsAdapter(adapter)) {
    throw new Error(
      `a ${config.type} cannot supply an assembly's sequence: give the assembly a "uri" or a "sequence.adapter"`,
    )
  }
  return adapter.getRegions(opts)
}
