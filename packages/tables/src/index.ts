import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  alignmentMarkAlpha,
  alignmentTables,
  referenceSequence,
  registerAlignmentsAdapters,
} from '@jbrowse/plugin-alignments/tables'
import BedPlugin from '@jbrowse/plugin-bed'
import { contigTables } from '@jbrowse/plugin-comparative-adapters/tables'
import { registerConfigAdapters } from '@jbrowse/plugin-config/adapters'
import { dotplotTables } from '@jbrowse/plugin-dotplot-view/tables'
import {
  featureAttributeTables,
  featureTables,
} from '@jbrowse/plugin-features/tables'
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
import { contigNamesOf, fileRegions } from './fileRegions.ts'

import type { AssemblyConfig } from './assembly.ts'
import type { TablesRegion } from '@jbrowse/core/data_adapters/tables'
import type { AlignmentTablesArgs as AlignmentReadArgs } from '@jbrowse/plugin-alignments/tables'
import type { ContigTablesArgs } from '@jbrowse/plugin-comparative-adapters/tables'
import type { DotplotTablesArgs } from '@jbrowse/plugin-dotplot-view/tables'
import type { FeatureTablesArgs as FeatureReadArgs } from '@jbrowse/plugin-features/tables'
import type {
  MultiWayTablesArgs,
  SyntenyTablesArgs,
} from '@jbrowse/plugin-linear-comparative-view/tables'
import type { VariantTablesArgs as VariantReadArgs } from '@jbrowse/plugin-variants/tables'
import type { WiggleTablesArgs as WiggleReadArgs } from '@jbrowse/plugin-wiggle/tables'

export type { AlignmentTables } from '@jbrowse/plugin-alignments/tables'
export type { FeatureTables } from '@jbrowse/plugin-features/tables'
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
export type { VariantTables } from '@jbrowse/plugin-variants/tables'
export type { WiggleTables } from '@jbrowse/plugin-wiggle/tables'
export type { AssemblyConfig } from './assembly.ts'
export { alignmentColors } from './colors.ts'
export { installBareHostGlobals } from './bareHost.ts'
export type { HostRange, ReadRange } from './bareHost.ts'
export { DEFAULT_CACHE_LIMIT, MIN_ADAPTER_BYTES } from './cache.ts'
export type { CacheUse } from './cache.ts'

interface RegionArgs {
  adapterConfig: Record<string, unknown>
  sequenceAdapter?: Record<string, unknown>
  regions: TablesRegion[]
}

/**
 * A region read's args as a host sends them: `region` reads as
 * `regions: [region]`, `assembly` names the regions in the assembly's
 * spelling, and `rowLimit` is a read's most rows in any one table, past
 * which it is refused, naming the table. A host sets `rowLimit` on a read of
 * a whole file (`fileRegions`), where nothing else bounds the rows.
 */
type HostArgs<A extends RegionArgs> = Omit<A, 'regions'> & {
  region?: TablesRegion
  regions?: TablesRegion[]
  assembly?: AssemblyConfig
  rowLimit?: number
}

/**
 * Every key a call's args may hold, kept equal to its args type by the
 * compiler (`satisfies`), so a host's misspelled or renamed key is refused
 * rather than dropped.
 */
type ArgKeys<A> = Record<keyof A, true>

export type AlignmentTablesArgs = HostArgs<AlignmentReadArgs>
export type FeatureTablesArgs = HostArgs<FeatureReadArgs>
export type WiggleTablesArgs = HostArgs<WiggleReadArgs>
export type VariantTablesArgs = HostArgs<VariantReadArgs>

function refuseUnknownArgs(call: string, args: object, keys: object) {
  const unknown = Object.keys(args).filter(k => !Object.hasOwn(keys, k))
  if (unknown.length > 0) {
    throw new Error(
      `${call} takes no ${unknown.join(', ')}; its args are ${Object.keys(keys).join(', ')}`,
    )
  }
}

const REGION_READ_ARGS = {
  adapterConfig: true,
  region: true,
  regions: true,
  display: true,
  assembly: true,
  rowLimit: true,
} as const

const ALIGNMENTS_ARGS = {
  ...REGION_READ_ARGS,
  sequenceAdapter: true,
  refNames: true,
  byteLimit: true,
  spanLimit: true,
} satisfies ArgKeys<AlignmentTablesArgs>

const FEATURES_ARGS = {
  ...REGION_READ_ARGS,
  sequenceAdapter: true,
  bpPerPx: true,
  colorByFrame: true,
  aminoAcids: true,
  geneticCodeId: true,
  byteLimit: true,
} satisfies ArgKeys<FeatureTablesArgs>

const WIGGLE_ARGS = {
  ...REGION_READ_ARGS,
  bpPerPx: true,
  trackType: true,
} satisfies ArgKeys<WiggleTablesArgs>

const VARIANTS_ARGS = {
  ...REGION_READ_ARGS,
  sequenceAdapter: true,
  byteLimit: true,
} satisfies ArgKeys<VariantTablesArgs>

