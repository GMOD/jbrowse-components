/*  text-searching controller */
import PluginManager from '../PluginManager'
import QuickLRU from '../util/QuickLRU'

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
      //  get list of relevant adapters
      const schemas = pluginManager.getElementTypesInGroup(
        'text search adapter',
      )
      // check if in lru cache, else instantiate it
      schemas.forEach(schema => {
        const { AdapterClass, configSchema, name } = schema
        if (this.lruCache.has(name)) {
          const adapterFromCache = this.lruCache.get(name)
          initialAdapters.push(adapterFromCache)
        } else {
          const newAdapter = new AdapterClass(configSchema)
          initialAdapters.push(newAdapter)
          this.lruCache.set(name, newAdapter)
        }
      })
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
     */
    async search(input: string, type: string) {
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
          const currentResults = await adapter.searchIndex(input, type)
          return currentResults
        }),
      )

      // console.log( results )

      return this.relevantResults([].concat(...results)) // flattening the results
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
