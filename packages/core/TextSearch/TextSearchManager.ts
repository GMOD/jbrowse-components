/* eslint-disable @typescript-eslint/no-explicit-any */
/*  text-searching controller */
import BaseResult from './BaseResults'
// import { readConfObject } from '../configuration'
import { AnyConfigurationModel } from '../configuration/configurationSchema'

import PluginManager from '../PluginManager'
import QuickLRU from '../util/QuickLRU'
import { searchType, BaseTextSearchAdapter } from '../data_adapters/BaseAdapter'
import { readConfObject } from '../configuration'

interface BaseArgs {
  searchType: searchType
  queryString: string
  signal?: AbortSignal
  limit?: number
  pageNumber?: number
  aggregate?: boolean
  importForm?: boolean
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
    loadTextSearchAdapters() {
      const initialAdapters: BaseTextSearchAdapter[] = []
      // initialize relevant adapters
      this.relevantAdapters().forEach(
        (adapterConfig: AnyConfigurationModel) => {
          const adapterId = readConfObject(adapterConfig, 'textSearchAdapterId')
          if (this.adapterCache.has(adapterId)) {
            const adapterFromCache = this.adapterCache.get(adapterId)
            initialAdapters.push(adapterFromCache)
          } else {
            const textSearchAdapterType = pluginManager.getTextSearchAdapterType(
              adapterConfig.type,
            )
            const textSearchAdapter = new textSearchAdapterType.AdapterClass(
              adapterConfig,
            ) as BaseTextSearchAdapter
            this.adapterCache.set(adapterId, textSearchAdapter)
            initialAdapters.push(textSearchAdapter)
          }
        },
      )
      return initialAdapters
    }

    /**
     * Returns list of relevant text search adapters to use
     * @param args - search options/arguments include: search query
     */
    relevantAdapters() {
      /**
       * TODO
       */
      const { textSearchAdapters, tracks } = pluginManager.rootModel
        ?.jbrowse as any
      const trackTextSearchAdapters: BaseTextSearchAdapter[] = []
      tracks.forEach((trackTextSearchAdapterConfig: AnyConfigurationModel) => {
        const trackTextSearchAdapter = readConfObject(
          trackTextSearchAdapterConfig,
          'textSearchAdapter',
        )
        if (trackTextSearchAdapter.textSearchAdapterId !== 'placeholderId') {
          trackTextSearchAdapters.push(trackTextSearchAdapter)
        }
      })
      return textSearchAdapters.concat(trackTextSearchAdapters)
    }

    /**
     * Returns list of relevant results given a search query and options
     * @param args - search options/arguments include: search query
     * limit of results to return, searchType...preffix | full | exact", etc.
     */
    async search(args: BaseArgs) {
      // determine list of relevant adapters
      this.textSearchAdapters = this.loadTextSearchAdapters()
      const results: Array<BaseResult[]> = await Promise.all(
        this.textSearchAdapters.map(async adapter => {
          // search with given options
          const currentResults: BaseResult[] = await adapter.searchIndex(args)
          return currentResults
        }),
      )

      // aggregate and return relevant results
      const relevantResults = this.relevantResults(results.flat()) // flattening the results

      if (args.limit && relevantResults.length > 0) {
        return relevantResults.slice(0, args.limit)
      }

      return relevantResults
    }

    /**
     * Returns array of revelevant results
     * @param results - array of results from all text search adapters
     */
    relevantResults(results: BaseResult[]) {
      /**
       * Relevant results sketch
       * priority results coming from opened tracks vs all tracks
       * recently searched terms?
       */
      return results
    }
  }
}
