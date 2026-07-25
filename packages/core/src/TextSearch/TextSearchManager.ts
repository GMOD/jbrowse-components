import { readConfObject } from '../configuration/index.ts'
import QuickLRU from '../util/QuickLRU/index.ts'

import type PluginManager from '../PluginManager.ts'
import type { AnyConfigurationModel } from '../configuration/index.ts'
import type {
  BaseTextSearchAdapter,
  BaseTextSearchArgs,
} from '../data_adapters/BaseAdapter/index.ts'
import type BaseResult from './BaseResults.ts'

export interface SearchScope {
  assemblyName: string
}

export default class TextSearchManager {
  adapterCache = new QuickLRU<string, BaseTextSearchAdapter>({
    maxSize: 15,
  })

  constructor(public pluginManager: PluginManager) {}

  clearCache() {
    this.adapterCache.clear()
  }

  loadTextSearchAdapters(searchScope: SearchScope) {
    return Promise.all(
      this.relevantAdapters(searchScope).map(async conf => {
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
    )
  }

  relevantAdapters({ assemblyName }: SearchScope) {
    const rootModel = this.pluginManager.rootModel
    const { aggregateTextSearchAdapters } = rootModel?.jbrowse as {
      aggregateTextSearchAdapters: AnyConfigurationModel[]
    }
    const { tracks } = rootModel?.session as {
      tracks: AnyConfigurationModel[]
    }

    return [
      ...this.getAdaptersWithAssembly(
        assemblyName,
        aggregateTextSearchAdapters,
      ),
      ...this.getTrackAdaptersWithAssembly(assemblyName, tracks),
    ]
  }

  getAdaptersWithAssembly(
    assemblyName: string,
    confs: AnyConfigurationModel[],
  ) {
    return confs.filter(c =>
      readConfObject(c, 'assemblyNames')?.includes(assemblyName),
    )
  }

  getTrackAdaptersWithAssembly(
    assemblyName: string,
    confs: AnyConfigurationModel[],
  ) {
    return confs
      .filter(conf =>
        readConfObject(conf, [
          'textSearching',
          'textSearchAdapter',
          'assemblyNames',
        ])?.includes(assemblyName),
      )
      .map(
        conf => conf.textSearching.textSearchAdapter as AnyConfigurationModel,
      )
  }

  async search(args: BaseTextSearchArgs, searchScope: SearchScope) {
    const adapters = await this.loadTextSearchAdapters(searchScope)
    const results = await Promise.all(adapters.map(a => a.searchIndex(args)))
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
