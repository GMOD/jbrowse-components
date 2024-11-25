import Trix from '@gmod/trix'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { readConfObject } from '@jbrowse/core/configuration'
import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  BaseTextSearchAdapter,
  BaseTextSearchArgs,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'

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
  async searchIndex(args: BaseTextSearchArgs) {
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
        const result = JSON.parse(data.replaceAll('|', ',')) as string[]
        const [loc, trackId, ...rest] = result.map(record =>
          decodeURIComponentNoThrow(record),
        )

        const labelFieldIdx = rest.findIndex(elt => !!elt)
        const contextIdx = rest
          .map(elt => elt.toLowerCase())
          .findIndex(f => f.includes(term.toLowerCase()))

        const labelField = rest[labelFieldIdx]!
        const contextField = rest[contextIdx]!
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

    return args.searchType === 'exact'
      ? formatted.filter(
          r => r.getLabel().toLowerCase() === args.queryString.toLowerCase(),
        )
      : formatted
  }

  freeResources() {}
}
