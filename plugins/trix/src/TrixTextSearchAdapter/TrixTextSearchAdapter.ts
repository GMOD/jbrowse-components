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
  const tidx = str.toLowerCase().indexOf(term.toLowerCase())
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
      throw new Error('TrixTextSearchAdapter requires an ixFilePath')
    }
    if (!ixxFilePath) {
      throw new Error('TrixTextSearchAdapter requires an ixxFilePath')
    }
    this.trixJs = new Trix(
      openLocation(ixxFilePath, pluginManager),
      openLocation(ixFilePath, pluginManager),
      1500,
    )
  }

  /**
   * Returns list of results
   * @param args - search options/arguments include: search query,
   * searchType (prefix | full | exact), etc.
   */
  async searchIndex(args: BaseTextSearchArgs) {
    const query = args.queryString.toLowerCase()
    const words = query.split(' ')
    const results = await this.trixJs.search(query)
    const formatted = results
      .map(([term, data]) => {
        // record is ["loc"|"trackId"|"attr1"|...] with commas pre-encoded as
        // pipes; swap them back to parse it as a JSON array, then URI-decode
        const [loc, trackId, ...attrs] = (
          JSON.parse(data.replaceAll('|', ',')) as string[]
        ).map(decodeURIComponentNoThrow)
        return { term, loc, trackId, attrs }
      })
      // multi-word search: keep only entries whose attributes contain every word
      .filter(({ attrs }) => {
        const lower = attrs.join(' ').toLowerCase()
        return words.every(w => lower.includes(w))
      })
      .map(({ term, loc, trackId, attrs }) => {
        const termLower = term.toLowerCase()
        const labelField = attrs.find(Boolean) ?? ''
        const contextField = attrs.find(f => f.toLowerCase().includes(termLower))
        const context = contextField ? shorten(contextField, term) : undefined
        const label = shorten(labelField, term)

        const displayString =
          !context || label.toLowerCase() === context.toLowerCase()
            ? label
            : `${label} (${context})`

        // exact match succeeds when any indexed attribute (name, id,
        // description, ...) equals the query, so e.g. searching an ID works
        const exact = attrs.some(a => a.toLowerCase() === query)

        return {
          exact,
          result: new BaseResult({
            locString: loc,
            label,
            displayString,
            trackId,
          }),
        }
      })

    const matches =
      args.searchType === 'exact'
        ? formatted.filter(({ exact }) => exact)
        : formatted
    return matches.map(({ result }) => result)
  }
}
