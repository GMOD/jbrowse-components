import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { readConfObject } from '@jbrowse/core/configuration'
import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import HttpMap from './HttpMap'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  BaseTextSearchAdapter,
  BaseTextSearchArgs,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'

export interface TooManyHits {
  name: string
  hitLimit: number
}

interface SearchResults {
  prefix: ({ name: string } | string)[]
  exact: [string, number, string, string, number, number][]
}

export type NamesIndexRecord = string | (string | number)[]

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
    const tracks = this.tracksNames || (await this.httpMap.getTrackNames())
    const str = queryString.toLowerCase()
    const entries = await this.loadIndexFile(str)
    return entries[str]
      ? this.formatResults(entries[str], tracks, searchType)
      : []
  }
  formatResults(results: SearchResults, tracks: string[], searchType?: string) {
    return [
      ...(searchType === 'exact'
        ? []
        : results.prefix.map(
            result =>
              new BaseResult({
                label: typeof result === 'object' ? result.name : result,
                matchedAttribute: 'name',
                matchedObject: { result: result },
              }),
          )),
      ...results.exact.map(result => {
        const name = result[0]
        const trackIndex = result[1]
        const refName = result[3]
        const start = result[4]
        const end = result[5]
        const locstring = `${refName || name}:${start}-${end}`
        return new BaseResult({
          locString: locstring,
          label: name,
          matchedAttribute: 'name',
          matchedObject: result,
          trackId: tracks[trackIndex],
        })
      }),
    ].filter(result => result.getLabel() !== 'too many matches')
  }

  freeResources() {}
}
