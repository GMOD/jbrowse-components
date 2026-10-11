import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  alignmentTables,
  referenceSequence,
  registerAlignmentsAdapters,
} from '@jbrowse/plugin-alignments/tables'
import BedPlugin from '@jbrowse/plugin-bed'
import { featureTables } from '@jbrowse/plugin-canvas/tables'
import GFF3Plugin from '@jbrowse/plugin-gff3'
import GtfPlugin from '@jbrowse/plugin-gtf'
import { registerSequenceAdapters } from '@jbrowse/plugin-sequence/adapters'
import {
  registerVariantAdapters,
  variantTables,
} from '@jbrowse/plugin-variants/tables'
import {
  registerWiggleAdapters,
  wiggleTables,
} from '@jbrowse/plugin-wiggle/tables'

import type { AlignmentTablesArgs } from '@jbrowse/plugin-alignments/tables'
import type { FeatureTablesArgs } from '@jbrowse/plugin-canvas/tables'
import type { VariantTablesArgs } from '@jbrowse/plugin-variants/tables'
import type { WiggleTablesArgs } from '@jbrowse/plugin-wiggle/tables'

export type {
  AlignmentTables,
  AlignmentTablesArgs,
} from '@jbrowse/plugin-alignments/tables'
export type {
  FeatureTables,
  FeatureTablesArgs,
} from '@jbrowse/plugin-canvas/tables'
export type {
  VariantTables,
  VariantTablesArgs,
} from '@jbrowse/plugin-variants/tables'
export type {
  WiggleTables,
  WiggleTablesArgs,
} from '@jbrowse/plugin-wiggle/tables'
export { alignmentColors } from './colors.ts'
export { installBareHostGlobals } from './bareHost.ts'
export type { HostRange, ReadRange } from './bareHost.ts'

class TablesPlugin extends Plugin {
  name = 'TablesPlugin'
  install(pluginManager: PluginManager) {
    registerAlignmentsAdapters(pluginManager)
    registerSequenceAdapters(pluginManager)
    registerWiggleAdapters(pluginManager)
    registerVariantAdapters(pluginManager)
  }
}

/**
 * A plugin manager holding only the adapters the tables read through, and the
 * table functions over it. Each returns columns: one array per field, so a
 * host reads each table as a data frame.
 */
export function createTablesEngine() {
  const pluginManager = new PluginManager([
    new TablesPlugin(),
    new BedPlugin(),
    new GFF3Plugin(),
    new GtfPlugin(),
  ])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return {
    alignments: (args: AlignmentTablesArgs) =>
      alignmentTables(pluginManager, args),
    features: (args: FeatureTablesArgs) => featureTables(pluginManager, args),
    wiggle: (args: WiggleTablesArgs) => wiggleTables(pluginManager, args),
    variants: (args: VariantTablesArgs) => variantTables(pluginManager, args),
    sequence: (args: Parameters<typeof referenceSequence>[1]) =>
      referenceSequence(pluginManager, args),
  }
}
