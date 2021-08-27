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

  pluginManager: PluginManager

  constructor(pluginManager: PluginManager) {
    this.pluginManager = pluginManager
    this.adapterCache = new QuickLRU({
      maxSize: 15,
    })
  }

  /**
   * Instantiate/initialize list of relevant adapters
   */
  loadTextSearchAdapters(searchScope: SearchScope): BaseTextSearchAdapter[] {
    return this.relevantAdapters(searchScope).map(adapterConfig => {
      const adapterId = readConfObject(adapterConfig, 'textSearchAdapterId')
      if (this.adapterCache.has(adapterId)) {
        return this.adapterCache.get(adapterId)
      } else {
        const { AdapterClass } = this.pluginManager.getTextSearchAdapterType(
          adapterConfig.type,
        )
        const adapter = new AdapterClass(adapterConfig)
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
    const { aggregateTextSearchAdapters, tracks } = this.pluginManager.rootModel
      ?.jbrowse as {
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
      ...this.getAdaptersWithAssembly(
        searchScope.assemblyName,
        tracks.map(track =>
          readConfObject(track, ['textSearchConf', 'textSearchAdapter']),
        ),
      ),
    ]
  }

  getAdaptersWithAssembly(
    asmName: string,
    adapterConfs: AnyConfigurationModel[],
  ) {
    return adapterConfs.filter(conf =>
      readConfObject(conf, 'assemblies')?.includes(asmName),
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
    ).sort((result1, result2) => result1.getScore() - result2.getScore())
  }
}
