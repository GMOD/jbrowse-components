import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { isRegionsAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { tablesAdapter } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import {
  alignmentConnectorCurves,
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
import { adapterAssemblyNames } from '@jbrowse/synteny-core'

import { assemblyResolver, renameRegions } from './assembly.ts'
import { engineCache } from './cache.ts'
import { contigNamesOf, fileRegions } from './fileRegions.ts'
import {
  comparativeFileContig,
  displayedRegionsOf,
  framedIn,
  referenceContig,
} from './frame.ts'

import type { AssemblyConfig, ResolvedAssembly } from './assembly.ts'
import type { TablesRegion } from '@jbrowse/core/data_adapters/tables'
import type { AlignmentTablesArgs as AlignmentReadArgs } from '@jbrowse/plugin-alignments/tables'
import type { ContigTablesArgs } from '@jbrowse/plugin-comparative-adapters/tables'
import type { DotplotTablesArgs as DotplotReadArgs } from '@jbrowse/plugin-dotplot-view/tables'
import type { FeatureTablesArgs as FeatureReadArgs } from '@jbrowse/plugin-features/tables'
import type {
  MultiWayTablesArgs as MultiWayReadArgs,
  SyntenyTablesArgs as SyntenyReadArgs,
} from '@jbrowse/plugin-linear-comparative-view/tables'
import type { VariantTablesArgs as VariantReadArgs } from '@jbrowse/plugin-variants/tables'
import type { WiggleTablesArgs as WiggleReadArgs } from '@jbrowse/plugin-wiggle/tables'

export type { AlignmentTables } from '@jbrowse/plugin-alignments/tables'
export type { FeatureTables } from '@jbrowse/plugin-features/tables'
export type {
  ContigTables,
  ContigTablesArgs,
} from '@jbrowse/plugin-comparative-adapters/tables'
export type { DotplotTables } from '@jbrowse/plugin-dotplot-view/tables'
export type {
  MultiWayTables,
  SyntenyTables,
} from '@jbrowse/plugin-linear-comparative-view/tables'
export type { VariantTables } from '@jbrowse/plugin-variants/tables'
export type { WiggleTables } from '@jbrowse/plugin-wiggle/tables'
export { assemblyResolver, renameRegions } from './assembly.ts'
export type { AssemblyConfig, ResolvedAssembly } from './assembly.ts'
export { alignmentColors } from './colors.ts'
export { installBareHostGlobals } from './bareHost.ts'
export type { HostRange, ReadRange } from './bareHost.ts'
export { DEFAULT_CACHE_LIMIT, MIN_ADAPTER_BYTES } from './cache.ts'
export type { CacheUse } from './cache.ts'

interface RegionArgs {
  adapterConfig: Record<string, unknown>
  sequenceAdapter?: Record<string, unknown>
  regions: TablesRegion[]
  displayedRegions?: TablesRegion[]
}

/**
 * A region read's args as a host sends them: `region` reads as
 * `regions: [region]`, `assembly` names the regions in the assembly's
 * spelling, and `rowLimit` is a read's most rows in any one table, past
 * which it is refused, naming the table. A host sets `rowLimit` on a read of
 * a whole file (`fileRegions`), where nothing else bounds the rows.
 */
type HostArgs<A extends RegionArgs> = Omit<
  A,
  'regions' | 'displayedRegions' | 'refNamePosition'
> & {
  region?: TablesRegion
  regions?: TablesRegion[]
  assembly?: AssemblyConfig
  rowLimit?: number
}

/**
 * A comparative axis as a host sends it: `assembly`, an assembly config as
 * the region reads take one, deals a color by contig name its palette in the
 * assembly's order, through its aliases, as the view does.
 */
type HostAxisArgs = Omit<
  SyntenyReadArgs['query'],
  'refNamePosition' | 'displayedRegions'
> & {
  assembly?: AssemblyConfig
}

export type SyntenyTablesArgs = Omit<SyntenyReadArgs, 'query' | 'target'> & {
  query: HostAxisArgs
  target: HostAxisArgs
}
export type DotplotTablesArgs = Omit<DotplotReadArgs, 'x' | 'y'> & {
  x: HostAxisArgs
  y: HostAxisArgs
}

/**
 * A multi-way read as a host sends it: `assemblies`, assembly configs as the
 * region reads take them, each the genome of the lane its `name` or one of
 * its `aliases` names, whose contigs stop that lane's line at their ends, as
 * the display's do, and which frame an anchor locus in its contig.
 */
export type MultiWayTablesArgs = Omit<
  MultiWayReadArgs,
  'laneAssemblyOf' | 'anchor'
> & {
  anchor: Omit<MultiWayReadArgs['anchor'], 'displayedRegions'>
  assemblies?: AssemblyConfig[]
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

/** Every name an assembly config answers to: its `name`, then its `aliases`. */
function assemblyNamesOf({ name, aliases }: AssemblyConfig) {
  if (typeof name !== 'string') {
    throw new TypeError('each of assemblies names its genome in name')
  }
  return [
    name,
    ...(Array.isArray(aliases)
      ? aliases.filter((alias): alias is string => typeof alias === 'string')
      : []),
  ]
}

function refuseUnknownArgs(call: string, args: object, keys: object) {
  const unknown = Object.keys(args).filter(k => !Object.hasOwn(keys, k))
  if (unknown.length > 0) {
    throw new Error(
      `${call} takes no ${unknown.join(', ')}; its args are ${Object.keys(keys).join(', ')}`,
    )
  }
}

function refuseMalformedRegions(
  call: string,
  regions: readonly { refName: unknown; start: unknown; end: unknown }[],
) {
  const malformed = regions.filter(
    ({ refName, start, end }) =>
      typeof refName !== 'string' ||
      typeof start !== 'number' ||
      typeof end !== 'number' ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end <= start,
  )
  if (regions.length === 0) {
    throw new Error(`${call} takes a region or regions to read`)
  } else if (malformed.length > 0) {
    throw new Error(
      `${call} reads a region as a refName and a start of 0 or more before its end, not ${malformed.map(r => JSON.stringify(r)).join(', ')}`,
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
  trackName: true,
  query: true,
  target: true,
  view: true,
} satisfies ArgKeys<SyntenyTablesArgs>

const DOTPLOT_ARGS = {
  adapterConfig: true,
  trackName: true,
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
  assemblies: true,
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
function listContigs(names: string[]) {
  const more =
    names.length > LISTED_CONTIGS
      ? `, and ${names.length - LISTED_CONTIGS} more`
      : ''
  return `${names.slice(0, LISTED_CONTIGS).join(', ')}${more}`
}

interface NamedRegion {
  refName: string
  originalRefName?: string
}

function lacks(names: string[]) {
  const has = new Set(names)
  return ({ refName, originalRefName = refName }: NamedRegion) =>
    has.size > 0 && !has.has(refName) && !has.has(originalRefName)
}

function missingContigsOf(names: string[], regions: NamedRegion[]) {
  const missing = lacks(names)
  return regions.map(region =>
    missing(region)
      ? `${region.refName} is not a contig of this file, whose contigs are ${listContigs(names)}`
      : '',
  )
}

/** Adapters whose reads store their bases as differences from the reference. */
const DECODES_AGAINST_REFERENCE = new Set(['CramAdapter'])

/**
 * A warning for each contig of the regions that the assembly's sequence does
 * not name, under the file's spelling or the reference's, where the file's
 * bases decode against that sequence: a CRAM decodes them as N there.
 */
async function undecodableContigs(
  pluginManager: PluginManager,
  { adapterConfig, sequenceAdapter, regions }: RegionArgs,
) {
  const sequence =
    sequenceAdapter && DECODES_AGAINST_REFERENCE.has(String(adapterConfig.type))
      ? await tablesAdapter(pluginManager, sequenceAdapter, undefined)
      : undefined
  const names =
    sequence && isRegionsAdapter(sequence)
      ? (await sequence.getRegions({})).map(r => r.refName)
      : []
  const missing = lacks(names)
  const contigs = new Set(regions.filter(missing).map(r => r.refName))
  return [...contigs].map(
    refName =>
      `${refName} is not a contig of the assembly's sequence, whose contigs are ${listContigs(names)}, so the CRAM's bases on ${refName} decode as N: an alias table on the assembly can name it as the sequence does`,
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
 * reads with its columns, which the genotype matrix has no row for. The
 * file's fields are read over the regions `featureTables` fetched, the view's
 * margin included, so a feature listed from the margin has them too.
 */
async function featureAndRecordTables(
  pluginManager: PluginManager,
  args: FeatureReadArgs,
) {
  const { fetchRegions: regions, ...features } = await featureTables(
    pluginManager,
    args,
  )
  const vcf = VCF_ADAPTER_TYPES.includes(String(args.adapterConfig.type))
  return {
    ...features,
    warnings:
      features.truncated > 0
        ? [
            `${features.truncated} features in view did not fit the display's rows and are left out of every table; read a smaller region, or a heightMode of fit`,
          ]
        : [],
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
 * A plugin manager holding only the adapters the tables read through: the
 * one a static export with no session fetches and resolves assemblies with.
 */
export function tablesPluginManager() {
  const pluginManager = new PluginManager([
    new TablesPlugin(),
    new BedPlugin(),
    new GFF3Plugin(),
    new GtfPlugin(),
  ])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return pluginManager
}

/**
 * {@link tablesPluginManager} and the table functions over it. Each returns
 * columns: one array per field, so a host reads each table as a data frame.
 * Each call leaves the caches, which every engine in the process shares,
 * within their limit (`cache`).
 */
export function createTablesEngine() {
  const pluginManager = tablesPluginManager()
  const assemblyOf = assemblyResolver(pluginManager)
  const cache = engineCache()
  /**
   * The regions a comparative view displays for an axis: one locus framed in
   * its contig, from the assembly, else the length the file states, else
   * undefined, the regions themselves.
   */
  const displayedAxisRegions = async (
    axis: Omit<HostAxisArgs, 'assembly'>,
    adapterConfig: Record<string, unknown>,
    side: 0 | 1,
    resolved: ResolvedAssembly | undefined,
  ) => {
    const [locus] = axis.regions
    const contig =
      locus && axis.regions.length === 1
        ? ((resolved &&
            (await referenceContig(
              pluginManager,
              locus,
              undefined,
              resolved,
            ))) ??
          (await comparativeFileContig(pluginManager, {
            adapterConfig,
            side,
            assemblyName: axis.assemblyName,
            refName: locus.refName,
          })))
        : undefined
    return contig ? framedIn(axis.regions, contig) : undefined
  }
  const positioned = async (
    { assembly, ...axis }: HostAxisArgs,
    adapterConfig: Record<string, unknown>,
    side: 0 | 1,
  ) => {
    const resolved = assembly ? await assemblyOf(assembly) : undefined
    return {
      ...axis,
      displayedRegions: await displayedAxisRegions(
        axis,
        adapterConfig,
        side,
        resolved,
      ),
      refNamePosition: resolved?.refNamePosition,
    }
  }
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
    table: (
      pm: PluginManager,
      args: A,
      assembly: ResolvedAssembly | undefined,
    ) => Promise<T>,
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
        refuseMalformedRegions(name, regions)
        const given = { ...rest, regions } as A
        const resolved = assembly ? await assemblyOf(assembly) : undefined
        const args = resolved
          ? await renameRegions(pluginManager, given, resolved)
          : given
        const displayedRegions = await displayedRegionsOf(
          pluginManager,
          args,
          resolved,
        )
        const [missing, tables] = await Promise.all([
          missingContigs(pluginManager, args),
          table(pluginManager, { ...args, displayedRegions }, resolved),
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
    alignments: regionRead(
      'alignments',
      ALIGNMENTS_ARGS,
      async (pm, args: AlignmentReadArgs, assembly) => {
        const [tables, undecodable] = await Promise.all([
          alignmentTables(pm, {
            ...args,
            refNamePosition: assembly?.refNamePosition,
          }),
          undecodableContigs(pm, args),
        ])
        return { ...tables, warnings: [...tables.warnings, ...undecodable] }
      },
    ),
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
    alignmentConnectorCurves,
    synteny: call('synteny', SYNTENY_ARGS, async (args: SyntenyTablesArgs) => {
      const tables = await syntenyTables(pluginManager, {
        ...args,
        query: await positioned(args.query, args.adapterConfig, 0),
        target: await positioned(args.target, args.adapterConfig, 1),
      })
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
      const tables = await dotplotTables(pluginManager, {
        ...args,
        x: await positioned(args.x, args.adapterConfig, 0),
        y: await positioned(args.y, args.adapterConfig, 1),
      })
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
      async ({ assemblies = [], ...args }: MultiWayTablesArgs) => {
        const lanes = new Map(
          (
            await Promise.all(
              assemblies.map(async config => {
                const names = assemblyNamesOf(config)
                const resolved = await assemblyOf(config)
                return names.map(name => [name, resolved] as const)
              }),
            )
          ).flat(),
        )
        const { anchor } = args
        const anchorName =
          anchor.assemblyName ?? adapterAssemblyNames(args.adapterConfig)[0]
        const tables = await multiwayTables(pluginManager, {
          ...args,
          anchor: {
            ...anchor,
            displayedRegions: await displayedAxisRegions(
              anchor,
              args.adapterConfig,
              0,
              anchorName === undefined ? undefined : lanes.get(anchorName),
            ),
          },
          laneAssemblyOf: name => lanes.get(name),
        })
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
