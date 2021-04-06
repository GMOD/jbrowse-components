import JBrowse1TextSearchAdapter from './JBrowse1TextSeachAdapter/JBrowse1TextSearchAdater'
import { configSchema } from './JBrowse1TextSeachAdapter/index'
import PluginManager from '../PluginManager'

// export type searchType = 'full' | 'prefix' | 'exact'
export default (pluginManager: PluginManager) => {
  const test = new JBrowse1TextSearchAdapter(configSchema)
  return class TextSearchManager {
    constructor() {
      this.textSearchAdapters = []
    }

    parseText(searchText: string) {
      // TODO: implement parse search input
      // tokenize, relevant worrds
      //  :description
      return []
    }

    async search(input: string) {
      /* TODO: implement search
      search types: full, prefix, exact 
      implement search different adapters in parallel
      */
      const results = await test.searchIndex(input, 'exact')
      return results
    }

    /**
     * Returns array of revelevant results
     * @param results - array of results from all text search adapters
     */
    relevantResults(results: array) {
      return []
    }
  }
}
