import PluginLoader from '@jbrowse/core/PluginLoader'

interface PluginDefinition {
  name: string
  url: string
}

export default async function loadPlugins(
  pluginDefinitions: PluginDefinition[],
  args?: { fetchESM: (url: string) => Promise<unknown> },
) {
  const pluginLoader = new PluginLoader(pluginDefinitions, args)
  pluginLoader.installGlobalReExports(window)
  return pluginLoader.load('')
}
