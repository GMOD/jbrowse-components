import FromConfigAdapterF from './FromConfigAdapter/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #api
 * Registers `FromConfigAdapter`, whose features a track config writes inline,
 * on a plugin manager that wants it without the configuration editor, as a
 * headless host does.
 */
export function registerConfigAdapters(pluginManager: PluginManager) {
  FromConfigAdapterF(pluginManager)
}
