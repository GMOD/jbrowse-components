/*  text-searching controller */
import BaseResult from './BaseResults'
import { AnyConfigurationModel } from '../configuration/configurationSchema'

import PluginManager from '../PluginManager'
import QuickLRU from '../util/QuickLRU'
import { SearchType, BaseTextSearchAdapter } from '../data_adapters/BaseAdapter'
import { readConfObject } from '../configuration'

export interface BaseArgs {
  searchType: SearchType
  queryString: string
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
  adapterCache: QuickLRU

  textSearchAdapters: BaseTextSearchAdapter[]
  pluginManager: PluginManager

  constructor(pluginManager: PluginManager) {
    this.pluginManager = pluginManager
    this.textSearchAdapters = []
    this.adapterCache = new QuickLRU({
      maxSize: 15,
    })
  }

  /**
   * Instantiate/initialize list of relevant adapters
   */
  loadTextSearchAdapters(searchScope: SearchScope) {
    const adaptersToUse: BaseTextSearchAdapter[] = []
    // initialize relevant adapters
    this.relevantAdapters(searchScope).forEach(adapterConfig => {
      const adapterId = readConfObject(adapterConfig, 'textSearchAdapterId')
      if (this.adapterCache.has(adapterId)) {
        const adapterFromCache = this.adapterCache.get(adapterId)
        adaptersToUse.push(adapterFromCache)
      } else {
        const textSearchAdapterType = this.pluginManager.getTextSearchAdapterType(
          adapterConfig.type,
        )
        const textSearchAdapter = new textSearchAdapterType.AdapterClass(
          adapterConfig,
        ) as BaseTextSearchAdapter
        this.adapterCache.set(adapterId, textSearchAdapter)
        adaptersToUse.push(textSearchAdapter)
      }
    })
    return adaptersToUse
  }

  /**
   * Returns list of relevant text search adapters to use
   * @param args - search options/arguments include: search query
   */
  relevantAdapters(searchScope: SearchScope) {
    // Note: (in the future we can add a condition to check if not aggregate
    // only return track text search adapters that cover relevant tracks, for
    // now only returning text search adapters that cover configured
    // assemblies) root level adapters and track adapters
    const { aggregateTextSearchAdapters, tracks } = this.pluginManager.rootModel
      ?.jbrowse as {
      tracks: AnyConfigurationModel[]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      aggregateTextSearchAdapters: any
    }

    // get adapters that cover assemblies
    const rootTextSearchAdapters = this.getAdaptersWithAssembly(
      searchScope.assemblyName,
      aggregateTextSearchAdapters,
    )
    const trackTextSearchConfs = tracks.map(track => track.textSearchConf)
    const trackTextSearchAdapters = this.getAdaptersWithAssembly(
      searchScope.assemblyName,
      trackTextSearchConfs.filter(
        conf =>
          conf?.textSearchAdapter?.textSearchAdapterId !== 'placeholderId',
      ),
    )
    return [...rootTextSearchAdapters, ...trackTextSearchAdapters]
  }

  getAdaptersWithAssembly(
    searchScopeAssemblyName: string,
    adapterList: AnyConfigurationModel[],
  ) {
    return adapterList.filter(adapterConfig =>
      readConfObject(adapterConfig, 'assemblies')?.includes(
        searchScopeAssemblyName,
      ),
    )
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
    this.textSearchAdapters = this.loadTextSearchAdapters(searchScope)
    const results = await Promise.all(
      this.textSearchAdapters.map(adapter => adapter.searchIndex(args)),
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
    ).sort((result1, result2) => result1.getScore() - result2.getScore())
  }
}
