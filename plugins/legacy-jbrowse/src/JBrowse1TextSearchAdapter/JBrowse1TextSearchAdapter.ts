import {
  BaseTextSearchAdapter,
  BaseArgs,
  BaseAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { Instance } from 'mobx-state-tree'
import { readConfObject } from '@jbrowse/core/configuration'
import MyConfigSchema from './configSchema'
import HttpMap from './HttpMap'
import PluginManager from '@jbrowse/core/PluginManager'
import { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { resolveUriLocation } from '@jbrowse/core/util/io'

export interface TooManyHits {
  name: string
  hitLimit: number
}

interface SearchResults {
  prefix: ({ name: string } | string)[]
  exact: [string, number, string, string, number, number][]
}

export type NamesIndexRecord = string | Array<string | number>

//  Jbrowse1 text search adapter
// Uses index built by generate-names.pl
export default class JBrowse1TextSearchAdapter
  extends BaseAdapter
  implements BaseTextSearchAdapter
{
  httpMap: HttpMap

  tracksNames?: string[]

  constructor(
    config: Instance<typeof MyConfigSchema>,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const namesIndexLocation = readConfObject(config, 'namesIndexLocation')
    if (!namesIndexLocation) {
      throw new Error('must provide namesIndexLocation')
    }
    this.httpMap = new HttpMap({
      url: resolveUriLocation(namesIndexLocation).uri,
    })
  }

  /**
   * Returns the contents of the file containing the query if it exists
   * else it returns empty
   * @param query - string query
   */
  async loadIndexFile(query: string): Promise<Record<string, SearchResults>> {
    return this.httpMap.getBucket(query)
  }

  async searchIndex(args: BaseArgs) {
    const { searchType, queryString } = args
    const tracks = this.tracksNames || (await this.httpMap.getTrackNames())
    const entries = await this.loadIndexFile(queryString.toLowerCase())
    if (entries[queryString]) {
      return this.formatResults(entries[queryString], tracks, searchType)
    }
    return []
  }
  formatResults(results: SearchResults, tracks: string[], searchType?: string) {
    return [
      ...(searchType === 'exact'
        ? []
        : results.prefix.map(result => {
            return new BaseResult({
              label: typeof result === 'object' ? result.name : result,
              matchedAttribute: 'name',
              matchedObject: { result: result },
            })
          })),
      ...results.exact.map(result => {
        const name = result[0] as string
        const trackIndex = result[1] as number
        const refName = result[3] as string
        const start = result[4] as number
        const end = result[5] as number
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
