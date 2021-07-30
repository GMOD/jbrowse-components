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

  metaUrl: string

  indexingAttributes?: string[]
  trixJs: Trix
  tracksNames?: string[]

  constructor(config: Instance<typeof MyConfigSchema>) {
    super(config)
    const ixFilePath = readConfObject(config, 'ixFilePath')
    const ixxFilePath = readConfObject(config, 'ixxFilePath')
    const metaFilePath = readConfObject(config, 'metaFilePath')
    if (!metaFilePath) {
      throw new Error('must provide meta.json')
    }
    if (!ixFilePath) {
      throw new Error('must provide out.ix')
    }
    if (!ixxFilePath) {
      throw new Error('must provide out.ixx')
    }
    this.ixUrl = new URL(ixFilePath.uri, ixFilePath.baseUri).href
    this.ixxUrl = new URL(ixxFilePath.uri, ixxFilePath.baseUri).href
    this.metaUrl = new URL(metaFilePath.uri, metaFilePath.baseUri).href
    this.trixJs = new Trix(
      new RemoteFile(this.ixxUrl),
      new RemoteFile(this.ixUrl),
    )
  }

  async readMeta() {
    const metadata = (await new RemoteFile(this.metaUrl).readFile(
      'utf8',
    )) as string
    return JSON.parse(metadata).indexingAttributes
  }

  async getAttributes() {
    if (this.indexingAttributes) {
      return this.indexingAttributes
    }
    this.indexingAttributes = await this.readMeta()
    return this.indexingAttributes
  }
  /**
   * Returns list of results
   * @param args - search options/arguments include: search query
   * limit of results to return, searchType...preffix | full | exact", etc.
   */
  async searchIndex(args: BaseArgs) {
    const { queryString } = args
    let buff: string[]
    const searchResults: Object[] = []
    const results = await this.trixJs.search(queryString)

    const attr = await this.getAttributes()
    if (attr) {
      results.forEach(data => {
        buff = JSON.parse(Buffer.from(data, 'base64').toString('utf8'))
        const record: Record<string, string> = {}
        for (const x in buff) {
          if (!buff[x].includes('attributePlaceholder')) {
            record[attr[x]] = buff[x]
          }
        }
        searchResults.push(record)
      })
    }
    return this.formatResults(searchResults)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formatResults(results: Array<any>) {
    return results.map(result => {
      const { Name, ID, locstring, TrackID } = result
      const locString = locstring?.replace(/;/g, ':')
      return new LocStringResult({
        locString,
        label: Name[0] || ID[0],
        matchedAttribute: Name[0] ? 'name' : 'id',
        matchedObject: result,
        trackId: TrackID,
      })
    })
  }
  freeResources() {}
}
