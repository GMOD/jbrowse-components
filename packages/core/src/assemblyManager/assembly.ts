import {
  addDisposer,
  getParent,
  getSnapshot,
  types,
} from '@jbrowse/mobx-state-tree'
import { onBecomeObserved } from 'mobx'

import { getConf } from '../configuration/index.ts'
import { adapterConfigCacheKey } from '../data_adapters/dataAdapterCache.ts'
import QuickLRU from '../util/QuickLRU/index.ts'
import { isBlank } from '../util/assemblyConfigUtils.ts'
import { parseTranslTable } from '../util/geneticCodes.ts'
import { openLocation } from '../util/io/index.ts'

import type PluginManager from '../PluginManager.ts'
import type { AnyConfigurationModel } from '../configuration/index.ts'
import type {
  Alias,
  BaseOptions,
  BaseRefNameAliasAdapter,
  CytobandAdapter,
  RegionsAdapter,
} from '../data_adapters/BaseAdapter/index.ts'
import type RpcManager from '../rpc/RpcManager.ts'
import type { Feature, Region } from '../util/index.ts'
import type { FileLocation } from '../util/types/index.ts'
import type { IAnyType, Instance } from '@jbrowse/mobx-state-tree'

type AdapterConf = Record<string, unknown>

/* biome-ignore lint/complexity/useRegexLiterals: */
const refNameRegex = new RegExp(
  '[0-9A-Za-z!#$%&+./:;?@^_|~-][0-9A-Za-z!#$%&*+./:;=?@^_|~-]*',
)

// Based on the UCSC Genome Browser chromosome color palette:
// https://github.com/ucscGenomeBrowser/kent/blob/a50ed53aff81d6fb3e34e6913ce18578292bc24e/src/hg/inc/chromColors.h
// Some colors darkened to have at least a 3:1 contrast ratio on a white
// background
const refNameColors = [
  'rgb(153, 102, 0)',
  'rgb(102, 102, 0)',
  'rgb(153, 153, 30)',
  'rgb(204, 0, 0)',
  'rgb(255, 0, 0)',
  'rgb(255, 0, 204)',
  'rgb(165, 132, 132)', // originally 'rgb(255, 204, 204)'
  'rgb(204, 122, 0)', // originally rgb(255, 153, 0)'
  'rgb(178, 142, 0)', // originally 'rgb(255, 204, 0)'
  'rgb(153, 153, 0)', // originally 'rgb(255, 255, 0)'
  'rgb(122, 153, 0)', // originally 'rgb(204, 255, 0)'
  'rgb(0, 165, 0)', // originally 'rgb(0, 255, 0)'
  'rgb(53, 128, 0)',
  'rgb(0, 0, 204)',
  'rgb(96, 145, 242)', // originally 'rgb(102, 153, 255)'
  'rgb(107, 142, 178)', // originally 'rgb(153, 204, 255)'
  'rgb(0, 165, 165)', // originally 'rgb(0, 255, 255)'
  'rgb(122, 153, 153)', // originally 'rgb(204, 255, 255)'
  'rgb(153, 0, 204)',
  'rgb(204, 51, 255)',
  'rgb(173, 130, 216)', // originally 'rgb(204, 153, 255)'
  'rgb(102, 102, 102)',
  'rgb(145, 145, 145)', // originally 'rgb(153, 153, 153)'
  'rgb(142, 142, 142)', // originally 'rgb(204, 204, 204)'
  'rgb(142, 142, 107)', // originally 'rgb(204, 204, 153)'
  'rgb(96, 163, 48)', // originally 'rgb(121, 204, 61)'
]

// the subset of the assembly model that loadRefNameMap reads; using a Pick
// (rather than the full Assembly) lets `self` satisfy it from inside the
// getRefNameMapForAdapter view, which doesn't yet see its own sibling methods
type RefNameMapAssembly = Pick<
  Assembly,
  | 'name'
  | 'load'
  | 'error'
  | 'regions'
  | 'refNameAliases'
  | 'rpcManager'
  | 'configuration'
  | 'getCanonicalRefName'
>

/**
 * The assembly's reference-sequence adapter config as a plain snapshot, or
 * undefined if the assembly (or its config) isn't available. Snapshotted
 * because MST nodes can't be assigned into another tree or sent over RPC.
 * configuration is a safeReference, so it's either a live node (getSnapshot is
 * safe) or undefined (?. handles it).
 */
export function getSequenceAdapterConfig(
  assembly?: Pick<Assembly, 'configuration'>,
): Record<string, unknown> | undefined {
  const adapter = assembly?.configuration?.sequence?.adapter
  return adapter ? getSnapshot(adapter) : undefined
}

