import FromConfigAdapterF from './FromConfigAdapter/index.ts'
import NcbiSequenceReportAliasAdapterF from './NcbiSequenceReportAliasAdapter/index.ts'
import RefNameAliasAdapterF from './RefNameAliasAdapter/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #api
 * Registers `FromConfigAdapter`, whose features a track config writes inline,
 * and the alias adapters an assembly's `refNameAliases` reads through, on a
 * plugin manager that wants them without the configuration editor, as a
 * headless host does.
 */
export function registerConfigAdapters(pluginManager: PluginManager) {
  FromConfigAdapterF(pluginManager)
  RefNameAliasAdapterF(pluginManager)
  NcbiSequenceReportAliasAdapterF(pluginManager)
}
