import {
  BaseTextSearchAdapter,
  BaseArgs,
  BaseAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import BaseResult, {
  LocStringResult,
} from '@jbrowse/core/TextSearch/BaseResults'
import { isElectron } from '@jbrowse/core/util'
import { Instance } from 'mobx-state-tree'
import { readConfObject } from '@jbrowse/core/configuration'
import MyConfigSchema from './configSchema'
import HttpMap from './HttpMap'

export interface TooManyHits {
  name: string
  hitLimit: number
}
export type NamesIndexRecord = string | Array<string | number>
export default class JBrowse1TextSearchAdapter
  extends BaseAdapter
  implements BaseTextSearchAdapter {
  /*
  Jbrowse1 text search adapter
  Uses index built by generate-names.pl
   */
  httpMap: HttpMap

  tracksNames?: string[]

  constructor(config: Instance<typeof MyConfigSchema>) {
    super(config)
    const namesIndexLocation = readConfObject(config, 'namesIndexLocation')
    if (!namesIndexLocation) {
      throw new Error('must provide namesIndexLocation')
    }
    this.httpMap = new HttpMap({
      url: namesIndexLocation.baseUri
        ? new URL(namesIndexLocation.uri, namesIndexLocation.baseUri).href
        : namesIndexLocation.uri,
      isElectron,
    })
  }

  /**
   * Returns the contents of the file containing the query if it exists
   * else it returns empty
   * @param query - string query
   */
  async loadIndexFile(query: string) {
    const bucketContents: Record<
      string,
      Record<string, Array<NamesIndexRecord | TooManyHits>>
    > = await this.httpMap.getBucket(query)
    return bucketContents
  }

  /**
   * Returns list of results
   * @param args - search options/arguments include: search query
   * limit of results to return, SearchType...preffix | full | exact", etc.
   */
  async searchIndex(args: BaseArgs) {
    const { searchType, queryString } = args
    const tracks = this.tracksNames
      ? this.tracksNames
      : await this.httpMap.getTrackNames()
    const entries = await this.loadIndexFile(queryString)
    if (entries !== {} && entries[queryString]) {
      // note: defaults to exact if no searchType is provided
      return this.formatResults(
        entries[queryString][searchType || 'exact'],
        tracks,
      )
    }
    return []
  }
  formatResults(
    results: Array<NamesIndexRecord | TooManyHits>,
    tracksNames: string[],
  ) {
    if (results.length === 0) {
      return []
    }
    const formattedResults = results.map(result => {
      if (result && Array.isArray(result)) {
        const name = result[0] as string
        const trackIndex = result[1] as number
        const refName = result[3] as string
        const start = result[4] as number
        const end = result[5] as number
        const locstring = `${refName || name}:${start}-${end}`
        const formattedResult = new LocStringResult({
          locString: locstring,
          label: name,
          matchedAttribute: 'name',
          matchedObject: result,
          trackId: tracksNames[trackIndex],
        })
        return formattedResult
      }
      // {"name":"too many matches","hitLimit":1}
      const defaultLabel = typeof result === 'object' ? result.name : result
      const defaultResult = new BaseResult({
        label: defaultLabel,
        matchedAttribute: 'name',
        matchedObject: { result: result },
      })
      return defaultResult
    })
    return formattedResults.filter(
      result => result.getLabel() !== 'too many matches',
    )
  }

  freeResources() {}
}
