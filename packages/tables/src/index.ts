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
import { contigTables } from '@jbrowse/plugin-comparative-adapters/tables'
import { registerConfigAdapters } from '@jbrowse/plugin-config/adapters'
import { dotplotTables } from '@jbrowse/plugin-dotplot-view/tables'
import GFF3Plugin from '@jbrowse/plugin-gff3'
import GtfPlugin from '@jbrowse/plugin-gtf'
import {
  multiwayTables,
  registerComparativeAdapters,
  syntenyTables,
} from '@jbrowse/plugin-linear-comparative-view/tables'
import { registerSequenceAdapters } from '@jbrowse/plugin-sequence/adapters'
import {
  VCF_ADAPTER_TYPES,
  registerVariantAdapters,
  variantDensityAlpha,
  variantRecordTables,
  variantTables,
} from '@jbrowse/plugin-variants/tables'
import {
  registerWiggleAdapters,
  wiggleTables,
} from '@jbrowse/plugin-wiggle/tables'

import { assemblyResolver, renameRegions } from './assembly.ts'

import type { AssemblyConfig, TablesRegion } from './assembly.ts'
import type { AlignmentTablesArgs } from '@jbrowse/plugin-alignments/tables'
import type { FeatureTablesArgs } from '@jbrowse/plugin-canvas/tables'
import type { ContigTablesArgs } from '@jbrowse/plugin-comparative-adapters/tables'
import type { DotplotTablesArgs } from '@jbrowse/plugin-dotplot-view/tables'
import type {
  MultiWayTablesArgs,
  SyntenyTablesArgs,
} from '@jbrowse/plugin-linear-comparative-view/tables'
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
  ContigTables,
  ContigTablesArgs,
} from '@jbrowse/plugin-comparative-adapters/tables'
export type {
  DotplotTables,
  DotplotTablesArgs,
} from '@jbrowse/plugin-dotplot-view/tables'
export type {
  MultiWayTables,
  MultiWayTablesArgs,
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
export type { AssemblyConfig } from './assembly.ts'
export { alignmentColors } from './colors.ts'
export { installBareHostGlobals } from './bareHost.ts'
export type { HostRange, ReadRange } from './bareHost.ts'

interface RegionArgs {
  adapterConfig: Record<string, unknown>
  sequenceAdapter?: Record<string, unknown>
  region?: TablesRegion
  regions?: TablesRegion[]
}

/**
 * A table's args with the assembly its regions are named in: the contig a
 * region names is read under the file's own alias of it, and the reference
 * under the sequence's, so a host asks for `chr7` of a BAM spelling it `7`.
 */
type WithAssembly<A> = A & { assembly?: AssemblyConfig }

const LISTED_CONTIGS = 20

/**
 * For each region whose contig is not one the file has, what to tell the
 * reader, naming the file's contigs: its tables come back empty, as the
 * browser draws a track with no such contig, and a host can say why. Empty
 * where the contig is there, or the adapter cannot list its contigs.
 */
async function missingContigs(
  pluginManager: PluginManager,
  { adapterConfig, region, regions = region ? [region] : [] }: RegionArgs,
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
  const listed = names.slice(0, LISTED_CONTIGS).join(', ')
  const more =
    names.length > LISTED_CONTIGS
      ? `, and ${names.length - LISTED_CONTIGS} more`
      : ''
  return regions.map(({ refName }) =>
    names.length === 0 || names.includes(refName)
      ? ''
      : `${refName} is not a contig of this file, whose contigs are ${listed}${more}`,
  )
}

/**
 * A feature table, and for a VCF, as `vcf`, the plain variant display's
 * records under it: their alleles, FILTER, INFO and each sample's FORMAT
 * values, as `variantRecordTables` gives them, so a calls VCF whose FORMAT has no GT
 * reads with its columns, which the genotype matrix has no row for.
 */
async function featureAndRecordTables(
  pluginManager: PluginManager,
  args: FeatureTablesArgs,
) {
  const features = await featureTables(pluginManager, args)
  return {
    ...features,
    vcf: VCF_ADAPTER_TYPES.includes(String(args.adapterConfig.type))
      ? await variantRecordTables(pluginManager, {
          adapterConfig: args.adapterConfig,
          regions: args.regions ?? (args.region ? [args.region] : []),
          ids: features.features.id,
        })
      : undefined,
  }
}

class TablesPlugin extends Plugin {
  name = 'TablesPlugin'
  install(pluginManager: PluginManager) {
    registerAlignmentsAdapters(pluginManager)
    registerSequenceAdapters(pluginManager)
    registerWiggleAdapters(pluginManager)
    registerVariantAdapters(pluginManager)
    registerComparativeAdapters(pluginManager)
    registerConfigAdapters(pluginManager)
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
  const assemblyOf = assemblyResolver(pluginManager)
  const named = async <A extends RegionArgs>({
    assembly,
    ...args
  }: WithAssembly<A>) =>
    assembly
      ? renameRegions(pluginManager, args, await assemblyOf(assembly))
      : args
  const onContig = async <A extends RegionArgs, T>(
    given: WithAssembly<A>,
    table: (pm: PluginManager, args: A) => Promise<T>,
  ) => {
    const args = (await named(given)) as A
    const missing = await missingContigs(pluginManager, args)
    const regions = args.regions ?? (args.region ? [args.region] : [])
    return {
      ...(await table(pluginManager, args)),
      missingContig: missing.find(m => m !== '') ?? '',
      missingContigs: missing,
      readAs: {
        refName: regions.map(r => r.refName),
        originalRefName: regions.map(r => r.originalRefName ?? r.refName),
      },
    }
  }
  return {
    alignments: (args: WithAssembly<AlignmentTablesArgs>) =>
      onContig(args, alignmentTables),
    features: (args: WithAssembly<FeatureTablesArgs>) =>
      onContig(args, featureAndRecordTables),
    wiggle: (args: WithAssembly<WiggleTablesArgs>) =>
      onContig(args, wiggleTables),
    variants: (args: WithAssembly<VariantTablesArgs>) =>
      onContig(args, variantTables),
    variantDensityAlpha,
    synteny: (args: SyntenyTablesArgs) => syntenyTables(pluginManager, args),
    dotplot: (args: DotplotTablesArgs) => dotplotTables(pluginManager, args),
    contigs: (args: ContigTablesArgs) => contigTables(pluginManager, args),
    multiway: (args: MultiWayTablesArgs) => multiwayTables(pluginManager, args),
    sequence: async ({
      assembly,
      ...args
    }: WithAssembly<{
      sequenceAdapter?: Record<string, unknown>
      region: TablesRegion
    }>) => {
      const { sequenceAdapter, region } = assembly
        ? await renameRegions(pluginManager, args, await assemblyOf(assembly))
        : args
      if (!sequenceAdapter) {
        throw new Error(
          'a sequence reads through a sequenceAdapter, or an assembly with a sequence',
        )
      }
      return referenceSequence(pluginManager, {
        sequenceAdapter,
        region: {
          ...region,
          refName: region.originalRefName ?? region.refName,
        },
      })
    },
    /**
     * The contigs an assembly's sequence lists, named as the sequence file
     * names them.
     */
    regions: async ({ assembly }: { assembly: AssemblyConfig }) => {
      const { regions } = await assemblyOf(assembly)
      return {
        refName: regions.map(r => r.refName),
        start: regions.map(r => r.start),
        end: regions.map(r => r.end),
      }
    },
  }
}
