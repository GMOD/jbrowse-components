import {
  isCJSPluginDefinition,
  isESMPluginDefinition,
  isUMDPluginDefinition,
  pluginUrl,
} from '@jbrowse/core/PluginLoader'

import type { PluginDefinition } from '@jbrowse/core/PluginLoader'

export const TRUSTED_PLUGIN_URL_PREFIXES = ['https://jbrowse.org/plugins/']

export async function fetchPlugins() {
  const response = await fetch('https://jbrowse.org/plugin-store/plugins.json')
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText} fetching plugins`,
    )
  }
  return response.json() as Promise<{ plugins: PluginDefinition[] }>
}

function isTrustedUrl(url: string) {
  return TRUSTED_PLUGIN_URL_PREFIXES.some(prefix => url.startsWith(prefix))
}

function isPluginInStore(
  p: PluginDefinition,
  storePlugins: { plugins: PluginDefinition[] },
) {
  const url = pluginUrl(p)
  if (isUMDPluginDefinition(p)) {
    return storePlugins.plugins.some(
      pp => isUMDPluginDefinition(pp) && pluginUrl(pp) === url,
    )
  }
  if (isESMPluginDefinition(p)) {
    return storePlugins.plugins.some(
      pp => isESMPluginDefinition(pp) && pluginUrl(pp) === url,
    )
  }
  if (isCJSPluginDefinition(p)) {
    return storePlugins.plugins.some(
      pp => isCJSPluginDefinition(pp) && pluginUrl(pp) === url,
    )
  }
  return false
}

export async function checkPlugins(pluginsToCheck: PluginDefinition[]) {
  if (pluginsToCheck.length === 0) {
    return true
  }
  const storePlugins = await fetchPlugins()
  return pluginsToCheck.every(
    p => isTrustedUrl(pluginUrl(p)) || isPluginInStore(p, storePlugins),
  )
}

export function checkPluginsAgainstStore(
  pluginsToCheck: PluginDefinition[],
  storePlugins: { plugins: PluginDefinition[] },
) {
  if (pluginsToCheck.length === 0) {
    return true
  }
  return pluginsToCheck.every(
    p => isTrustedUrl(pluginUrl(p)) || isPluginInStore(p, storePlugins),
  )
}
