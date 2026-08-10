import PluginLoader from '@jbrowse/core/PluginLoader'
import { dropVendoredPlugins } from '@jbrowse/core/pluginDefinitions'

import type { LoadedPlugin } from '@jbrowse/core/PluginLoader'
import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

/**
 * Fetch plugins at runtime from their urls. Returns `{ plugin, definition }`
 * records — pass them to `createViewState`'s `plugins` option unchanged rather
 * than mapping to `.plugin`: the definition is what lets the RPC worker load
 * the same plugin, so a stripped record leaves the plugin missing there.
 *
 * Takes the same `plugins` entries a jbrowse-web `config.json` carries.
 */
export default async function loadPlugins(
  pluginDefinitions: PluginDefinition[],
  args?: {
    fetchESM?: (url: string) => Promise<LoadedPlugin>
    /**
     * Resolve relative plugin urls against this instead of the page. A config
     * fetched from somewhere else names its plugins relative to itself, so pass
     * that config's url — otherwise a `"url": "umd_plugin.js"` entry is looked
     * for next to your own app and 404s.
     */
    baseUri?: string
    /** @deprecated the pre-4.4 spelling of `baseUri` */
    baseUrl?: string
  },
) {
  const pluginLoader = new PluginLoader(
    dropVendoredPlugins(pluginDefinitions),
    args,
  )
  pluginLoader.installGlobalReExports(window)
  // the default matters: `new URL('umd_plugin.js', undefined)` throws, so a
  // relative plugin url used to fail outright instead of resolving against the
  // page the way every other relative url does
  const base = args?.baseUri ?? args?.baseUrl
  return pluginLoader.load(base ?? window.location.href)
}
