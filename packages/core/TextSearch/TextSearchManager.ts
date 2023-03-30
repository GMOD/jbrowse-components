import BaseResult from './BaseResults'
import PluginManager from '../PluginManager'
import QuickLRU from '../util/QuickLRU'
import {
  BaseTextSearchAdapter,
  BaseTextSearchArgs,
} from '../data_adapters/BaseAdapter'
import { readConfObject, AnyConfigurationModel } from '../configuration'

export interface SearchScope {
  includeAggregateIndexes: boolean
  assemblyName: string
  tracks?: Array<string>
}

export default class TextSearchManager {
  adapterCache = new QuickLRU<string, BaseTextSearchAdapter>({
    maxSize: 15,
  })

  constructor(public pluginManager: PluginManager) {}

  loadTextSearchAdapters(searchScope: SearchScope) {
    const pm = this.pluginManager
    return this.relevantAdapters(searchScope).map(conf => {
      const adapterId = readConfObject(conf, 'textSearchAdapterId')
      const r = this.adapterCache.get(adapterId)
      if (r) {
        return r
      } else {
        const { AdapterClass } = pm.getTextSearchAdapterType(conf.type)
        const a = new AdapterClass(conf, undefined, pm) as BaseTextSearchAdapter
        this.adapterCache.set(adapterId, a)
        return a
      }
    })
  }

  relevantAdapters(searchScope: SearchScope) {
    const pm = this.pluginManager
    const { aggregateTextSearchAdapters, tracks } = pm.rootModel?.jbrowse as {
      tracks: AnyConfigurationModel[]
      aggregateTextSearchAdapters: AnyConfigurationModel[]
    }

    const { assemblyName } = searchScope

    return [
      ...this.getAdaptersWithAssembly(
        assemblyName,
        aggregateTextSearchAdapters,
      ),
      ...this.getTrackAdaptersWithAssembly(assemblyName, tracks),
    ]
  }

  getAdaptersWithAssembly(
    assemblyName: string,
    confs: AnyConfigurationModel[],
  ): AnyConfigurationModel[] {
    return confs.filter(c =>
      readConfObject(c, 'assemblyNames')?.includes(assemblyName),
    )
  }

  getTrackAdaptersWithAssembly(
    assemblyName: string,
    confs: AnyConfigurationModel[],
  ) {
    return confs
      .filter(conf =>
        readConfObject(conf, [
          'textSearching',
          'textSearchAdapter',
          'assemblyNames',
        ])?.includes(assemblyName),
      )
      .map(
        conf => conf.textSearching.textSearchAdapter as AnyConfigurationModel,
      )
  }

  /**
   * Returns list of relevant results given a search query and options
   * @param args - search options/arguments include: search query
   * limit of results to return, searchType...prefix | full | exact", etc.
   */
  async search(
    args: BaseTextSearchArgs,
    searchScope: SearchScope,
    rankFn: (results: BaseResult[]) => BaseResult[],
  ) {
    const adapters = this.loadTextSearchAdapters(searchScope)
    const results = await Promise.all(adapters.map(a => a.searchIndex(args)))
    return this.sortResults(results.flat(), rankFn)
  }

  /**
   * Returns array of revelevant and sorted results
   * @param results - array of results from all text search adapters
   * @param rankFn - function that updates results scores
   * based on more relevance
   */
  sortResults(
    results: BaseResult[],
    rankFn: (results: BaseResult[]) => BaseResult[],
  ) {
    return rankFn(
      results.sort((a, b) => -b.getLabel().localeCompare(a.getLabel())),
    ).sort((r1, r2) => r1.getScore() - r2.getScore())
  }
}
