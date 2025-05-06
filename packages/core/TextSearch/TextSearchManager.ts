import { readConfObject } from '../configuration'
import QuickLRU from '../util/QuickLRU'

import type BaseResult from './BaseResults'
import type PluginManager from '../PluginManager'
import type { AnyConfigurationModel } from '../configuration'
import type {
  BaseTextSearchAdapter,
  BaseTextSearchArgs,
} from '../data_adapters/BaseAdapter'
import uFuzzy from '@leeoniya/ufuzzy'

export interface SearchScope {
  includeAggregateIndexes: boolean
  assemblyName: string
  tracks?: string[]
}

export default class TextSearchManager {
  adapterCache = new QuickLRU<string, BaseTextSearchAdapter>({
    maxSize: 15,
  })

  constructor(public pluginManager: PluginManager) {}

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
          )!
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

  relevantAdapters(searchScope: SearchScope) {
    const rootModel = this.pluginManager.rootModel
    const { aggregateTextSearchAdapters } = rootModel?.jbrowse as {
      aggregateTextSearchAdapters: AnyConfigurationModel[]
    }
    const { tracks } = rootModel?.session as {
      tracks: AnyConfigurationModel[]
    }

    const { assemblyName } = searchScope

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

  /**
   * legacy API for searching:
   * Returns list of relevant results given a search query and options
   */
  async search(
    args: BaseTextSearchArgs,
    searchScope: SearchScope,
    rankFn: (results: BaseResult[]) => BaseResult[],
  ) {
    return this.search2({ args, searchScope, rankFn })
  }

  /**
   * modern API for searching:
   * Returns list of relevant results given a search query and options
   */
  async search2({
    args,
    searchScope,
    rankFn,
  }: {
    args: BaseTextSearchArgs
    searchScope: SearchScope
    rankFn: (results: BaseResult[]) => BaseResult[]
  }) {
    const adapters = await this.loadTextSearchAdapters(searchScope)
    const results = await Promise.all(adapters.map(a => a.searchIndex(args)))

    return this.sortResults2({
      args,
      results: results.flat(),
      rankFn,
    })
  }

  /**
   * Returns array of revelevant and sorted results. Note: renamed to
   * sortResults2 to accomodate new format
   *
   * @param results - array of results from all text search adapters
   * @param rankFn - function that updates results scores
   * based on more relevance
   */
  sortResults2({
    results,
    rankFn,
    args,
  }: {
    results: BaseResult[]
    args: BaseTextSearchArgs
    rankFn: (results: BaseResult[]) => BaseResult[]
  }) {
    let uf = new uFuzzy({})
    const haystackPre = Object.fromEntries(
      results.map((r, idx) => [r.getDisplayString(), idx]),
    )
    const haystack = Object.keys(haystackPre)
    const needle = args.queryString
    let idxs = uf.filter(haystack, needle)
    const res = []

    // idxs can be null when the needle is non-searchable (has no alpha-numeric chars)
    if (idxs != null && idxs.length > 0) {
      let info = uf.info(idxs, haystack, needle)

      // order is a double-indirection array (a re-order of the passed-in idxs)
      // this allows corresponding info to be grabbed directly by idx, if needed
      let order = uf.sort(info, haystack, needle)

      // render post-filtered & ordered matches
      for (let i = 0; i < order.length; i++) {
        // using info.idx here instead of idxs because uf.info() may have
        // further reduced the initial idxs based on prefix/suffix rules
        res.push(haystack[info.idx[order[i]!]!]!)
      }
    }
    return rankFn(res.map(r => results[haystackPre[r]!]!))
  }
}
