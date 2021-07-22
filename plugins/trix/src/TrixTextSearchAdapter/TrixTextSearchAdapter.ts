import Trix from '@gmod/trix'
import {
  BaseTextSearchAdapter,
  BaseArgs,
  BaseAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { LocStringResult } from '@jbrowse/core/TextSearch/BaseResults'
import { readConfObject } from '@jbrowse/core/configuration'
import { Instance } from 'mobx-state-tree'
import { RemoteFile } from 'generic-filehandle'

import MyConfigSchema from './configSchema'

export default class TrixTextSearchAdapter
  extends BaseAdapter
  implements BaseTextSearchAdapter {
  /*
  Trix text search adapter
   */
  ixUrl: string

  ixxUrl: string

  trixJs: Trix
  tracksNames?: string[]

  constructor(config: Instance<typeof MyConfigSchema>) {
    super(config)
    const ixFilePath = readConfObject(config, 'ixFilePath')
    const ixxFilePath = readConfObject(config, 'ixxFilePath')
    if (!ixFilePath) {
      throw new Error('must provide out.ix')
    }
    if (!ixxFilePath) {
      throw new Error('must provide out.ixx')
    }
    this.ixUrl = ixFilePath.baseUri
      ? new URL(ixFilePath.uri, ixFilePath.baseUri).href
      : ixFilePath.uri
    this.ixxUrl = ixxFilePath.baseUri
      ? new URL(ixxFilePath.uri, ixxFilePath.baseUri).href
      : ixxFilePath.uri
    const ixFile = new RemoteFile(this.ixUrl)
    const ixxFile = new RemoteFile(this.ixxUrl)
    this.trixJs = new Trix(ixxFile, ixFile)
  }

  /**
   * Returns list of results
   * @param args - search options/arguments include: search query
   * limit of results to return, searchType...preffix | full | exact", etc.
   */
  async searchIndex(args: BaseArgs) {
    const { queryString } = args
    let buff
    const searchResults: Array<string> = []
    const results = await this.trixJs.search(queryString)

    results.forEach(data => {
      buff = Buffer.from(data, 'base64')
      const stringBuffer = buff.toString()
      searchResults.push(stringBuffer)
    })
    return this.formatResults(searchResults)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formatResults(results: Array<any>) {
    if (results.length === 0) {
      return []
    }
    // Example: {"locstring":"ctgB;1659..1984","Name":["f07"],"Note":["This is an example"],"type":"remark"}
    const formattedResults = results.map(result => {
      const { Name, Note, ID, locstring } = JSON.parse(result)
      const locString = locstring.replace(/;/g, ':')
      return new LocStringResult({
        locString,
        label: Name?.[0] || Note?.[0] || ID?.[0],
        matchedAttribute: 'name',
        matchedObject: result,
      })
    })
    return formattedResults
  }
  freeResources() {}
}