async function loadRefNameMap(
  assembly: RefNameMapAssembly,
  adapterConfig: unknown,
  options: BaseOptions,
): Promise<RefNameAliases> {
  const { sessionId } = options
  if (!sessionId) {
    throw new Error('sessionId is required for loadRefNameMap')
  }
  // load() is idempotent and resolves only after regions + refNameAliases are
  // set (or setError ran), so awaiting it is a direct, promise-based
  // alternative to a reactive `when` on those volatiles
  await assembly.load()
  if (assembly.error) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw assembly.error
  }

  // pass the assembly's sequence adapter config (as a snapshot, since MST
  // objects can't be assigned elsewhere) so BAM/CRAM adapters can cache it for
  // later use when fetching features
  const sequenceAdapter = getSequenceAdapterConfig(assembly)

  const refNames = await assembly.rpcManager.call(
    sessionId,
    'CoreGetRefNames',
    {
      adapterConfig: adapterConfig as Record<string, unknown>,
      assemblyName: assembly.name,
      sequenceAdapter,
      // stopToken intentionally not passed, fixes issues like #2221.
      // alternative fix #2540 was proposed but non-working currently
      stopToken: undefined,
      // statusCallback IS forwarded (unlike stopToken): the data adapter's index
      // download happens here during refname mapping (getRefNames -> setup), so
      // this is the only place its "Downloading index" progress can surface.
      statusCallback: options.statusCallback,
    },
    { timeout: 1000000 },
  )

  const { refNameAliases } = assembly
  if (!refNameAliases) {
    throw new Error(`error loading assembly ${assembly.name}'s refNameAliases`)
  }

  const result: RefNameAliases = {}
  for (const name of refNames) {
    checkRefName(name)
    result[assembly.getCanonicalRefName(name) ?? name] = name
  }
  return result
}

// Valid refName pattern from https://samtools.github.io/hts-specs/SAMv1.pdf
function checkRefName(refName: string) {
  if (!refNameRegex.test(refName)) {
    throw new Error(`Encountered invalid refName: "${refName}"`)
  }
}

type RefNameAliases = Record<string, string>

export interface RefNameMaps {
  refNameAliases: RefNameAliases
  lowerCaseRefNameAliases: RefNameAliases
  allRefNamesWithLowerCase: Set<string>
  canonicalToSeqAdapterRefNames: Record<string, string>
}

// Build the alias/name lookups used throughout the model from the sequence
// adapter's regions plus the optional refNameAliasAdapter collection.
export function buildRefNameMaps(
  regions: { refName: string }[],
  refNameAliasCollection: Alias[],
): RefNameMaps {
  const fastaRefNames = new Set(regions.map(r => r.refName))
  const refNameAliases: RefNameAliases = {}
  for (const { refName, aliases, override } of refNameAliasCollection) {
    // override:true (the default), or unset as with chromAlias files whose
    // refName column already matches the FASTA, makes the adapter's refName the
    // canonical name. override:false instead keeps the sequence adapter's own
    // name canonical, resolving it from whichever alias matches a FASTA contig.
    const canonical =
      override === false
        ? (aliases.find(a => fastaRefNames.has(a)) ?? refName)
        : refName
    for (const alias of aliases) {
      checkRefName(alias)
      refNameAliases[alias] = canonical
    }
    refNameAliases[canonical] = canonical
  }

  // identity-map each region's refName (??= so an override alias wins) and
  // record where the canonical name differs from the sequence adapter's name
  const canonicalToSeqAdapterRefNames: Record<string, string> = {}
  for (const { refName } of regions) {
    const canonical = (refNameAliases[refName] ??= refName)
    if (canonical !== refName) {
      canonicalToSeqAdapterRefNames[canonical] = refName
    }
  }

  // the normal-cased name list plus a lowercase index, so getCanonicalRefName
  // can resolve a lower-case query
  const lowerCaseRefNameAliases: RefNameAliases = {}
  const allRefNamesWithLowerCase = new Set<string>()
  for (const [key, canonical] of Object.entries(refNameAliases)) {
    const lower = key.toLowerCase()
    lowerCaseRefNameAliases[lower] = canonical
    allRefNamesWithLowerCase.add(key)
    allRefNamesWithLowerCase.add(lower)
  }

  return {
    refNameAliases,
    lowerCaseRefNameAliases,
    allRefNamesWithLowerCase,
    canonicalToSeqAdapterRefNames,
  }
}

export interface BasicRegion {
  start: number
  end: number
  refName: string
  assemblyName: string
}

