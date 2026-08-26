import { loadRuntimePlugins } from '@jbrowse/product-core'

import { version } from './version.ts'

import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'
import type { LoadPluginsArgs } from '@jbrowse/product-core'

/**
 * Fetch plugins at runtime from their urls. Returns `{ plugin, definition }`
 * records — pass them to `createViewState`/`<JBrowse>`'s `plugins` option
 * unchanged rather than mapping to `.plugin`: the definition is what lets the
 * RPC worker load the same plugin, so a stripped record leaves the plugin
 * missing in the worker.
 *
 * Takes the same `plugins` entries a jbrowse-web `config.json` carries, so
 * `loadPlugins(config.plugins ?? [], { baseUri: configUrl })` is the whole
 * story for a fetched config.
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
