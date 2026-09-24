import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import { hydrateTrackConfig, readConfObject } from '../configuration/index.ts'
import { adapterConfigCacheKey } from '../data_adapters/dataAdapterCache.ts'
import QuickLRU from '../util/QuickLRU/index.ts'
import { checkAbortSignal, isAbortException } from '../util/aborting.ts'
import { allSessionTracks, canonicalAssemblyNames } from '../util/tracks.ts'

import type PluginManager from '../PluginManager.ts'
import type { AnyConfigurationModel } from '../configuration/index.ts'
import type {
  BaseTextSearchAdapter,
  BaseTextSearchArgs,
} from '../data_adapters/BaseAdapter/index.ts'
import type BaseResult from './BaseResults.ts'

// A misconfigured or unreachable index (a 404 .ix, a config missing
// ixFilePath) must not take down search as a whole: the remaining indexes, and
// the refName results the caller merges in afterwards, are still useful. The
// failures are logged and handed back, so a miss can say an index failed rather
// than that the name is absent. An abort is not a failure — every keystroke
// supersedes the previous query, so logging those would turn normal typing
// into console spam.
async function settle<T>(promises: Promise<T>[], message: string) {
  const values: T[] = []
  const failures: unknown[] = []
  for (const settled of await Promise.allSettled(promises)) {
    if (settled.status === 'fulfilled') {
      values.push(settled.value)
    } else if (!isAbortException(settled.reason)) {
      console.error(message, settled.reason)
      failures.push(settled.reason)
    }
  }
  return { values, failures }
}

export interface SearchIndex {
  conf: AnyConfigurationModel
  /** the track a per-track index belongs to */
  trackId?: string
}

export interface TextSearchReport {
  results: BaseResult[]
  /** the indexes covering the assembly, zero when it has none to search */
  indexCount: number
  /** what each index that could not answer threw */
  failures: unknown[]
}

export default class TextSearchManager {
  adapterCache = new QuickLRU<string, BaseTextSearchAdapter>({
    maxSize: 15,
  })

  constructor(public pluginManager: PluginManager) {}

  clearCache() {
    this.adapterCache.clear()
  }

  loadTextSearchAdapters(assemblyName: string) {
    return settle(
      this.relevantIndexes(assemblyName).map(async ({ conf, trackId }) => {
        const key = adapterConfigCacheKey(getSnapshot(conf))
        const cached = this.adapterCache.get(key)
        if (cached) {
          return { adapter: cached, trackId }
        } else {
          const adapterType = this.pluginManager.getTextSearchAdapterType(
            conf.type,
          )
          const AdapterClass = await adapterType.getAdapterClass()
          const adapter = new AdapterClass(
            conf,
            undefined,
            this.pluginManager,
          ) as BaseTextSearchAdapter
          this.adapterCache.set(key, adapter)
          return { adapter, trackId }
        }
      }),
      'failed to load text search adapter',
    )
  }

  relevantAdapters(assemblyName: string) {
    return this.relevantIndexes(assemblyName).map(index => index.conf)
  }

  relevantIndexes(assemblyName: string): SearchIndex[] {
    const { rootModel } = this.pluginManager
    // jbrowse is typed as a bare state tree node, so its config slots need a
    // shape assertion; both it and the session are absent until a session is
    // loaded, which is before anything can search
    const { aggregateTextSearchAdapters = [] } = (rootModel?.jbrowse ?? {}) as {
      aggregateTextSearchAdapters?: AnyConfigurationModel[]
    }
    // The caller searches an assembly by the name the session knows it by,
    // while an index names whatever the track it was built from named — so both
    // sides go through the aliases, as every other "does this belong to this
    // assembly" test in the app now does. Absent a session there is nothing to
    // resolve against and the raw name is the best available answer.
    const assemblyManager = rootModel?.session?.assemblyManager
    const canonical = (names: string[]) =>
      assemblyManager
        ? canonicalAssemblyNames(names, assemblyManager)
        : names.filter(name => !!name)
    const [wanted] = canonical([assemblyName])
    const matches = (names: string[] | undefined) =>
      !!wanted && !!names && canonical(names).includes(wanted)
    const session = rootModel?.session
    return [
      ...this.getAdaptersWithAssembly(matches, aggregateTextSearchAdapters).map(
        conf => ({ conf }),
      ),
      ...this.getTrackAdaptersWithAssembly(
        matches,
        session ? allSessionTracks(session) : [],
      ),
    ]
  }

