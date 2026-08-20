import {
  addDisposer,
  getParent,
  isAlive,
  types,
} from '@jbrowse/mobx-state-tree'
import { onBecomeObserved } from 'mobx'

import { getConf } from '../configuration/index.ts'
import { adapterConfigCacheKey } from '../data_adapters/dataAdapterCache.ts'
import QuickLRU from '../util/QuickLRU/index.ts'
import {
  createStatusFanOut,
  createStatusWindow,
  statusFraction,
  statusMessageText,
} from '../util/progress.ts'
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
import type { RpcStatus } from '../util/progress.ts'
import type { RefNameAliases, RefNameMaps } from './refNameMaps.ts'
import type { RefNameMismatch } from './refNameMismatch.ts'
import type { IAnyType, Instance } from '@jbrowse/mobx-state-tree'

// re-exported so `@jbrowse/core/assemblyManager/assembly` stays the public entry
// point for these, as plugins import them from here
export { getSequenceAdapterConfig } from './getSequenceAdapterConfig.ts'
export { buildRefNameMaps } from './refNameMaps.ts'
export { lookupGeneticCodeId } from './geneticCodes.ts'
export { refNameMismatchMessage } from './refNameMismatch.ts'
export type { RefNameAliases, RefNameMaps } from './refNameMaps.ts'
export type { RefNameMismatch } from './refNameMismatch.ts'

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
        /**
         * #volatile
         * What the in-flight load is doing ("Downloading chromosome sizes"), for a
         * view that is showing a spinner while it waits. Same split as
         * BaseDisplayModel's status fields, so the same LoadingProgress UI
         * renders both.
         */
        statusMessage: undefined as string | undefined,
        /**
         * #volatile
         * Fraction in [0,1] when the load reports determinate progress
         */
        statusProgress: undefined as number | undefined,
        /**
         * #volatile
         * adapter cache key -> the empty-intersection verdict `loadRefNameMap`
         * reached for that adapter under this assembly. Sits beside
         * `adapterLoads` and is keyed the same way, so it inherits that cache's
         * once-per-(assembly, adapter config) property: the diagnostic is
         * recorded exactly as often as the map is built, which is once.
         *
         * Written by replacing the Map rather than mutating it — a Map inside a
         * volatile is one observable, not a deeply observable collection, so a
         * `.set()` would leave every reader stale.
         */
        refNameMismatches: new Map<string, RefNameMismatch>(),
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
       * Records what the in-flight load is doing. Its own actions block (rather
       * than sitting next to setLoaded) so loadPre can hand `self.setStatus` to
       * the adapters as a plain callback: it fires after awaits, outside the
       * action that started the load, and a volatile write there has to go
       * through an action of its own.
       */
      setStatus(status?: RpcStatus) {
        self.statusMessage = statusMessageText(status)
        self.statusProgress = statusFraction(status)
      },
      /**
       * #action
       * Record that an adapter's reference names and this assembly's have
       * nothing in common. Diagnostic only: `loadRefNameMap` still returns its
       * map and the track still loads, because a wrong guess here must not take
       * a working track away from anyone.
       */
      setRefNameMismatch(adapterCacheKey: string, mismatch: RefNameMismatch) {
        self.refNameMismatches = new Map(self.refNameMismatches).set(
          adapterCacheKey,
          mismatch,
        )
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

        // The four loads run at once and would otherwise fight over the one
        // status field, and the first to finish would blank the label (the ''
        // every phase helper clears with) while the rest were still going. A
        // fan-out slot each turns them into one aggregate bar. Throttled
        // because a whole-file download reports per chunk and each write
        // repaints the spinner.
        //
        // Guarded, like every other owner of a progress stream, and this one
        // needs it for a reason the display fetches don't have: `Promise.all`
        // rejects on the FIRST of the four to fail, while the other three go on
        // downloading and go on reporting. Without the guard their progress
        // repaints the field the `finally` below has already cleared, so a
        // failed assembly load sits under a live "Downloading cytobands 40%".
        //
        // `isAlive` as well as `loading`, because neither implies the other and
        // the trailing write needs both: a tree destroyed WHILE the four loads
        // are in flight never runs the `finally`, so `loading` is still true
        // when the window's trailing timer fires and setStatus lands on a dead
        // node. That is the case this sink's second isCurrent read exists for.
        const statusWindow = createStatusWindow()
        let loading = true
        const stream = statusWindow.open({
          isCurrent: () => loading && isAlive(self),
          // the one writer, so the clear below is guarded by the same `isAlive`
          // its statuses are — it used to reach the field unguarded
          write: status => {
            if (isAlive(self)) {
              self.setStatus(status)
            }
          },
        })
        const fanOut = createStatusFanOut(stream.statusCallback)
        const optsFor = (): BaseOptions => ({ statusCallback: fanOut() })

        try {
          // The four sources are independent files (sequence index, chromAlias,
          // cytoband, genetic-code sidecar), so they are fetched together rather
          // than in series: an assembly resolved on demand over a CDN paid four
          // sequential round trips for what is one. buildRefNameMaps still needs
          // both regions and aliases, it just doesn't need them to arrive in
          // order. Promise.all rejects with the first failure, which is what a
          // serial chain did too — any one of them failing fails the load.
          const [regions, refNameAliasCollection, cytobands, geneticCodes] =
            await Promise.all([
              getAssemblyRegions({
                config: conf.sequence.adapter,
                pluginManager,
                opts: optsFor(),
              }),
              getRefNameAliases({
                config: conf.refNameAliases?.adapter,
                pluginManager,
                opts: optsFor(),
              }),
              getCytobands({
                config: conf.cytobands?.adapter,
                pluginManager,
                opts: optsFor(),
              }),
              getGeneticCodesFromFile({
                location: self.getConf('geneticCodesLocation'),
                pluginManager,
                opts: optsFor(),
              }),
            ])

          for (const r of regions) {
            checkRefName(r.refName)
          }
          const maps = buildRefNameMaps(regions, refNameAliasCollection)

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
        } finally {
          // the stream's own clear, not a bare write: it has to land (a status
          // inside a closed window would only queue) AND drop what is queued
          // behind it, or the trailing timer puts the last "Downloading …" back
          // on screen after the load has ended. Closing the guard first is what
          // stops a still-running sibling load from writing over it — see the
          // `loading` flag above, and note `clear` deliberately does not consult
          // it.
          loading = false
          stream.clear()
        }
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
       * The whole-contig region for a CANONICAL refName — its extents, and so
       * the bounds anything placing a span on it has to clamp into. Undefined
       * before `regions` loads, and for a refName this assembly doesn't have.
       *
       * Reads the `refNameToIndex` memo, which is why this exists rather than
       * each caller writing `assembly.regions?.find(r => r.refName === name)`:
       * five of them did, and that scan is O(contigs) per call on an assembly
       * whose whole point is that it may have thousands.
       */
      getRegionForRefName(refName: string) {
        const idx = self.refNameToIndex?.get(refName)
        return idx === undefined ? undefined : self.regions?.[idx]
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
       * The total canonical-refName resolver, for any name arriving from
       * outside — off a feature, out of an RPC result, out of a session spec.
       * A name the assembly does not know comes back unchanged, and so does one
       * asked for before the aliases load, where `getCanonicalRefName` answers
       * `undefined` for the first and THROWS for the second.
       *
       * The throw is the reason to call this rather than hand-roll
       * `getCanonicalRefName(x) ?? x`: that idiom looks total and is not, and
       * these resolutions sit in getters and render paths that run from the
       * first frame, before the alias file has landed. Answering with the input
       * there means the comparison downstream may miss, but it misses for one
       * frame and re-runs, where a throw out of a getter takes the view down.
       * `initialized` is the gate for a caller that needs to know which answer
       * it got.
       *
       * See getCanonicalRefName() for what canonical means when
       * `refNameAliases` carries an `override`.
       */
      getCanonicalRefName2(refName: string) {
        return self.initialized
          ? self.getCanonicalRefName(refName) || refName
          : refName
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
       *
       * The load reports progress (the adapter's index download, or for an
       * in-memory adapter the whole file) through the `statusCallback` of
       * whichever caller started it. The others await it silently, and that is
       * deliberate rather than a gap worth plumbing around: the callers sharing
       * an entry are almost always the N displayed regions of ONE display, so
       * their callbacks all write into that display's aggregated status bar and
       * the first one is already reporting on behalf of the rest. The costs of
       * getting this "right" — a listener set per key, registration, and
       * deregistration on settle — buy visibility only for a second display on
       * the same file, and for a first caller torn down mid-load, which is a
       * no-op rather than a hazard because the callbacks are `isAlive`-guarded
       * at the display end.
       *
       * If that ever stops being enough, the fix is not a subscription list
       * bolted on here: it is for the assembly to hold the in-flight status as
       * observable state that consumers read, which is what this model is
       * already made of.
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
      /**
       * #method
       * The empty-intersection verdict for an adapter under this assembly, if
       * the map load reached one. Keyed by `adapterConfigCacheKey`, which is
       * what a track already computes as its `rpcSessionId` — so a track looks
       * up its own diagnostic with no plumbing between here and it. Undefined
       * until the map has loaded, which is the same instant the track's first
       * fetch resolves.
       */
      getRefNameMismatch(adapterCacheKey: string) {
        return self.refNameMismatches.get(adapterCacheKey)
      },
    }))
}

export type AssemblyModel = ReturnType<typeof assemblyFactory>
export type Assembly = Instance<AssemblyModel>
