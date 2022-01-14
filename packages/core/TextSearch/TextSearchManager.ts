/*  text-searching controller */
import BaseResult from './BaseResults'
import { AnyConfigurationModel } from '../configuration/configurationSchema'

import PluginManager from '../PluginManager'
import QuickLRU from '../util/QuickLRU'
import { SearchType, BaseTextSearchAdapter } from '../data_adapters/BaseAdapter'
import { readConfObject } from '../configuration'
import { indexDriver } from './TextIndexing'

export interface BaseArgs {
  queryString: string
  searchType?: SearchType
  signal?: AbortSignal
  limit?: number
  pageNumber?: number
}

// TODO: implement Text background indexer class
// 1) detect changes in the config
// 2) determine wether to index changes or not
// 3) index changes in a separate thread
//    create a temp dir to store index
export interface SearchScope {
  includeAggregateIndexes: boolean
  assemblyName: string
  tracks?: Array<string>
}

// export class Jobs {
//   param: number
//   constructor(param: number) {
//     // add a queue here to handle job requests
//     // keep the state of the jobs
//     this.param = param
//     console.log(param)
//   }
//   // we can have a way to detect type of job
//   // for our case we would want an indexing job
//   // handle aborting jobs
//   cancelJob() {
//     // will use abort signals to cancel jobs
//     // if a job is cancelled, do not create another one unitl JBrowse restarts
//     console.log('handling error...')
//   }

//   runJob() {
//     console.log('running the job in another thread')
//   }
//   // provide progress updates from workers
//   provideStatus() {
//     console.log('this is the status of the worker')
//   }
// }
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
    return [
      ...this.getAdaptersWithAssembly(
        assemblyName,
        aggregateTextSearchAdapters,
      ),
      ...this.getAdaptersWithAssembly(
        assemblyName,
        tracks.map(track =>
          readConfObject(track, ['textSearching', 'textSearchAdapter']),
        ),
      ),
    ]
  }

  getAdaptersWithAssembly(
    asmName: string,
    adapterConfs: AnyConfigurationModel[],
  ) {
    return adapterConfs.filter(conf =>
      readConfObject(conf, 'assemblyNames')?.includes(asmName),
    )
  }

  // changesInConf() {
  //   const config = this.pluginManager.rootModel?.jbrowse
  //   console.log('config ===>', 'hi')
  //   // const { aggregateTextSearchAdapters, tracks } = this.pluginManager.rootModel
  //   //   ?.jbrowse as {
  //   //   tracks: AnyConfigurationModel[]
  //   //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   //   aggregateTextSearchAdapters: any
  //   // }
  // }
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

    console.log(await indexDriver([]))
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
