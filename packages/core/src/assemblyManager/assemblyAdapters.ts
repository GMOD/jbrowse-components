import type PluginManager from '../PluginManager.ts'
import type { AnyConfigurationModel } from '../configuration/index.ts'
import type {
  BaseOptions,
  BaseRefNameAliasAdapter,
  CytobandAdapter,
  RegionsAdapter,
} from '../data_adapters/BaseAdapter/index.ts'

interface AdapterArgs {
  config: AnyConfigurationModel
  pluginManager: PluginManager
  // the assembly load's status channel. These adapters run on the main thread
  // (instantiated below, no RPC hop), so this is a plain function call rather
  // than the worker side-channel — but it is the same `statusCallback` every
  // adapter already reads out of BaseOptions, so nothing downstream is special
  // cased. Without it every adapter's own "Downloading …" reporting is dropped
  // on the floor and the view spins on a bare "Loading".
  opts?: BaseOptions
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

/**
 * Start downloading the code of the adapters an assembly config names, so its
 * load does not spend a round trip on them after it starts.
 */
export function preloadAssemblyAdapters(
  conf: AnyConfigurationModel,
  pluginManager: PluginManager,
) {
  for (const adapter of [
    conf.sequence?.adapter,
    conf.refNameAliases?.adapter,
    conf.cytobands?.adapter,
  ]) {
    if (adapter && pluginManager.hasAdapterType(adapter.type)) {
      pluginManager
        .getAdapterType(adapter.type)
        .getAdapterClass()
        .catch(() => {})
    }
  }
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
  return adapter.getRefNameAliases(opts ?? {})
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
  const adapter = await instantiateAdapter<RegionsAdapter>(
    config,
    pluginManager,
  )
  return adapter.getRegions(opts ?? {})
}