const SYNTENY_ARGS = {
  adapterConfig: true,
  query: true,
  target: true,
  view: true,
} satisfies ArgKeys<SyntenyTablesArgs>

const DOTPLOT_ARGS = {
  adapterConfig: true,
  x: true,
  y: true,
  view: true,
} satisfies ArgKeys<DotplotTablesArgs>

const CONTIGS_ARGS = {
  adapterConfig: true,
} satisfies ArgKeys<ContigTablesArgs>

const MULTIWAY_ARGS = {
  adapterConfig: true,
  anchor: true,
  pins: true,
  hidden: true,
  display: true,
} satisfies ArgKeys<MultiWayTablesArgs>

const FILE_REGIONS_ARGS = { adapterConfig: true, assembly: true } as const

const SEQUENCE_ARGS = {
  sequenceAdapter: true,
  region: true,
  assembly: true,
} as const

const REGIONS_ARGS = { assembly: true } as const

const CANONICAL_NAMES_ARGS = { assembly: true, refNames: true } as const

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
  if (rowLimit === undefined) {
    return
  }
  for (const [name, rows] of tableRows(result)) {
    if (rows > rowLimit) {
      throw new Error(
        `the file gives ${rows} rows of ${name}, over the ${rowLimit}-row limit for a read with no region; pass a region`,
      )
    }
  }
}

const LISTED_CONTIGS = 20

/**
 * For each region whose contig is not one of `names`, what to tell the
 * reader, naming the file's contigs: its tables come back empty, as the
 * browser draws a track with no such contig, and a host can say why. Empty
 * where the contig is there, or the adapter cannot list its contigs.
 */
function missingContigsOf(
  names: string[],
  regions: { refName: string; originalRefName?: string }[],
) {
  const has = new Set(names)
  const listed = names.slice(0, LISTED_CONTIGS).join(', ')
  const more =
    names.length > LISTED_CONTIGS
      ? `, and ${names.length - LISTED_CONTIGS} more`
      : ''
  return regions.map(({ refName, originalRefName = refName }) =>
    has.size === 0 || has.has(refName) || has.has(originalRefName)
      ? ''
      : `${refName} is not a contig of this file, whose contigs are ${listed}${more}`,
  )
}

async function missingContigs(
  pluginManager: PluginManager,
  { adapterConfig, sequenceAdapter, regions }: RegionArgs,
) {
  return regions.length === 0
    ? []
    : missingContigsOf(
        await contigNamesOf(pluginManager, adapterConfig, sequenceAdapter),
        regions,
      )
}

