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
    this.ixUrl = ixFilePath.baseUri
      ? new URL(ixFilePath.uri, ixFilePath.baseUri).href
      : ixFilePath.uri
    this.ixxUrl = ixxFilePath.baseUri
      ? new URL(ixxFilePath.uri, ixxFilePath.baseUri).href
      : ixxFilePath.uri
    this.metaUrl = metaFilePath.baseUri
      ? new URL(metaFilePath.uri, metaFilePath.baseUri).href
      : metaFilePath.uri
    const ixFile = new RemoteFile(this.ixUrl)
    const ixxFile = new RemoteFile(this.ixxUrl)
    this.trixJs = new Trix(ixxFile, ixFile)
  }

  async readMeta() {
    try {
      const metaFile = new RemoteFile(this.metaUrl)
      const meta = (await metaFile.readFile('utf8')) as string
      if (meta !== '') {
        const metaData = JSON.parse(meta)
        const { indexingAttributes } = metaData
        this.indexingAttributes = indexingAttributes
        return indexingAttributes
      }
      throw new Error('Error parsing meta.json')
    } catch (err) {
      console.warn(`Error: ${err}`)
    }
    return []
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
        buff = JSON.parse(Buffer.from(data, 'base64').toString('utf8')).split(
          ',',
        )
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
    if (results.length === 0) {
      return []
    }
    // Example: "locstring:ctgA;13000..17200,TrackID:gff3tabix_genes,Name:Apple2,Note:mRNA with CDSs but no UTRs,ID:cds-Apple2"
    const formattedResults = results.map(result => {
      const { Name, ID, locstring, TrackID } = result
      const locString = locstring.replace(/;/g, ':')
      return new LocStringResult({
        locString,
        label: Name || ID,
        matchedAttribute: Name ? 'name' : 'id',
        matchedObject: result,
        trackId: TrackID,
      })
    })
    return formattedResults
  }
  freeResources() {}
}
