/*  text-searching controller */
// import JBrowse1TextSearchAdapter from './JBrowse1TextSeachAdapter/JBrowse1TextSearchAdater'
// import { configSchema } from './JBrowse1TextSeachAdapter/index'
import PluginManager from '../PluginManager'

// export type searchType = 'full' | 'prefix' | 'exact'
export default (pluginManager: PluginManager) => {
  // const test = new JBrowse1TextSearchAdapter(configSchema)
  return class TextSearchManager {
    constructor() {
      this.textSearchAdapters = []
    }

    parseText(searchText: string) {
      // TODO: implement parse search input
      //  :description
      return []
    }

    async search(input: string, type: string) {
      /* TODO: implement search
       *implement search different adapters in parallel
       *search options that specify the scope of the search
       */
      // let results = []
      // this.textSearchAdapters.forEach(adapter => {
      //   // eslint-disable-next-line no-return-await
      //   const currentResults = adapter.searchIndex(input, type)
      //   results = results.concat(currentResults)
      //   // console.log(adapter)
      // })
      // const test2 = pluginManager.pluggableConfigSchemaType('text search adapter')[0]
      // const results = await test.searchIndex(input, type)
      // console.log(
      //   pluginManager.getTextSearchAdapterType('JBrowse1TextSearchAdapter'),
      // )
      const {
        AdapterClass,
        configSchema,
      } = pluginManager.getTextSearchAdapterType('JBrowse1TextSearchAdapter')
      const test2 = new AdapterClass(configSchema)
      const results = await test2.searchIndex(input, type)
      return results
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
