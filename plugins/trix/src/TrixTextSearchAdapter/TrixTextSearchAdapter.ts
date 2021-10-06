import Trix from '@gmod/trix'
import {
  BaseTextSearchAdapter,
  BaseArgs,
  BaseAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { readConfObject } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'

function shorten(str: string, term: string, w = 15) {
  const tidx = str.indexOf(term)

  return str.length < 40
    ? str
    : (Math.max(0, tidx - w) > 0 ? '...' : '') +
        str.slice(Math.max(0, tidx - w), tidx + term.length + w).trim() +
        (tidx + term.length < str.length ? '...' : '')
}

export default class TrixTextSearchAdapter
  extends BaseAdapter
  implements BaseTextSearchAdapter
{
  indexingAttributes?: string[]
  trixJs: Trix
  tracksNames?: string[]

  constructor(config: AnyConfigurationModel, pluginManager: PluginManager) {
    super(config, pluginManager)
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

      const labelFieldIdx = rest.findIndex(elt => !!elt)
      const contextIdx = rest
        .map(elt => elt.toLowerCase())
        .findIndex(f => f.indexOf(term.toLowerCase()) !== -1)

      const labelField = rest[labelFieldIdx]
      const contextField = rest[contextIdx]
      const context =
        contextIdx !== -1 && contextIdx !== labelFieldIdx
          ? shorten(contextField, term)
          : undefined
      const label = shorten(labelField, term)

      const displayString =
        !context || labelField.toLowerCase() === context.toLowerCase()
          ? label
          : `${labelField} (${context})`

      return new BaseResult({
        locString: loc,
        label: labelField,
        displayString,
        matchedObject: result.map(record => decodeURIComponent(record)),
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
