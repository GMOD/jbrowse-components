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

  /*
   * Returns list of results
   * @param args - search options/arguments include: search query
   * limit of results to return, searchType...prefix | full | exact", etc.
   */
  async searchIndex(args: BaseArgs) {
    const results = await this.trixJs.search(args.queryString)
    const formatted = this.formatResults(
      results.map(data => JSON.parse(data.replaceAll('|', ',')) as string[]),
    )
    if (args.searchType === 'exact') {
      return formatted.filter(
        result =>
          result.getLabel().toLocaleLowerCase() ===
          args.queryString.toLocaleLowerCase(),
      )
    }
    return formatted
  }

  formatResults(results: string[][]) {
    return results.map(result => {
      const [loc, trackId, name, id] = result.map(record =>
        decodeURIComponent(record),
      )
      return new LocStringResult({
        locString: loc,
        label: name || id,
        matchedAttribute: 'name',
        matchedObject: result,
        trackId,
      })
    })
  }
  freeResources() {}
}
