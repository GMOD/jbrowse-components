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

export function shorten(str: string, term: string, w = 15) {
  if (str.length < 40) {
    return str
  }
  const tidx = str.toLowerCase().indexOf(term)
  if (tidx === -1) {
    return `${str.slice(0, 40).trim()}...`
  }
  const start = Math.max(0, tidx - w)
  const end = tidx + term.length + w
  return (
    (start > 0 ? '...' : '') +
    str.slice(start, end).trim() +
    (end < str.length ? '...' : '')
  )
}

export default class TrixTextSearchAdapter
  extends BaseAdapter
  implements BaseTextSearchAdapter
{
  trixJs: Trix

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
      .filter(([, data]) => {
        const lower = decodeURIComponentNoThrow(data).toLowerCase()
        return strs.every(r => lower.includes(r))
      })
      .map(([term, data]) => {
        const decoded = (JSON.parse(data.replaceAll('|', ',')) as string[]).map(
          decodeURIComponentNoThrow,
        )
        const [loc, trackId, ...rest] = decoded

        const labelField = rest.find(elt => !!elt) ?? ''
        const termLower = term.toLowerCase()
        const contextIdx = rest.findIndex(f =>
          f.toLowerCase().includes(termLower),
        )
        const context =
          contextIdx !== -1 ? shorten(rest[contextIdx]!, term) : undefined
        const label = shorten(labelField, term)

        const displayString =
          !context || label.toLowerCase() === context.toLowerCase()
            ? label
            : `${label} (${context})`

        return new BaseResult({
          locString: loc,
          label: labelField,
          displayString,
          matchedObject: decoded,
          trackId,
        })
      })

    return args.searchType === 'exact'
      ? formatted.filter(
          r => r.getLabel().toLowerCase() === args.queryString.toLowerCase(),
        )
      : formatted
  }
}
