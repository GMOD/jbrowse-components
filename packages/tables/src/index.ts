import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import {
  alignmentTables,
  referenceSequence,
  registerAlignmentsAdapters,
} from '@jbrowse/plugin-alignments/tables'
import BedPlugin from '@jbrowse/plugin-bed'
import {
  featureAttributeTables,
  featureTables,
} from '@jbrowse/plugin-canvas/tables'
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
import { engineCache } from './cache.ts'
import { fileRegions } from './fileRegions.ts'

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
export { DEFAULT_CACHE_LIMIT, MIN_ADAPTER_BYTES } from './cache.ts'
export type { CacheUse } from './cache.ts'

interface RegionArgs {
  adapterConfig: Record<string, unknown>
  sequenceAdapter?: Record<string, unknown>
  region?: TablesRegion
  regions?: TablesRegion[]
}

/**
 * A read's most rows in any one table: past it the read is refused rather
 * than answered, naming the table. A host sets it on a read of a whole file
 * (`fileRegions`), where nothing else bounds the rows.
 */
interface RowLimit {
  rowLimit?: number
}

/** The longest column of each table in `result`, a table being an object of arrays. */
function tableRows(result: object, path = ''): [string, number][] {
  return Object.entries(result).flatMap(([name, value]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return []
    }
    const columns = Object.values(value as object).filter(
      c => Array.isArray(c) || ArrayBuffer.isView(c),
    ) as ArrayLike<unknown>[]
    return columns.length
      ? [[`${path}${name}`, Math.max(...columns.map(c => c.length))]]
      : tableRows(value as object, `${path}${name}.`)
  })
}

function refuseOverRows(result: object, rowLimit: number | undefined) {
  for (const [name, rows] of tableRows(result)) {
    if (rowLimit !== undefined && rows > rowLimit) {
      throw new Error(
        `the file gives ${rows} rows of ${name}, over the ${rowLimit}-row limit for a read with no region; pass a region`,
      )
    }
  }
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
  const regions = args.regions ?? (args.region ? [args.region] : [])
  const vcf = VCF_ADAPTER_TYPES.includes(String(args.adapterConfig.type))
  return {
    ...features,
    ...(vcf
      ? {
          attributes: {},
          subfeatureAttributes: {},
          attributeFields: { key: [], type: [], number: [], description: [] },
        }
      : await featureAttributeTables(pluginManager, {
          adapterConfig: args.adapterConfig,
          regions,
          ids: features.features.id,
          subfeatureIds: features.subfeatures.id,
        })),
    vcf: vcf
      ? await variantRecordTables(pluginManager, {
          adapterConfig: args.adapterConfig,
          regions,
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
 * host reads each table as a data frame. Each call leaves the caches, which
 * every engine in the process shares, within their budget (`cache`).
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
  const cache = engineCache()
  const trimmed =
    <A extends unknown[], R>(f: (...args: A) => Promise<R>) =>
    (...args: A) =>
      cache.within(() => f(...args))
  const named = async <A extends RegionArgs>({
    assembly,
    ...args
  }: WithAssembly<A>) =>
    assembly
      ? renameRegions(pluginManager, args, await assemblyOf(assembly))
      : args
  const onContig = async <A extends RegionArgs, T extends object>(
    { rowLimit, ...given }: WithAssembly<A> & RowLimit,
    table: (pm: PluginManager, args: A) => Promise<T>,
  ) => {
    const args = (await named(given as WithAssembly<A>)) as A
    const missing = await missingContigs(pluginManager, args)
    const regions = args.regions ?? (args.region ? [args.region] : [])
    const tables = await table(pluginManager, args)
    refuseOverRows(tables, rowLimit)
    return {
      ...tables,
      missingContig: missing.find(m => m !== '') ?? '',
      missingContigs: missing,
      readAs: {
        refName: regions.map(r => r.refName),
        originalRefName: regions.map(r => r.originalRefName ?? r.refName),
      },
    }
  }
  return {
    alignments: trimmed((args: WithAssembly<AlignmentTablesArgs> & RowLimit) =>
      onContig(args, alignmentTables),
    ),
    features: trimmed((args: WithAssembly<FeatureTablesArgs> & RowLimit) =>
      onContig(args, featureAndRecordTables),
    ),
    wiggle: trimmed((args: WithAssembly<WiggleTablesArgs> & RowLimit) =>
      onContig(args, wiggleTables),
    ),
    variants: trimmed((args: WithAssembly<VariantTablesArgs> & RowLimit) =>
      onContig(args, variantTables),
    ),
    /**
     * Each contig a file lists, from 0 to the end of the contig: the regions
     * a read of the whole file reads, under the file's own spelling. The end
     * is the contig's length where the assembly or the file states one, else
     * the most an int32 holds, which each reader clamps to what its index
     * addresses. `lengthKnown` says which, and `hasData` whether the file
     * holds records there, null where its index cannot tell.
     */
    fileRegions: trimmed(
      async ({
        adapterConfig,
        assembly,
      }: {
        adapterConfig: Record<string, unknown>
        assembly?: AssemblyConfig
      }) =>
        fileRegions(
          pluginManager,
          adapterConfig,
          assembly ? await assemblyOf(assembly) : undefined,
        ),
    ),
    variantDensityAlpha,
    synteny: trimmed((args: SyntenyTablesArgs) =>
      syntenyTables(pluginManager, args),
    ),
    dotplot: trimmed((args: DotplotTablesArgs) =>
      dotplotTables(pluginManager, args),
    ),
    contigs: trimmed((args: ContigTablesArgs) =>
      contigTables(pluginManager, args),
    ),
    multiway: trimmed((args: MultiWayTablesArgs) =>
      multiwayTables(pluginManager, args),
    ),
    sequence: trimmed(
      async ({
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
    ),
    /**
     * The contigs an assembly's sequence lists, named as the sequence file
     * names them.
     */
    regions: trimmed(async ({ assembly }: { assembly: AssemblyConfig }) => {
      const { regions } = await assemblyOf(assembly)
      return {
        refName: regions.map(r => r.refName),
        start: regions.map(r => r.start),
        end: regions.map(r => r.end),
      }
    }),
    /**
     * What the caches hold, after setting their budget to `limit` bytes where
     * given, `Infinity` for none: a smaller budget evicts at once.
     */
    cache: async ({ limit }: { limit?: number } = {}) =>
      limit === undefined ? cache.held() : cache.setLimit(limit),
    /**
     * Empties every cache, resolved assemblies included, so the next call
     * reads its files again.
     */
    clearCache: () => cache.clear(),
  }
}
