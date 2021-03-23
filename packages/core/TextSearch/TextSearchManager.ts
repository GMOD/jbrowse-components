import PluginManager from '../PluginManager'

export default (pluginManager: PluginManager) => {
  type searchType = 'full' | 'prefix' | 'exact'
  return class TextSearchManager {
    constructor() {
      this.name = 'text search manager test'
    }

    parseText(searchText: string) {
      // TODO: implement parse search input
      //  :description
      return searchText
    }

    search(input: string, searchType: searchType) {
      /* TODO: implement search
      search types: full, prefix, exact */
      return []
    }

    relevantResults(results: array) {
      // TODO: return relevant results
      return []
    }
  }
}
