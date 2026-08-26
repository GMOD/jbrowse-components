import { loadRuntimePlugins } from '@jbrowse/product-core'

import { version } from './version.ts'

import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'
import type { LoadPluginsArgs } from '@jbrowse/product-core'

/**
 * Fetch plugins at runtime from their urls. Returns `{ plugin, definition }`
 * records — pass them to `createViewState`'s `plugins` option unchanged rather
 * than mapping to `.plugin`: the definition is what lets the RPC worker load
 * the same plugin, so a stripped record leaves the plugin missing there.
 *
 * Takes the same `plugins` entries a jbrowse-web `config.json` carries.
 */
export default function loadPlugins(
  pluginDefinitions: PluginDefinition[],
  args?: LoadPluginsArgs,
) {
  return loadRuntimePlugins(pluginDefinitions, {
    ...args,
    dropVendored: true,
    jbrowseVersion: version,
  })
}
