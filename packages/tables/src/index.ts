import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import {
  alignmentTables,
  referenceSequence,
  registerAlignmentsAdapters,
} from '@jbrowse/plugin-alignments/tables'
import BedPlugin from '@jbrowse/plugin-bed'
import { featureTables } from '@jbrowse/plugin-canvas/tables'
import { dotplotTables } from '@jbrowse/plugin-dotplot-view/tables'
import GFF3Plugin from '@jbrowse/plugin-gff3'
import GtfPlugin from '@jbrowse/plugin-gtf'
import {
  registerComparativeAdapters,
  syntenyTables,
} from '@jbrowse/plugin-linear-comparative-view/tables'
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
import type { DotplotTablesArgs } from '@jbrowse/plugin-dotplot-view/tables'
import type { SyntenyTablesArgs } from '@jbrowse/plugin-linear-comparative-view/tables'
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
  DotplotTables,
  DotplotTablesArgs,
} from '@jbrowse/plugin-dotplot-view/tables'
export type {
  SyntenyTables,
  SyntenyTablesArgs,
} from '@jbrowse/plugin-linear-comparative-view/tables'
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

interface RegionArgs {
  adapterConfig: Record<string, unknown>
  region: { refName: string }
}

const LISTED_CONTIGS = 20

/**
 * Where the region's contig is not one the file has, what to tell the reader,
 * naming the file's contigs: its tables come back empty, as the browser draws
 * a track with no such contig, and a host can say why. Empty where the contig
 * is there, or the adapter cannot list its contigs.
 */
async function missingContig(
  pluginManager: PluginManager,
  { adapterConfig, region }: RegionArgs,
) {
  const { dataAdapter } = await getAdapter(
    pluginManager,
    'tables',
    adapterConfig,
  )
  const names: string[] =
    'getRefNames' in dataAdapter
      ? await (
          dataAdapter as { getRefNames: () => Promise<string[]> }
        ).getRefNames()
      : []
  if (names.length === 0 || names.includes(region.refName)) {
    return ''
  }
  const listed = names.slice(0, LISTED_CONTIGS).join(', ')
  const more =
    names.length > LISTED_CONTIGS
      ? `, and ${names.length - LISTED_CONTIGS} more`
      : ''
  return `${region.refName} is not a contig of this file, whose contigs are ${listed}${more}`
}

class TablesPlugin extends Plugin {
  name = 'TablesPlugin'
  install(pluginManager: PluginManager) {
    registerAlignmentsAdapters(pluginManager)
    registerSequenceAdapters(pluginManager)
    registerWiggleAdapters(pluginManager)
    registerVariantAdapters(pluginManager)
    registerComparativeAdapters(pluginManager)
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
  const onContig = async <A extends RegionArgs, T>(
    args: A,
    table: (pm: PluginManager, args: A) => Promise<T>,
  ) => ({
    ...(await table(pluginManager, args)),
    missingContig: await missingContig(pluginManager, args),
  })
  return {
    alignments: (args: AlignmentTablesArgs) => onContig(args, alignmentTables),
    features: (args: FeatureTablesArgs) => onContig(args, featureTables),
    wiggle: (args: WiggleTablesArgs) => onContig(args, wiggleTables),
    variants: (args: VariantTablesArgs) => onContig(args, variantTables),
    synteny: (args: SyntenyTablesArgs) => syntenyTables(pluginManager, args),
    dotplot: (args: DotplotTablesArgs) => dotplotTables(pluginManager, args),
    sequence: (args: Parameters<typeof referenceSequence>[1]) =>
      referenceSequence(pluginManager, args),
  }
}
