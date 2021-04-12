/*  text-searching controller */
import PluginManager from '../PluginManager'

export default (pluginManager: PluginManager) => {
  return class TextSearchManager {
    constructor() {
      this.textSearchAdapters = this.loadTextSearchAdapters()
    }

    /**
     * Instantiate/initialize list adapters
     */
    loadTextSearchAdapters() {
      const initialAdapters = []
      const schemas = pluginManager.getElementTypesInGroup(
        'text search adapter',
      )
      schemas.forEach(schema => {
        const { AdapterClass, configSchema } = schema
        initialAdapters.push(new AdapterClass(configSchema))
      })
      // const {
      //   AdapterClass,
      //   configSchema,
      // } = pluginManager.getTextSearchAdapterType('JBrowse1TextSearchAdapter')
      // const test = new AdapterClass(configSchema)
      // return initialAdapters.concat(test)
      return initialAdapters
    }

    parseText(searchText: string) {
      // TODO: implement parse search input
      //  :description
      return []
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
        5) rank and sort based on relevancy
        6) return relevant results 
       */
      // parallel search to all adapters
      const results = await Promise.all(
        this.textSearchAdapters.map(async adapter => {
          const currentResults = await adapter.searchIndex(input, type)
          return currentResults
        }),
      )
      return [].concat(...results)
    }

    /**
     * Returns array of revelevant results
     * @param results - array of results from all text search adapters
     */
    relevantResults(results: array) {
      // TODO: matches
      return []
    }
  }
}
