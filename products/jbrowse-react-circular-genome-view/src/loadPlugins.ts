import PluginLoader from '@jbrowse/core/PluginLoader'

interface PluginDefinition {
  name: string
  url: string
}

export default async function loadPlugins(
  pluginDefinitions: PluginDefinition[],
) {
  const pluginLoader = new PluginLoader(pluginDefinitions)
  pluginLoader.installGlobalReExports(window)
  const runtimePlugins = await pluginLoader.load()
  return runtimePlugins
}
