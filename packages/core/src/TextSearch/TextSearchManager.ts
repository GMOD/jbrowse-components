import { readConfObject } from '../configuration/index.ts'
import QuickLRU from '../util/QuickLRU/index.ts'
import { isAbortException } from '../util/aborting.ts'
import { checkStopToken } from '../util/stopToken.ts'
import { canonicalAssemblyNames } from '../util/tracks.ts'

import type PluginManager from '../PluginManager.ts'
import type { AnyConfigurationModel } from '../configuration/index.ts'
import type {
  BaseTextSearchAdapter,
  BaseTextSearchArgs,
} from '../data_adapters/BaseAdapter/index.ts'
import type BaseResult from './BaseResults.ts'

// A misconfigured or unreachable index (a 404 .ix, a config missing
// ixFilePath) must not take down search as a whole: the remaining indexes, and
// the refName results the caller merges in afterwards, are still useful. Log
// the failures and keep going rather than rejecting. An abort is not a failure
// — every keystroke supersedes the previous query, so logging those would turn
// normal typing into console spam.
async function keepFulfilled<T>(promises: Promise<T>[], message: string) {
  const out: T[] = []
  for (const settled of await Promise.allSettled(promises)) {
    if (settled.status === 'fulfilled') {
      out.push(settled.value)
    } else if (!isAbortException(settled.reason)) {
      console.error(message, settled.reason)
    }
  }
  return out
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
    return keepFulfilled(
      this.relevantAdapters(assemblyName).map(async conf => {
        const adapterId = readConfObject(conf, 'textSearchAdapterId')
        const r = this.adapterCache.get(adapterId)
        if (r) {
          return r
        } else {
          const adapterType = this.pluginManager.getTextSearchAdapterType(
            conf.type,
          )
          const AdapterClass = await adapterType.getAdapterClass()
          const adapterInstance = new AdapterClass(
            conf,
            undefined,
            this.pluginManager,
          ) as BaseTextSearchAdapter
          this.adapterCache.set(adapterId, adapterInstance)
          return adapterInstance
        }
      }),
      'failed to load text search adapter',
    )
  }

  relevantAdapters(assemblyName: string) {
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
    return [
      ...this.getAdaptersWithAssembly(matches, aggregateTextSearchAdapters),
      ...this.getTrackAdaptersWithAssembly(
        matches,
        rootModel?.session?.tracks ?? [],
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
      .filter(conf =>
        matches(
          readConfObject(conf, [
            'textSearching',
            'textSearchAdapter',
            'assemblyNames',
          ]) as string[] | undefined,
        ),
      )
      .map(
        conf => conf.textSearching.textSearchAdapter as AnyConfigurationModel,
      )
  }

  async search(args: BaseTextSearchArgs, assemblyName: string) {
    // Entry check, for the same reason `BaseRpcDriver.call` has one: a query
    // superseded before it got here has nothing to deliver to, and
    // `loadTextSearchAdapters` below constructs adapters and opens their index
    // files. Typing is the workload — every keystroke supersedes the last — so
    // this is the common case rather than a corner.
    checkStopToken(args.stopToken)
    const adapters = await this.loadTextSearchAdapters(assemblyName)
    // and again once they are open, before any index is actually read
    checkStopToken(args.stopToken)
    const results = await keepFulfilled(
      adapters.map(a => a.searchIndex(args)),
      'text search adapter failed',
    )
    // the ranking below is the expensive half — a dynamic import plus a fuzzy
    // sort over every hit — and a superseded keystroke has no use for it.
    // Checked here rather than only inside the adapters because keepFulfilled
    // deliberately drops a failing adapter and carries on, so an abort thrown
    // by one of them would otherwise still land here as "no results from that
    // index" and rank the rest
    checkStopToken(args.stopToken)
    return await this.sortResults({ args, results: results.flat() })
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
