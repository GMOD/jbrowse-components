/* eslint-disable @typescript-eslint/no-explicit-any */
/*  text-searching controller */
import BaseResult from './BaseResults'
// import { readConfObject } from '../configuration'
import { AnyConfigurationModel } from '../configuration/configurationSchema'

import PluginManager from '../PluginManager'
import QuickLRU from '../util/QuickLRU'
import { searchType, BaseTextSearchAdapter } from '../data_adapters/BaseAdapter'

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
    adapterCache: QuickLRU // TODO: replace with AbortablePromiseCache

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
          const textSearchAdapterType = pluginManager.getTextSearchAdapterType(
            adapterConfig.type,
          )
          const textSearchAdapter = new textSearchAdapterType.AdapterClass(
            adapterConfig,
          ) as BaseTextSearchAdapter
          initialAdapters.push(textSearchAdapter)
        },
      )
      return initialAdapters
    }

    relevantAdapters() {
      // TODO: figure out how to determine relevant adapters
      /* Relevant sketch:
      1) opened tracks
      2) all tracks for aggregate
      */
      const { textSearchAdapters } = pluginManager.rootModel?.jbrowse as any
      // console.log(pluginManager.rootModel)
      return textSearchAdapters
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
       * Is it coming from import form ? only display reference and locstring results
       * priority results coming from opened tracks vs all tracks
       * recently searched terms?
       */
      // if (args.importForm) {
      //  return results.filter(result => result instanceof )
      // }
      return results
    }
  }
}