/** `missingContigs` for one axis of a comparative file, on its assembly's side. */
async function axisMissingContigs(
  pluginManager: PluginManager,
  adapterConfig: Record<string, unknown>,
  assemblyName: string | undefined,
  regions: { refName: string }[],
) {
  return regions.length === 0
    ? []
    : missingContigsOf(
        await contigNamesOf(
          pluginManager,
          adapterConfig,
          undefined,
          assemblyName,
        ),
        regions,
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
  args: FeatureReadArgs,
) {
  const features = await featureTables(pluginManager, args)
  const { regions } = args
  const vcf = VCF_ADAPTER_TYPES.includes(String(args.adapterConfig.type))
  return {
    ...features,
    ...(await featureAttributeTables(pluginManager, {
      adapterConfig: args.adapterConfig,
      sequenceAdapter: args.sequenceAdapter,
      regions,
      ids: vcf ? [] : features.features.id,
      subfeatureIds: vcf ? [] : features.subfeatures.id,
    })),
    vcf: vcf
      ? await variantRecordTables(pluginManager, {
          adapterConfig: args.adapterConfig,
          sequenceAdapter: args.sequenceAdapter,
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
 * every engine in the process shares, within their limit (`cache`).
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
  const call =
    <A extends object, R>(
      name: string,
      keys: ArgKeys<A>,
      f: (args: A) => Promise<R>,
    ) =>
    (args: A) =>
      cache.within(async () => {
        refuseUnknownArgs(name, args, keys)
        return f(args)
      })
  const regionRead = <A extends RegionArgs, T extends object>(
    name: string,
    keys: ArgKeys<HostArgs<A>>,
    table: (pm: PluginManager, args: A) => Promise<T>,
  ) =>
    call(
      name,
      keys,
      async ({
        region,
        regions = region ? [region] : [],
        assembly,
        rowLimit,
        ...rest
      }: HostArgs<A>) => {
        const given = { ...rest, regions } as A
        const args = assembly
          ? await renameRegions(
              pluginManager,
              given,
              await assemblyOf(assembly),
            )
          : given
        const [missing, tables] = await Promise.all([
          missingContigs(pluginManager, args),
          table(pluginManager, args),
        ])
        refuseOverRows(tables, rowLimit)
        return {
          ...tables,
          missingContigs: missing,
          readAs: {
            refName: args.regions.map(r => r.refName),
            originalRefName: args.regions.map(
              r => r.originalRefName ?? r.refName,
            ),
          },
        }
      },
    )
  return {
    alignments: regionRead('alignments', ALIGNMENTS_ARGS, alignmentTables),
    features: regionRead('features', FEATURES_ARGS, featureAndRecordTables),
    wiggle: regionRead('wiggle', WIGGLE_ARGS, wiggleTables),
    variants: regionRead('variants', VARIANTS_ARGS, variantTables),
    /**
     * Each contig a file lists, from 0 to the end of the contig: the regions
     * a read of the whole file reads, under the file's own spelling. The end
     * is the contig's length where the assembly or the file states one, else
     * the most an int32 holds, which each reader clamps to what its index
     * addresses. `lengthKnown` says which, `hasData` whether the file
     * holds records there, null where its index cannot tell, and `canonical`
     * the assembly's name for the contig, `refName` where the call names no
     * assembly.
     */
    fileRegions: call(
      'fileRegions',
      FILE_REGIONS_ARGS,
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
    alignmentMarkAlpha,
    synteny: call('synteny', SYNTENY_ARGS, async (args: SyntenyTablesArgs) => {
      const tables = await syntenyTables(pluginManager, args)
      const [query, target] = tables.assemblyNames
      return {
        ...tables,
        missingContigs: {
          query: await axisMissingContigs(
            pluginManager,
            args.adapterConfig,
            query,
            args.query.regions,
          ),
          target: await axisMissingContigs(
            pluginManager,
            args.adapterConfig,
            target,
            args.target.regions,
          ),
        },
      }
    }),
    dotplot: call('dotplot', DOTPLOT_ARGS, async (args: DotplotTablesArgs) => {
      const tables = await dotplotTables(pluginManager, args)
      const [x, y] = tables.assemblyNames
      return {
        ...tables,
        missingContigs: {
          x: await axisMissingContigs(
            pluginManager,
            args.adapterConfig,
            x,
            args.x.regions,
          ),
          y: await axisMissingContigs(
            pluginManager,
            args.adapterConfig,
            y,
            args.y.regions,
          ),
        },
      }
    }),
    contigs: call('contigs', CONTIGS_ARGS, (args: ContigTablesArgs) =>
      contigTables(pluginManager, args),
    ),
    multiway: call(
      'multiway',
      MULTIWAY_ARGS,
      async (args: MultiWayTablesArgs) => {
        const tables = await multiwayTables(pluginManager, args)
        return {
          ...tables,
          missingContigs: await axisMissingContigs(
            pluginManager,
            args.adapterConfig,
            tables.lanes.assembly[0],
            args.anchor.regions,
          ),
        }
      },
    ),
    sequence: call(
      'sequence',
      SEQUENCE_ARGS,
      async ({
        assembly,
        region,
        ...given
      }: {
        sequenceAdapter?: Record<string, unknown>
        region: TablesRegion
        assembly?: AssemblyConfig
      }) => {
        const args = { ...given, regions: [region] }
        const { sequenceAdapter, regions } = assembly
          ? await renameRegions(pluginManager, args, await assemblyOf(assembly))
          : args
        if (!sequenceAdapter) {
          throw new Error(
            'a sequence reads through a sequenceAdapter, or an assembly with a sequence',
          )
        }
        const named = regions[0] ?? region
        return referenceSequence(pluginManager, {
          sequenceAdapter,
          region: {
            ...named,
            refName: named.originalRefName ?? named.refName,
          },
        })
      },
    ),
    /**
     * The contigs an assembly's sequence lists, named as the sequence file
     * names them, with `canonical` the assembly's name for each.
     */
    regions: call(
      'regions',
      REGIONS_ARGS,
      async ({ assembly }: { assembly: AssemblyConfig }) => {
        const { regions, canonical } = await assemblyOf(assembly)
        return {
          refName: regions.map(r => r.refName),
          canonical: regions.map(r => canonical(r.refName)),
          start: regions.map(r => r.start),
          end: regions.map(r => r.end),
        }
      },
    ),
    /**
     * Each name as the assembly's canonical name for its contig, through the
     * alias file and in any case, as the browser's location box reads it; a
     * name the assembly does not know comes back as given. `refNames` may be
     * one name, as R sends a vector of length one.
     */
    canonicalNames: call(
      'canonicalNames',
      CANONICAL_NAMES_ARGS,
      async ({
        assembly,
        refNames,
      }: {
        assembly?: AssemblyConfig
        refNames: string | string[]
      }) => {
        if (!assembly) {
          throw new Error(
            'canonicalNames resolves names through an assembly; pass one',
          )
        }
        const names = typeof refNames === 'string' ? [refNames] : refNames
        const { canonical } = await assemblyOf(assembly)
        return { refName: names, canonical: names.map(canonical) }
      },
    ),
    /**
     * What the caches hold, after setting their limit to `limit` bytes where
     * given, `Infinity` for none: a smaller limit evicts at once, keeping the
     * adapters the last call read.
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