  getAdaptersWithAssembly(
    matches: (names: string[] | undefined) => boolean,
    confs: AnyConfigurationModel[],
  ) {
    return confs.filter(c =>
      matches(readConfObject(c, 'assemblyNames') as string[] | undefined),
    )
  }

  getTrackAdaptersWithAssembly(
    matches: (names: string[] | undefined) => boolean,
    confs: AnyConfigurationModel[],
  ) {
    return confs
      .filter(conf => {
        const indexNames = readConfObject(conf, [
          'textSearching',
          'textSearchAdapter',
          'assemblyNames',
        ]) as string[] | undefined
        return (
          !!readConfObject(conf, ['textSearching', 'textSearchAdapter']) &&
          matches(
            indexNames?.length
              ? indexNames
              : (readConfObject(conf, 'assemblyNames') as string[] | undefined),
          )
        )
      })
      .flatMap(track => {
        const live = isStateTreeNode(track)
          ? track
          : hydrateTrackConfig(this.pluginManager, track)
        const conf = live?.textSearching.textSearchAdapter as
          | AnyConfigurationModel
          | undefined
        return conf
          ? [{ conf, trackId: readConfObject(track, 'trackId') as string }]
          : []
      })
  }

  async search(args: BaseTextSearchArgs, assemblyName: string) {
    return (await this.searchIndexes(args, assemblyName)).results
  }

  async searchIndexes(
    args: BaseTextSearchArgs,
    assemblyName: string,
  ): Promise<TextSearchReport> {
    const loaded = await this.loadTextSearchAdapters(assemblyName)
    const searched = await settle(
      loaded.values.map(async ({ adapter, trackId }) => {
        const found = await adapter.searchIndex(args)
        // a per-track index answers for its track, whether or not its records
        // name it — a UCSC hub's index holds only feature names
        if (trackId) {
          for (const result of found) {
            result.trackId ??= trackId
          }
        }
        return found
      }),
      'text search adapter failed',
    )
    // the ranking below is the expensive half — a dynamic import plus a fuzzy
    // sort over every hit — and a superseded keystroke has no use for it.
    // Checked here rather than only inside the adapters because settle drops an
    // abort thrown by one of them, which would otherwise land here as "no
    // results from that index" and rank the rest
    checkAbortSignal(args.signal)
    return {
      results: await this.sortResults({
        args,
        results: searched.values.flat(),
      }),
      indexCount: loaded.values.length + loaded.failures.length,
      failures: [...loaded.failures, ...searched.failures],
    }
  }

  // Ranks, never filters: the adapters have already decided what matches, and
  // they match against attributes the display string does not always carry (a
  // multi-word query hits e.g. the description while the display string is just
  // the gene name). uFuzzy floats the results whose display string matches the
  // query to the top and the rest keep their adapter order behind them.
  //
  // uFuzzy is imported here rather than at the top of the file so its 26KB stay
  // out of the startup bundle: TextSearchManager is constructed by BaseRootModel
  // on every page load, but nothing ranks results until the user searches.
  async sortResults({
    results,
    args,
  }: {
    results: BaseResult[]
    args: BaseTextSearchArgs
  }) {
    const { default: uFuzzy } = await import('@leeoniya/ufuzzy')
    const uf = new uFuzzy({})

    // this code sample relatively unmodified from
    // https://github.com/leeoniya/uFuzzy?tab=readme-ov-file#example
    const haystack = results.map(r => r.getDisplayString())
    const needle = args.queryString

    // false positive, this is not Array.prototype.filter
    const idxs = uf.filter(haystack, needle)
    const ranked: BaseResult[] = []
    const seen = new Set<number>()

    // idxs can be null when the needle is non-searchable (has no alpha-numeric chars)
    if (idxs?.length) {
      const info = uf.info(idxs, haystack, needle)

      // order is a double-indirection array (a re-order of the passed-in idxs)
      // this allows corresponding info to be grabbed directly by idx, if needed
      const order = uf.sort(info, haystack, needle)

      for (const element of order) {
        // using info.idx here instead of idxs because uf.info() may have
        // further reduced the initial idxs based on prefix/suffix rules
        const idx = info.idx[element]!
        seen.add(idx)
        ranked.push(results[idx]!)
      }
    }
    return [...ranked, ...results.filter((_, i) => !seen.has(i))]
  }
}
