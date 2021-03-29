import PluginManager from '../PluginManager'
// export type searchType = 'full' | 'prefix' | 'exact'
export default (pluginManager: PluginManager) => {
  return class TextSearchManager {
    constructor() {
      this.name = 'text search manager test'
      this.textSearchAdapters = []
    }

    parseText(searchText: string) {
      // TODO: implement parse search input
      // tokenize, relevant worrds
      //  :description
      return []
    }

    search(input: string) {
      /* TODO: implement search
      search types: full, prefix, exact 
      implement search different adapters in parallel
      */
      return []
    }

    relevantResults(results: array) {
      // TODO: return relevant results, find intersection
      //  return default to 15 top matches
      return []
    }
  }
}
