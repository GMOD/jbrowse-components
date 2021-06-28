import Trix from '@gmod/trix'
import {
  BaseTextSearchAdapter,
  BaseArgs,
  BaseAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import BaseResult, {
  LocStringResult,
} from '@jbrowse/core/TextSearch/BaseResults'
import { readConfObject } from '@jbrowse/core/configuration'
import { isElectron } from '@jbrowse/core/util'
import { Instance } from 'mobx-state-tree'
import { LocalFile, RemoteFile } from 'generic-filehandle'
import { decompress } from 'lzutf8'
import fetch from 'node-fetch'

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
    // console.log('=============== Trix ============')
    const { queryString } = args
    let buff
    const searchResults: Array<string> = []
    const results = await this.trixJs.search(queryString)

    results.forEach(data => {
      buff = decompress(Buffer.from(data, 'base64'), {
        outputEncoding: 'Buffer',
      })
      const stringBuffer = buff.toString()
      searchResults.push(stringBuffer)
    })
    // console.log(`Num of Results: ${searchResults.length}`)
    // console.log(`${searchResults}`)
    // console.log('formated', this.formatResults(searchResults))
    // console.log('=============================')
    return this.formatResults(searchResults)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formatResults(results: Array<any>) {
    if (results.length === 0) {
      return []
    }
    // {"Name":["au9.g1002"],"ID":["au9.g1002"],"seq_id":"Group1.36","start":176975,"end":180744}
    const formattedResults = results.map(result => {
      const { Name, ID, seq_id, start, end } = JSON.parse(result)
      const locString = `${seq_id}:${start}-${end}`
      return new LocStringResult({
        locString,
        label: Name[0],
        matchedAttribute: 'name',
        matchedObject: result,
      })
    })
    return formattedResults
  }
  freeResources() {}
}
