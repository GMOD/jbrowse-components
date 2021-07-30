import Trix from '@gmod/trix'
import {
  BaseTextSearchAdapter,
  BaseArgs,
  BaseAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { LocStringResult } from '@jbrowse/core/TextSearch/BaseResults'
import { readConfObject } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'

export default class TrixTextSearchAdapter
  extends BaseAdapter
  implements BaseTextSearchAdapter {
  indexingAttributes?: string[]
  trixJs: Trix
  tracksNames?: string[]

  constructor(config: AnyConfigurationModel) {
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
    this.trixJs = new Trix(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      openLocation(ixxFilePath) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      openLocation(ixFilePath) as any,
      200,
    )
  }

  async readMeta() {
    const meta = readConfObject(this.config, 'metaFilePath')
    const metadata = (await openLocation(meta).readFile('utf8')) as string
    return JSON.parse(metadata).indexingAttributes
  }

  async getAttributes() {
    if (this.indexingAttributes) {
      return this.indexingAttributes
    }
    this.indexingAttributes = await this.readMeta()
    return this.indexingAttributes
  }
  /*
   * Returns list of results
   * @param args - search options/arguments include: search query
   * limit of results to return, searchType...prefix | full | exact", etc.
   */
  async searchIndex(args: BaseArgs) {
    const results = await this.trixJs.search(args.queryString)

    return this.formatResults(
      results.map(
        data =>
          JSON.parse(Buffer.from(data, 'base64').toString('utf8')) as string[],
      ),
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formatResults(results: Array<any>) {
    return results.map(result => {
      const [locString, trackId, name, id] = result
      return new LocStringResult({
        locString,
        label: name || id,
        matchedAttribute: 'name',
        matchedObject: result,
        trackId,
      })
    })
  }
  freeResources() {}
}
