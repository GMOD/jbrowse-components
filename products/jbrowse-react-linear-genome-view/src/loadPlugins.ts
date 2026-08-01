import PluginLoader from '@jbrowse/core/PluginLoader'
import { dropVendoredPlugins } from '@jbrowse/core/pluginDefinitions'

import type { LoadedPlugin } from '@jbrowse/core/PluginLoader'

interface PluginDefinition {
  name: string
  url: string
}

export default async function loadPlugins(
  pluginDefinitions: PluginDefinition[],
  args?: {
    fetchESM?: (url: string) => Promise<LoadedPlugin>
    baseUrl?: string
  },
) {
  const pluginLoader = new PluginLoader(
    dropVendoredPlugins(pluginDefinitions),
    args,
  )
  pluginLoader.installGlobalReExports(window)
  return pluginLoader.load(args?.baseUrl)
}
