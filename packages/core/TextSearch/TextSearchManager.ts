/*  text-searching controller */
import BaseResult from './BaseResults'
import { AnyConfigurationModel } from '../configuration/configurationSchema'

import PluginManager from '../PluginManager'
import QuickLRU from '../util/QuickLRU'
import { SearchType, BaseTextSearchAdapter } from '../data_adapters/BaseAdapter'
import { readConfObject } from '../configuration'

export interface BaseArgs {
  queryString: string
  searchType?: SearchType
  signal?: AbortSignal
  limit?: number
  pageNumber?: number
}

export interface SearchScope {
  includeAggregateIndexes: boolean
  assemblyName: string
  tracks?: Array<string>
}

export default class TextSearchManager {
  adapterCache = new QuickLRU<string, BaseTextSearchAdapter>({
    maxSize: 15,
  })

  constructor(public pluginManager: PluginManager) {}

  /**
   * Instantiate/initialize list of relevant adapters
   */
  loadTextSearchAdapters(searchScope: SearchScope) {
    const pm = this.pluginManager
    return this.relevantAdapters(searchScope).map(config => {
      const adapterId = readConfObject(config, 'textSearchAdapterId')
      const r = this.adapterCache.get(adapterId)
      if (r) {
        return r
      } else {
        const { AdapterClass } = pm.getTextSearchAdapterType(config.type)
        const adapter = new AdapterClass(
          config,
          undefined,
          pm,
        ) as BaseTextSearchAdapter
        this.adapterCache.set(adapterId, adapter)
        return adapter
      }
    })
  }

  /**
   * Returns list of relevant text search adapters to use
   * @param args - search options/arguments include: search query
   */
  relevantAdapters(searchScope: SearchScope) {
    const pm = this.pluginManager
    const { aggregateTextSearchAdapters, tracks } = pm.rootModel?.jbrowse as {
      tracks: AnyConfigurationModel[]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      aggregateTextSearchAdapters: any
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
    asmName: string,
    adapterConfs: AnyConfigurationModel[],
  ): AnyConfigurationModel[] {
    return adapterConfs.filter(conf =>
      readConfObject(conf, 'assemblyNames')?.includes(asmName),
    )
  }

  getTrackAdaptersWithAssembly(
    asmName: string,
    adapterConfs: AnyConfigurationModel[],
  ): AnyConfigurationModel[] {
    return adapterConfs
      .filter(conf =>
        readConfObject(conf, [
          'textSearching',
          'textSearchAdapter',
          'assemblyNames',
        ])?.includes(asmName),
      )
      .map(conf => conf.textSearching.textSearchAdapter)
  }

  /**
   * Returns list of relevant results given a search query and options
   * @param args - search options/arguments include: search query
   * limit of results to return, searchType...prefix | full | exact", etc.
   */
  async search(
    args: BaseArgs,
    searchScope: SearchScope,
    rankFn: (results: BaseResult[]) => BaseResult[],
  ) {
    // determine list of relevant adapters based on scope
    const textSearchAdapters = this.loadTextSearchAdapters(searchScope)
    const results = await Promise.all(
      textSearchAdapters.map(adapter => adapter.searchIndex(args)),
    )

    // aggregate and return relevant results
    return this.sortResults(results.flat(), rankFn)
  }

  /**
   * Returns array of revelevant and sorted results
   * @param results - array of results from all text search adapters
   * @param rankFn - function that updates results scores
   * based on more relevance
   */
  sortResults(
    results: BaseResult[],
    rankFn: (results: BaseResult[]) => BaseResult[],
  ) {
    return rankFn(
      results.sort((a, b) => -b.getLabel().localeCompare(a.getLabel())),
    ).sort((r1, r2) => r1.getScore() - r2.getScore())
  }
}
