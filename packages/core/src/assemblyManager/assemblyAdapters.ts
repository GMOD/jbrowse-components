import type PluginManager from '../PluginManager.ts'
import type { AnyConfigurationModel } from '../configuration/index.ts'
import type {
  BaseRefNameAliasAdapter,
  CytobandAdapter,
  RegionsAdapter,
} from '../data_adapters/BaseAdapter/index.ts'

interface AdapterArgs {
  config: AnyConfigurationModel
  pluginManager: PluginManager
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
}: AdapterArgs) {
  const adapter = await instantiateAdapter<BaseRefNameAliasAdapter>(
    config,
    pluginManager,
  )
  return adapter.getRefNameAliases({})
}

export async function getCytobands({ config, pluginManager }: AdapterArgs) {
  const adapter = await instantiateAdapter<CytobandAdapter>(
    config,
    pluginManager,
  )
  return adapter.getData()
}

export async function getAssemblyRegions({
  config,
  pluginManager,
}: AdapterArgs) {
  const adapter = await instantiateAdapter<RegionsAdapter>(
    config,
    pluginManager,
  )
  return adapter.getRegions({})
}
