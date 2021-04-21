/*  text-searching controller */
import { readConfObject } from '../configuration'
import PluginManager from '../PluginManager'
import QuickLRU from '../util/QuickLRU'

interface BaseArgs {
  searchType: searchType
  queryString: string
  signal?: AbortSignal
  limit?: number
  pageNumber?: number
}
export default (pluginManager: PluginManager) => {
  return class TextSearchManager {
    constructor() {
      this.textSearchAdapters = []
      this.lruCache = new QuickLRU({
        maxSize: 15,
      })
    }

    /**
     * Instantiate/initialize list of relevant adapters
     */
    loadTextSearchAdapters() {
      const initialAdapters = []
      // initialize relevant adapters
      this.relevantAdapters().forEach(adapterConfig => {
        const id = readConfObject(adapterConfig, 'textSearchAdapterId')
        if (this.lruCache.has(id)) {
          const adapterFromCache = this.lruCache.get(id)
          initialAdapters.push(adapterFromCache)
        } else {
          const textSearchAdapterType = pluginManager.getTextSearchAdapterType(
            adapterConfig.type,
          )
          const textSearchAdapter = new textSearchAdapterType.AdapterClass(
            adapterConfig,
          )
          this.lruCache.set(id, textSearchAdapter)
        }
      })
      return initialAdapters
    }

    relevantAdapters() {
      // TODO: figure out how to determine relevant adapters
      return pluginManager.rootModel.jbrowse.textSearchAdapters
    }

    /**
     * Returns list of relevant results given a search query and options
     * @param args - search options/arguments include: search query
     * limit of results to return, searchType...preffix | full | exact", etc.
     */
    async search(args: BaseArgs = {}) {
      // determine list of relevant adapters
      this.textSearchAdapters = this.loadTextSearchAdapters()
      const results = await Promise.all(
        this.textSearchAdapters.map(async adapter => {
          // search with given options
          const currentResults = await adapter.searchIndex(args)
          return currentResults
        }),
      )

      // aggregate and return relevant results
      const relevantResults = this.relevantResults([].concat(...results)) // flattening the results

      if (args.limit && relevantResults.length > 0) {
        return relevantResults.slice(0, args.limit)
      }

      return relevantResults
    }

    /**
     * Returns array of revelevant results
     * @param results - array of results from all text search adapters
     */
    relevantResults(results: array) {
      // TODO: implement rank system
      return results
    }
  }
}
