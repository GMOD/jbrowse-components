import {
  BaseArgs,
  BaseTextSearchAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { readConfObject } from '@jbrowse/core/configuration'
import { isElectron } from '@jbrowse/core/util'
import BaseResult, {
  LocationResult,
} from '@jbrowse/core/TextSearch/BaseResults'
import MyConfigSchema from './configSchema'
import HttpMap from './HttpMap'

export default class JBrowse1TextSearchAdapter extends BaseTextSearchAdapter {
  /*
  Jbrowse1 text search adapter
  Uses index built by generate-names.pl
   */
  httpMap: HttpMap 

  constructor(config: Instance<typeof MyConfigSchema>) {
    super(config)
    // metadata about tracks and assemblies that the adapter covers
    this.tracks = readConfObject(config, 'tracks')
    this.assemblies = readConfObject(config, 'assemblies')
    // create instance of httpmap
    const namesIndexLocation = readConfObject(config, 'namesIndexLocation')
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
    const readyCheck = await this.httpMap.ready
    if (readyCheck) {
      const bucketContents = await this.httpMap.getBucket(query)
      return bucketContents
    }
    return {}
  }

  /**
   * Returns list of results
   * @param args - search options/arguments include: search query
   * limit of results to return, searchType...preffix | full | exact", etc.
   */
  async searchIndex(args: BaseArgs = {}) {
    const entries = await this.loadIndexFile(args.queryString)
    if (entries !== {} && entries[args.queryString]) {
      // TODO: handle the undefined search type 
      // TODO: handle passing empty list to format results
      return this.formatResults(entries[args.queryString][args.searchType])
    }
    return []
  }

  formatResults(results) {
    if (results.length === 0) {
      return []
    }
    const formattedResults = results.map(result => {
      if (result && typeof result === 'object' && result.length > 1) {
        const name = result[0]
        const refName = result[3]
        const start = result[4]
        const end = result[5]
        const location = `${refName}:${start}-${end}`
        const formattedResult = new LocationResult({
          location,
          rendering: name,
          matchedAttribute: 'name',
          matchedObject: result,
        })
        return formattedResult
      }
      const defaultResult = new BaseResult({
        rendering: result,
        matchedAttribute: 'name',
        matchedObject: result,
      })
      return defaultResult
    })
    return formattedResults
  }

  freeResources() {}
}
