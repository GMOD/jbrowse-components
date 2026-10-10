import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  alignmentTables,
  registerAlignmentsAdapters,
} from '@jbrowse/plugin-alignments/tables'
import { registerSequenceAdapters } from '@jbrowse/plugin-sequence/adapters'

import type { AlignmentTablesArgs } from '@jbrowse/plugin-alignments/tables'

export type {
  AlignmentTables,
  AlignmentTablesArgs,
} from '@jbrowse/plugin-alignments/tables'
export { alignmentColors } from './colors.ts'
export { installBareHostGlobals } from './bareHost.ts'
export type { HostRange, ReadRange } from './bareHost.ts'

class TablesPlugin extends Plugin {
  name = 'TablesPlugin'
  install(pluginManager: PluginManager) {
    registerAlignmentsAdapters(pluginManager)
    registerSequenceAdapters(pluginManager)
  }
}

/**
 * A plugin manager holding only the adapters the tables read through, and the
 * table functions over it. Each returns columns: one array per field, so a
 * host reads each table as a data frame.
 */
export function createTablesEngine() {
  const pluginManager = new PluginManager([new TablesPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return {
    alignments: (args: AlignmentTablesArgs) =>
      alignmentTables(pluginManager, args),
  }
}
