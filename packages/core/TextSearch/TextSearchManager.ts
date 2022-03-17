/*  text-searching controller */
import BaseResult from './BaseResults'
import { AnyConfigurationModel } from '../configuration/configurationSchema'

import PluginManager from '../PluginManager'
import QuickLRU from '../util/QuickLRU'
import { SearchType, BaseTextSearchAdapter } from '../data_adapters/BaseAdapter'
import { readConfObject } from '../configuration'

export interface BaseArgs {
  queryString: string
  searchType?: SearchType
  signal?: AbortSignal
  limit?: number
  pageNumber?: number
}

export interface SearchScope {
  includeAggregateIndexes: boolean
  assemblyName: string
  tracks?: Array<string>
}

export default class TextSearchManager {
  adapterCache: QuickLRU

  constructor(public pluginManager: PluginManager) {
    this.adapterCache = new QuickLRU({
      maxSize: 15,
    })
  }

  /**
   * Instantiate/initialize list of relevant adapters
   */
  loadTextSearchAdapters(searchScope: SearchScope): BaseTextSearchAdapter[] {
    return this.relevantAdapters(searchScope).map(adapterConfig => {
      const adapterId = readConfObject(adapterConfig, 'textSearchAdapterId')
      if (this.adapterCache.has(adapterId)) {
        return this.adapterCache.get(adapterId)
      } else {
        const { AdapterClass } = this.pluginManager.getTextSearchAdapterType(
          adapterConfig.type,
        )
        const adapter = new AdapterClass(
          adapterConfig,
          undefined,
          this.pluginManager,
        )
        this.adapterCache.set(adapterId, adapter)
        return adapter
      }
    })
  }

  /**
   * Returns list of relevant text search adapters to use
   * @param args - search options/arguments include: search query
   */
  relevantAdapters(searchScope: SearchScope) {
    const { aggregateTextSearchAdapters, tracks } = this.pluginManager.rootModel
      ?.jbrowse as {
      tracks: AnyConfigurationModel[]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      aggregateTextSearchAdapters: any
    }

    const { assemblyName } = searchScope

    const relevant = [
      ...this.getAdaptersWithAssembly(
        assemblyName,
        aggregateTextSearchAdapters,
      ),
      ...this.getTrackAdaptersWithAssembly(assemblyName, tracks),
    ]
    console.log('relevant', relevant)
    return relevant
  }

  getAdaptersWithAssembly(
    asmName: string,
    adapterConfs: AnyConfigurationModel[],
  ) {
    return adapterConfs.filter(conf =>
      readConfObject(conf, 'assemblyNames')?.includes(asmName),
    )
  }

  getTrackAdaptersWithAssembly(
    asmName: string,
    adapterConfs: AnyConfigurationModel[],
  ) {
    adapterConfs.forEach(t => {
      console.log(
        t,
        readConfObject(t, [
          'textSearching',
        ]),
      )
    })
    const tracksConfs = adapterConfs.filter(conf =>
      readConfObject(conf, [
        'textSearching',
        'textSearchAdapter',
        'assemblyNames',
      ])?.includes(asmName),
    )
    console.log(tracksConfs)
    const trackAdapters = tracksConfs.map(trackConf => {
      const { textSearching } = trackConf
      const { textSearchAdapter } = textSearching
      return textSearchAdapter
    })
    console.log(trackAdapters)
    return trackAdapters
  }

  /**
   * Returns list of relevant results given a search query and options
   * @param args - search options/arguments include: search query
   * limit of results to return, searchType...prefix | full | exact", etc.
   */
  async search(
    args: BaseArgs,
    searchScope: SearchScope,
    rankFn: (results: BaseResult[]) => BaseResult[],
  ) {
    // determine list of relevant adapters based on scope
    const textSearchAdapters = this.loadTextSearchAdapters(searchScope)
    const results = await Promise.all(
      textSearchAdapters.map(adapter => adapter.searchIndex(args)),
    )

    // aggregate and return relevant results
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
    ).sort((result1, result2) => result1.getScore() - result2.getScore())
  }
}
