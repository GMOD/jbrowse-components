import { readConfObject } from '../configuration'
import QuickLRU from '../util/QuickLRU'
import type BaseResult from './BaseResults'
import type PluginManager from '../PluginManager'
import type { AnyConfigurationModel } from '../configuration'
import type {
  BaseTextSearchAdapter,
  BaseTextSearchArgs,
} from '../data_adapters/BaseAdapter'

export interface SearchScope {
  includeAggregateIndexes: boolean
  assemblyName: string
  tracks?: string[]
}

export default class TextSearchManager {
  adapterCache = new QuickLRU<string, BaseTextSearchAdapter>({
    maxSize: 15,
  })

  constructor(public pluginManager: PluginManager) {}

  loadTextSearchAdapters(searchScope: SearchScope) {
    return Promise.all(
      this.relevantAdapters(searchScope).map(async conf => {
        const adapterId = readConfObject(conf, 'textSearchAdapterId')
        const r = this.adapterCache.get(adapterId)
        if (r) {
          return r
        } else {
          const adapterType = this.pluginManager.getTextSearchAdapterType(
            conf.type,
          )!
          const AdapterClass = await adapterType.getAdapterClass()
          const adapterInstance = new AdapterClass(
            conf,
            undefined,
            this.pluginManager,
          ) as BaseTextSearchAdapter
          this.adapterCache.set(adapterId, adapterInstance)
          return adapterInstance
        }
      }),
    )
  }

  relevantAdapters(searchScope: SearchScope) {
    const rootModel = this.pluginManager.rootModel
    const { aggregateTextSearchAdapters } = rootModel?.jbrowse as {
      aggregateTextSearchAdapters: AnyConfigurationModel[]
    }
    const { tracks } = rootModel?.session as {
      tracks: AnyConfigurationModel[]
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
   *
   * @param args - search options/arguments include: search query limit of
   * results to return, searchType...prefix | full | exact", etc.
   */
  async search(
    args: BaseTextSearchArgs,
    searchScope: SearchScope,
    rankFn: (results: BaseResult[]) => BaseResult[],
  ) {
    const adapters = await this.loadTextSearchAdapters(searchScope)
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
