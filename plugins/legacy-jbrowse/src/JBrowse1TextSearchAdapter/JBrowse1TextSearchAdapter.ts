import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { readConfObject } from '@jbrowse/core/configuration'
import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { resolveUriLocation } from '@jbrowse/core/util/io'
import { isUriLocation } from '@jbrowse/core/util/types'

import HttpMap from './HttpMap.ts'

import type { JBrowse1TextSearchAdapterConfig } from './configSchema.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  BaseTextSearchAdapter,
  BaseTextSearchArgs,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'

interface SearchResults {
  prefix: ({ name: string } | string)[]
  // generate-names.pl record: [name, trackIndex, ?, refName, start, end], start
  // 0-based and, in some records, a string
  exact: [string, number, string, string, number | string, number | string][]
}

type IndexFile = Record<string, SearchResults>

// Uses index built by generate-names.pl
export default class JBrowse1TextSearchAdapter
  extends BaseAdapter<JBrowse1TextSearchAdapterConfig>
  implements BaseTextSearchAdapter
{
  httpMap: HttpMap

  constructor(
    config: JBrowse1TextSearchAdapterConfig,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const location = readConfObject(config, 'namesIndexLocation')
    if (!isUriLocation(location)) {
      throw new Error(
        'JBrowse1TextSearchAdapter fetches its namesIndexLocation over HTTP, so it takes a { "uri" } location',
      )
    }
    this.httpMap = new HttpMap({ url: resolveUriLocation(location).uri })
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
    const tracks = await this.httpMap.getTrackNames()
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
            locString: `${refName || name}:${Number(start) + 1}-${end}`,
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
