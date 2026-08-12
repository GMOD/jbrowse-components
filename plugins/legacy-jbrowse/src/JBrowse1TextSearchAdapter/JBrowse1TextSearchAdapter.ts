import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { readConfObject } from '@jbrowse/core/configuration'
import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

import HttpMap from './HttpMap.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  BaseTextSearchAdapter,
  BaseTextSearchArgs,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'

interface SearchResults {
  prefix: ({ name: string } | string)[]
  // generate-names.pl record: [name, trackIndex, ?, refName, start, end]
  exact: [string, number, string, string, number, number][]
}

type IndexFile = Record<string, SearchResults>

// Uses index built by generate-names.pl
export default class JBrowse1TextSearchAdapter
  extends BaseAdapter
  implements BaseTextSearchAdapter
{
  httpMap: HttpMap

  tracksNames?: string[]

  constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const namesIndex = readConfObject(config, 'namesIndexLocation')
    const { baseUri, uri } = namesIndex
    this.httpMap = new HttpMap({
      url: baseUri ? new URL(uri, baseUri).href : uri,
    })
  }

  /**
   * Returns the contents of the file containing the query if it exists
   * else it returns empty
   * @param query - string query
   */
  async loadIndexFile(query: string): Promise<IndexFile> {
    return this.httpMap.getBucket(query)
  }

  async searchIndex(args: BaseTextSearchArgs) {
    const { searchType, queryString } = args
    const tracks = this.tracksNames ?? (await this.httpMap.getTrackNames())
    const str = queryString.toLowerCase()
    const entries = await this.loadIndexFile(str)
    const results = entries[str]
    return results ? this.formatResults(results, tracks, searchType) : []
  }
  formatResults(results: SearchResults, tracks: string[], searchType?: string) {
    return [
      ...(searchType === 'exact'
        ? []
        : results.prefix.map(
            result =>
              new BaseResult({
                label: typeof result === 'object' ? result.name : result,
              }),
          )),
      // the bucket is keyed by the query, so everything in its `exact` list
      // matched it exactly — which is what lets a caller ask once rather than
      // asking for exact hits and then for all of them
      ...results.exact.map(
        ([name, trackIndex, , refName, start, end]) =>
          new BaseResult({
            locString: `${refName || name}:${start}-${end}`,
            label: name,
            trackId: tracks[trackIndex],
            exact: true,
          }),
      ),
      // the index encodes an overflow bucket as a pseudo-hit; it is a message,
      // not a navigable location
    ].filter(result => result.getLabel() !== 'too many matches')
  }
}