/**
 * #stateModel Assembly
 */
export default function assemblyFactory(
  assemblyConfigType: IAnyType,
  pluginManager: PluginManager,
) {
  return types
    .model({
      /**
       * #property
       */
      configuration: types.safeReference(assemblyConfigType),
    })
    .volatile(() => {
      // typed local so `error` is `unknown` (a type assertion here gets stripped
      // by no-unnecessary-type-assertion)
      const error: unknown = undefined
      return {
        /**
         * #volatile
         */
        error,
        /**
         * #volatile
         */
        loadingP: undefined as Promise<void> | undefined,
        // per-instance promise cache for refName maps. Kept on the instance,
        // not the factory closure, because each map resolves an adapter's
        // contigs against THIS assembly's aliases: a closure cache shared by
        // all assemblies would return the wrong map when the same adapter
        // config is queried under two assemblies (e.g. comparative views).
        // Loads are never aborted, so memoizing the promise (keyed by adapter
        // config) is enough to dedupe concurrent calls.
        adapterLoads: new QuickLRU<string, Promise<RefNameAliases>>({
          maxSize: 1000,
        }),
        /**
         * #volatile
         */
        volatileRegions: undefined as BasicRegion[] | undefined,
        /**
         * #volatile
         */
        refNameAliases: undefined as RefNameAliases | undefined,

        /**
         * #volatile
         * Maps canonical refName -> sequence adapter refName (in FASTA).
         * These may differ when refNameAliases with override:true remap names.
         */
        canonicalToSeqAdapterRefNames: undefined as
          Record<string, string> | undefined,

        /**
         * #volatile
         */
        cytobands: undefined as Feature[] | undefined,
        /**
         * #volatile
         * refName -> NCBI genetic-code id loaded from `geneticCodesLocation`;
         * merged with (and overridden by) the inline `geneticCodes` config slot
         */
        loadedGeneticCodes: undefined as Record<string, number> | undefined,
        /**
         * #volatile
         * Precomputed in loadPre to avoid expensive synchronous computation
         * when MobX triggers the autorun after setLoaded
         */
        lowerCaseRefNameAliases: undefined as RefNameAliases | undefined,
        /**
         * #volatile
         * Precomputed in loadPre to avoid expensive synchronous computation
         * when MobX triggers the autorun after setLoaded
         */
        allRefNamesWithLowerCase: undefined as Set<string> | undefined,
      }
    })
    .views(self => ({
      /**
       * #method
       */
      getConf(arg: string) {
        return self.configuration ? getConf(self, arg) : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get name(): string {
        return self.getConf('name') || ''
      },

      /**
       * #getter
       */
      get aliases(): string[] {
        return self.getConf('aliases') ?? []
      },

      /**
       * #getter
       */
      get displayName(): string {
        return self.getConf('displayName') || self.getConf('name') || ''
      },
      /**
       * #getter
       */
      get refNameColors() {
        const colors: string[] = self.getConf('refNameColors') ?? []
        return colors.length === 0 ? refNameColors : colors
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get allAliases() {
        return [self.name, ...self.aliases]
      },
      /**
       * #method
       */
      hasName(name: string) {
        return this.allAliases.includes(name)
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Applies all load-time state in a single transaction so dependent
       * autoruns fire once, with the precomputed lowercase/name lookups already
       * in place by the time refNameAliases becomes observable.
       */
      setLoaded({
        regions,
        refNameAliases,
        lowerCaseRefNameAliases,
        allRefNamesWithLowerCase,
        canonicalToSeqAdapterRefNames,
        cytobands,
        geneticCodes,
      }: RefNameMaps & {
        regions: Region[]
        cytobands: Feature[]
        geneticCodes: Record<string, number>
      }) {
        self.volatileRegions = regions
        self.refNameAliases = refNameAliases
        self.lowerCaseRefNameAliases = lowerCaseRefNameAliases
        self.allRefNamesWithLowerCase = allRefNamesWithLowerCase
        self.canonicalToSeqAdapterRefNames = canonicalToSeqAdapterRefNames
        self.cytobands = cytobands
        self.loadedGeneticCodes = geneticCodes
      },
      /**
       * #action
       */
      setError(e: unknown) {
        self.error = e
      },
      /**
       * #action
       */
      setLoadingP(p?: Promise<void>) {
        self.loadingP = p
      },
      /**
       * #action
       */
      async loadPre() {
        const conf = self.configuration
        if (!conf) {
          // safeReference resolved to undefined: the underlying config was
          // removed from the tree (the assemblyManager autorun will prune this
          // orphaned assembly). Fail with a clear message instead of a deep
          // "Cannot read 'type' of undefined" from the adapter instantiation.
          throw new Error('assembly configuration is not available')
        }
        const assemblyName = self.name

        const regions = await getAssemblyRegions({
          config: conf.sequence.adapter,
          pluginManager,
        })
        for (const r of regions) {
          checkRefName(r.refName)
        }

        const refNameAliasCollection = await getRefNameAliases({
          config: conf.refNameAliases?.adapter,
          pluginManager,
        })
        const maps = buildRefNameMaps(regions, refNameAliasCollection)

        const cytobands = await getCytobands({
          config: conf.cytobands?.adapter,
          pluginManager,
        })

        const geneticCodes = await getGeneticCodesFromFile({
          location: self.getConf('geneticCodesLocation'),
          pluginManager,
        })

        this.setLoaded({
          ...maps,
          regions: regions.map(r => ({
            ...r,
            refName: maps.refNameAliases[r.refName] ?? r.refName,
            assemblyName,
          })),
          cytobands,
          geneticCodes,
        })
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      load() {
        if (!self.loadingP) {
          // clear any prior failure so a successful retry isn't masked by the
          // stale error left over from the previous attempt
          self.setError(undefined)
          self.loadingP = self.loadPre().catch((e: unknown) => {
            console.error(e)
            self.setLoadingP(undefined)
            self.setError(e)
          })
        }
        return self.loadingP
      },
    }))
    .actions(self => ({
      afterAttach() {
        // lazy load: start fetching the first time something observes the
        // loaded state reactively (a view rendering this assembly, an autorun,
        // a `when` predicate), keeping the getters below pure. Both volatiles
        // are watched because consumers observe them independently (regions vs
        // refNameAliases/allRefNames); load() is idempotent so the overlapping
        // triggers collapse to a single fetch.
        for (const prop of ['volatileRegions', 'refNameAliases'] as const) {
          addDisposer(
            self,
            onBecomeObserved(self, prop, () => {
              void self.load()
            }),
          )
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get initialized() {
        return !!self.refNameAliases
      },

      /**
       * #getter
       */
      get regions() {
        return self.volatileRegions
      },

      /**
       * #getter
       * note: lowerCaseRefNameAliases not included here: this allows the list
       * of refnames to be just the "normal casing", but things like
       * getCanonicalRefName can resolve a lower-case name if needed
       */
      get allRefNames() {
        return !self.refNameAliases
          ? undefined
          : Object.keys(self.refNameAliases)
      },
      /**
       * #getter
       */
      get rpcManager(): RpcManager {
        // parent chain: assembly -> assemblies[] -> assemblyManager
        return getParent<{ rpcManager: RpcManager }>(self, 2).rpcManager
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get refNames() {
        return self.regions?.map(region => region.refName)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * memoized refName -> first region index, so getRefNameColor is O(1)
       * instead of an O(n) indexOf per call (matters for assemblies with many
       * contigs rendered in overview scalebars/rulers)
       */
      get refNameToIndex() {
        const { refNames } = self
        if (!refNames) {
          return undefined
        }
        const map = new Map<string, number>()
        for (const [i, refName] of refNames.entries()) {
          if (!map.has(refName)) {
            map.set(refName, i)
          }
        }
        return map
      },
    }))
    .views(self => ({
      /**
       * #method
       * Returns the canonical refName for a given alias or refName.
       * Note: The canonical name may differ from what's in the FASTA file when
       * refNameAliases with override:true are configured. To get the name that
       * matches the FASTA file, use getSeqAdapterRefName().
       */
      getCanonicalRefName(refName: string) {
        if (!self.refNameAliases || !self.lowerCaseRefNameAliases) {
          throw new Error(
            'aliases not loaded, we expect them to be loaded before getCanonicalRefName can be called',
          )
        }

        return (
          self.refNameAliases[refName] ||
          self.lowerCaseRefNameAliases[refName.toLowerCase()]
        )
      },
      /**
       * #method
       */
      getRefNameColor(refName: string) {
        const idx = self.refNameToIndex?.get(refName)
        return idx === undefined
          ? undefined
          : self.refNameColors[idx % self.refNameColors.length]
      },
      /**
       * #method
       * NCBI genetic-code (translation table) id for a refName, from the
       * assembly's `geneticCodes` config map (e.g. a mitochondrial contig = 2).
       * Falls back to the standard code (1) for unlisted refNames.
       */
      getGeneticCodeId(refName: string) {
        // a map key may be the canonical refName or an alias of it: a config
        // generated from NCBI keys by the GFF's RefSeq accession while the
        // assembly's canonical name can be the UCSC-style one, bridged here via
        // refNameAliases (loaded from the chromAlias file). Direct key first
        // (the common case), then the alias scan.
        const aliases = self.refNameAliases
        const lookup = (map: Record<string, number>) =>
          map[refName] ??
          Object.entries(map).find(([k]) => aliases?.[k] === refName)?.[1]
        // inline geneticCodes config wins over the loaded sidecar file
        return (
          lookup(self.getConf('geneticCodes') ?? {}) ??
          lookup(self.loadedGeneticCodes ?? {}) ??
          1
        )
      },
      /**
       * #method
       * Given a canonical refName, returns the refName used by the sequence
       * adapter (what's in the FASTA file). Falls back to the input if no
       * mapping exists.
       */
      getSeqAdapterRefName(canonicalRefName: string) {
        return (
          self.canonicalToSeqAdapterRefNames?.[canonicalRefName] ??
          canonicalRefName
        )
      },
    }))
    .views(self => ({
      /**
       * #method
       * Returns canonical refName, falling back to input if not found.
       * See getCanonicalRefName() for details.
       */
      getCanonicalRefName2(refName: string) {
        return self.getCanonicalRefName(refName) || refName
      },
      /**
       * #method
       */
      isValidRefName(refName: string) {
        if (!self.refNameAliases) {
          throw new Error(
            'isValidRefName cannot be called yet, the assembly has not finished loading',
          )
        }
        return !!self.getCanonicalRefName(refName)
      },
    }))
    .views(self => ({
      /**
       * #method
       * get Map of `canonical-name -> adapter-specific-name`, memoized per
       * adapter config so concurrent callers share one load
       */
      getRefNameMapForAdapter(
        adapterConf: AdapterConf,
        options: BaseOptions,
      ): Promise<RefNameAliases> {
        if (!options.sessionId) {
          throw new Error('sessionId is required')
        }
        const key = adapterConfigCacheKey(adapterConf)
        let entry = self.adapterLoads.get(key)
        if (!entry) {
          // evict on failure so a later call can retry
          entry = loadRefNameMap(self, adapterConf, options).catch(
            (e: unknown) => {
              self.adapterLoads.delete(key)
              throw e
            },
          )
          self.adapterLoads.set(key, entry)
        }
        return entry
      },
    }))
}

async function instantiateAdapter<T>(
  config: AnyConfigurationModel,
  pluginManager: PluginManager,
) {
  const CLASS = await pluginManager
    .getAdapterType(config.type)
    .getAdapterClass()
  return new CLASS(config, undefined, pluginManager) as T
}

async function getRefNameAliases({
  config,
  pluginManager,
}: {
  config: AnyConfigurationModel
  pluginManager: PluginManager
}) {
  const adapter = await instantiateAdapter<BaseRefNameAliasAdapter>(
    config,
    pluginManager,
  )
  return adapter.getRefNameAliases({})
}

async function getCytobands({
  config,
  pluginManager,
}: {
  config: AnyConfigurationModel
  pluginManager: PluginManager
}) {
  const adapter = await instantiateAdapter<CytobandAdapter>(
    config,
    pluginManager,
  )
  return adapter.getData()
}

// Loads an optional `refName<TAB>geneticCodeId` TSV (# comments allowed) into a
// map; an empty location yields {} so the inline geneticCodes slot is the only
// source. Kept as a plain file read rather than a pluggable adapter because the
// mapping is trivial and format-fixed.
async function getGeneticCodesFromFile({
  location,
  pluginManager,
}: {
  location: FileLocation | undefined
  pluginManager: PluginManager
}): Promise<Record<string, number>> {
  const map: Record<string, number> = {}
  // skip the config slot's default blank location ({ uri: '' }); a real file
  // yields the refName -> geneticCodeId map
  if (location && !isBlank(location)) {
    const text = await openLocation(location, pluginManager).readFile('utf8')
    for (const line of text.split(/\r\n|\r|\n/)) {
      if (line && !line.startsWith('#')) {
        const [refName, codeColumn] = line.split('\t')
        const id = parseTranslTable(codeColumn)
        if (refName && id !== undefined) {
          map[refName] = id
        }
      }
    }
  }
  return map
}

async function getAssemblyRegions({
  config,
  pluginManager,
}: {
  config: AnyConfigurationModel
  pluginManager: PluginManager
}) {
  const adapter = await instantiateAdapter<RegionsAdapter>(
    config,
    pluginManager,
  )
  return adapter.getRegions({})
}

export type AssemblyModel = ReturnType<typeof assemblyFactory>
export type Assembly = Instance<AssemblyModel>
