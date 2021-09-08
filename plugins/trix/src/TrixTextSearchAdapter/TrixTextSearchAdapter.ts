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
      openLocation(ixxFilePath),
      openLocation(ixFilePath),
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
    const formatted = results.map(entry => {
      const [term, data] = entry.split(',')
      const result = JSON.parse(data.replace(/\|/g, ',')) as string[]
      const [loc, trackId, ...rest] = result.map(record =>
        decodeURIComponent(record),
      )

      const idx = rest.findIndex(elt => elt.toLowerCase().indexOf(term) !== -1)
      const searchString = rest.find(elt => !!elt) as string

      let context = rest[idx]
      const w = 15
      if (context.length > 40) {
        const tidx = context.indexOf(term)
        context =
          '...' + context.slice(tidx - w, tidx + term.length + w).trim() + '...'
      }
      return new LocStringResult({
        locString: loc,
        label: rest.find(elt => !!elt) as string,
        displayString: `${searchString} (${context})`,
        matchedObject: result,
        trackId,
      })
    })

    if (args.searchType === 'exact') {
      return formatted.filter(
        res => res.getLabel().toLowerCase() === args.queryString.toLowerCase(),
      )
    }
    return formatted
  }

  freeResources() {}
}
