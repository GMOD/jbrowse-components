import PluginLoader from '@jbrowse/core/PluginLoader'
import ReExports from '@jbrowse/core/ReExports'

import type { LoadedPlugin } from '@jbrowse/core/PluginLoader'

interface PluginDefinition {
  name: string
  url: string
}

export default async function loadPlugins(
  pluginDefinitions: PluginDefinition[],
  args?: { fetchESM: (url: string) => Promise<LoadedPlugin> },
) {
  const pluginLoader = new PluginLoader(pluginDefinitions, args)
  pluginLoader.installGlobalReExports(window, ReExports)
  return pluginLoader.load('')
}
