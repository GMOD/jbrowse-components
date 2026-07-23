import { addDisposer, getParent, types } from '@jbrowse/mobx-state-tree'
import { onBecomeObserved } from 'mobx'

import { getConf } from '../configuration/index.ts'
import { adapterConfigCacheKey } from '../data_adapters/dataAdapterCache.ts'
import QuickLRU from '../util/QuickLRU/index.ts'
import {
  getAssemblyRegions,
  getCytobands,
  getRefNameAliases,
} from './assemblyAdapters.ts'
import { getGeneticCodesFromFile, lookupGeneticCodeId } from './geneticCodes.ts'
import { loadRefNameMap } from './loadRefNameMap.ts'
import { defaultRefNameColors } from './refNameColors.ts'
import { buildRefNameMaps, checkRefName } from './refNameMaps.ts'

import type PluginManager from '../PluginManager.ts'
import type { BaseOptions } from '../data_adapters/BaseAdapter/index.ts'
import type RpcManager from '../rpc/RpcManager.ts'
import type { Feature, Region } from '../util/index.ts'
import type { RefNameAliases, RefNameMaps } from './refNameMaps.ts'
import type { IAnyType, Instance } from '@jbrowse/mobx-state-tree'

// re-exported so `@jbrowse/core/assemblyManager/assembly` stays the public entry
// point for these, as plugins import them from here
export { getSequenceAdapterConfig } from './getSequenceAdapterConfig.ts'
export { buildRefNameMaps } from './refNameMaps.ts'
export { lookupGeneticCodeId } from './geneticCodes.ts'
export type { RefNameAliases, RefNameMaps } from './refNameMaps.ts'

type AdapterConf = Record<string, unknown>

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
          | Record<string, string>
          | undefined,

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
        return colors.length === 0 ? defaultRefNameColors : colors
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
       * Resolves once regions + refNameAliases are set, and rejects with the
       * load failure. Idempotent: concurrent callers share one attempt, and a
       * failed attempt is discarded so the next call retries.
       *
       * The rejection is the authoritative signal for a caller that awaits it.
       * `self.error` mirrors it for reactive consumers only (the UI renders it),
       * and must not be consulted after an await: a concurrent retry clears it,
       * so an awaiter reading it can see a cleared error and mistake a failed
       * load for a successful one.
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
            throw e
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
              // nothing awaits this fire-and-forget kick, so swallow the
              // rejection: load() has already logged it and recorded it on
              // self.error, which is what reactive consumers render
              self.load().catch(() => {})
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
        // inline geneticCodes config wins over the loaded sidecar file
        return lookupGeneticCodeId(refName, self.refNameAliases, [
          self.getConf('geneticCodes') ?? {},
          self.loadedGeneticCodes ?? {},
        ])
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

export type AssemblyModel = ReturnType<typeof assemblyFactory>
export type Assembly = Instance<AssemblyModel>
