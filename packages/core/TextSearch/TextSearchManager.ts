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
      // initialize necessary adapters
      pluginManager.rootModel.jbrowse.textSearchAdapters.forEach(
        adapterConfig => {
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
        },
      )
      // const {
      //   AdapterClass,
      //   configSchema,
      // } = pluginManager.getTextSearchAdapterType('JBrowse1TextSearchAdapter')
      // const test = new AdapterClass(configSchema)
      // return initialAdapters.concat(test)
      // console.log(this.lruCache)
      // console.log(initialAdapters)
      return initialAdapters
    }

    /*  search options that specify the scope of the search
     * query: {'search string, page number', limit: number of results, abortsignal, type_of_search}
     * args: unknown = {}
     */
    async search(args: BaseArgs = {}) {
      /* TODO: implement search      
        1) figure out which text search adapters are relevant
        2) instantiate if necessary...look in cache, have I instantiated if not instantiate
        3) get key, do I have it..if not make it...store it and use it etc.
        4) parallel search to all the adapters
        create a queue of calls to adapters, as one gets resolved start another
        5) rank and sort based on relevancy
        6) return relevant results 
       */
      this.textSearchAdapters = this.loadTextSearchAdapters()
      const results = await Promise.all(
        this.textSearchAdapters.map(async adapter => {
          const currentResults = await adapter.searchIndex(args)
          return currentResults
        }),
      )

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
