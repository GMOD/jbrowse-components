import Trix from '@gmod/trix'
import {
  BaseTextSearchAdapter,
  BaseArgs,
  BaseAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'

function decodeURIComponentNoThrow(uri: string) {
  try {
    return decodeURIComponent(uri)
  } catch (e) {
    // avoid throwing exception on a failure to decode URI component
    return uri
  }
}

function shorten(str: string, term: string, w = 15) {
  const tidx = str.toLowerCase().indexOf(term)

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

  constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const ixFilePath = readConfObject(config, 'ixFilePath')
    const ixxFilePath = readConfObject(config, 'ixxFilePath')

    if (!ixFilePath) {
      throw new Error('must provide out.ix')
    }
    if (!ixxFilePath) {
      throw new Error('must provide out.ixx')
    }
    this.trixJs = new Trix(
      openLocation(ixxFilePath, pluginManager),
      openLocation(ixFilePath, pluginManager),
      1500,
    )
  }

  /**
   * Returns list of results
   * @param args - search options/arguments include: search query
   * limit of results to return, searchType...prefix | full | exact", etc.
   */
  async searchIndex(args: BaseArgs) {
    const query = args.queryString.toLowerCase()
    const strs = query.split(' ')
    const results = await this.trixJs.search(query)
    const formatted = results
      // if multi-word search try to filter out relevant items
      .filter(([, data]) =>
        strs.every(r =>
          decodeURIComponentNoThrow(data).toLowerCase().includes(r),
        ),
      )
      .map(([term, data]) => {
        const result = JSON.parse(data.replace(/\|/g, ',')) as string[]
        const [loc, trackId, ...rest] = result.map(record =>
          decodeURIComponentNoThrow(record),
        )

        const labelFieldIdx = rest.findIndex(elt => !!elt)
        const contextIdx = rest
          .map(elt => elt.toLowerCase())
          .findIndex(f => f.includes(term.toLowerCase()))

        const labelField = rest[labelFieldIdx]
        const contextField = rest[contextIdx]
        const context =
          contextIdx !== -1 ? shorten(contextField, term) : undefined
        const label = shorten(labelField, term)

        const displayString =
          !context || label.toLowerCase() === context.toLowerCase()
            ? label
            : `${label} (${context})`

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
