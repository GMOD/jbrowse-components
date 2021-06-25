/*  text-searching controller */
import BaseResult from './BaseResults'
import { AnyConfigurationModel } from '../configuration/configurationSchema'

import PluginManager from '../PluginManager'
import QuickLRU from '../util/QuickLRU'
import { SearchType, BaseTextSearchAdapter } from '../data_adapters/BaseAdapter'
import { readConfObject } from '../configuration'
import TextSearchAdapterType from '../pluggableElementTypes/TextSearchAdapterType'

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

export default (pluginManager: PluginManager) => {
  return class TextSearchManager {
    adapterCache: QuickLRU

    textSearchAdapters: BaseTextSearchAdapter[]

    constructor() {
      this.textSearchAdapters = []
      this.adapterCache = new QuickLRU({
        maxSize: 15,
      })
    }

    /**
     * Instantiate/initialize list of relevant adapters
     */
    loadTextSearchAdapters(searchScope: SearchScope) {
      return this.relevantAdapters(searchScope).map(
        (adapterConfig: AnyConfigurationModel) => {
          const adapterId = readConfObject(adapterConfig, 'textSearchAdapterId')
          if (this.adapterCache.has(adapterId)) {
            const adapterFromCache = this.adapterCache.get(adapterId)
            return adapterFromCache
          } else {
            const textSearchAdapterType = pluginManager.getTextSearchAdapterType(
              adapterConfig.type,
            )
            const textSearchAdapter = new textSearchAdapterType.AdapterClass(
              adapterConfig,
            ) as BaseTextSearchAdapter
            this.adapterCache.set(adapterId, textSearchAdapter)
            return textSearchAdapter
          }
        },
      )
    }

    /**
     * Returns list of relevant text search adapters to use
     * @param args - search options/arguments include: search query
     */
    relevantAdapters(searchScope: SearchScope) {
      // Note: (in the future we can add a condition to check if not aggregate
      // only return track text search adapters that cover relevant tracks,
      // for now only returning text search adapters that cover configured assemblies)
      // root level adapters and track adapters
      const { aggregateTextSearchAdapters, tracks } = pluginManager.rootModel
        ?.jbrowse as any // eslint-disable-line @typescript-eslint/no-explicit-any

      const trackTextSearchAdapters = (tracks as AnyConfigurationModel[])
        .map(trackConfig => trackConfig.textSearchAdapter)
        .filter(adapter => adapter.textSearchAdapterId !== 'placeholderId')

      // get adapters that cover assemblies
      const rootTextSearchAdapters = this.getAdaptersWithAssembly(
        searchScope.assemblyName,
        aggregateTextSearchAdapters,
      )
      return rootTextSearchAdapters.concat(
        this.getAdaptersWithAssembly(
          searchScope.assemblyName,
          trackTextSearchAdapters,
        ),
      )
    }

    getAdaptersWithAssembly(
      searchScopeAssemblyName: string,
      adapterList: AnyConfigurationModel[],
    ) {
      const adaptersWithAssemblies = adapterList.filter(
        (adapterConfig: AnyConfigurationModel) => {
          const adapterAssemblies = readConfObject(adapterConfig, 'assemblies')
          return adapterAssemblies?.includes(searchScopeAssemblyName)
        },
      )
      return adaptersWithAssemblies
    }

    /**
     * Returns list of relevant results given a search query and options
     * @param args - search options/arguments include: search query
     * limit of results to return, searchType...prefix | full | exact", etc.
     */
    async search(
      args: BaseArgs,
      searchScope: SearchScope,
      rankSearchResults: (results: BaseResult[]) => BaseResult[],
    ) {
      // determine list of relevant adapters based on scope
      this.textSearchAdapters = this.loadTextSearchAdapters(searchScope)
      const results = await Promise.all(
        this.textSearchAdapters.map(adapter => {
          return adapter.searchIndex(args)
        }),
      )

      // aggregate and return relevant results
      return this.sortResults(results.flat(), rankSearchResults).slice(
        0,
        args.limit,
      )
    }

    /**
     * Returns array of revelevant and sorted results
     * @param results - array of results from all text search adapters
     * @param rankSearchResults - function that updates results scores
     * based on more relevance
     */
    sortResults(
      results: BaseResult[],
      rankSearchResults: (results: BaseResult[]) => BaseResult[],
    ) {
      // first sort results in alphabetical order
      const sortedResults = results.sort(
        (a, b) => -b.getLabel().localeCompare(a.getLabel()),
      )
      // sort results based on score
      const sortedScoredResults = rankSearchResults(sortedResults).sort(
        (result1, result2) => result2.getScore() - result1.getScore(),
      )
      return sortedScoredResults
    }
  }
}
