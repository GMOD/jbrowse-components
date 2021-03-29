import PluginManager from '../PluginManager'
// export type searchType = 'full' | 'prefix' | 'exact'
export default (pluginManager: PluginManager) => {
  return class TextSearchManager {
    constructor() {
      this.name = 'text search manager test'
    }

    parseText(searchText: string) {
      // TODO: implement parse search input
      //  :description
      return searchText
    }

    search(input: string) {
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
