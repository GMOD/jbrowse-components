import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

import { readAliasRows } from '../aliasUtils.ts'

import type { RefNameAliasAdapterConfig } from './configSchema.ts'
import type { BaseRefNameAliasAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

// header lines start with '#'; the leading marker belongs to the first column
const isComment = (cols: string[]) => !!cols[0]?.startsWith('#')

// column names from a '#'-prefixed header row, with the marker stripped
const headerNames = (cols: string[]) =>
  cols.map((col, i) => (i === 0 ? col.slice(1) : col).trim())

export default class RefNameAliasAdapter
  extends BaseAdapter<RefNameAliasAdapterConfig>
  implements BaseRefNameAliasAdapter
{
  async getRefNameAliases() {
    const rows = await readAliasRows(
      this.getConf('location'),
      this.pluginManager,
    )
    const refColumn = this.getConf('refNameColumn')
    const refColumnHeaderName = this.getConf('refNameColumnHeaderName')

    const lastHeader = rows.filter(isComment).at(-1)
    const headerCol =
      refColumnHeaderName && lastHeader
        ? headerNames(lastHeader).indexOf(refColumnHeaderName)
        : refColumn
    if (headerCol === -1) {
      throw new Error(
        `refNameColumnHeaderName "${refColumnHeaderName}" not found in alias file header`,
      )
    }

    return rows
      .filter(cols => !isComment(cols))
      .flatMap(cols => {
        // a blank refName column (short/ragged row, leading tab) would map every
        // alias to an empty canonical name in buildRefNameMaps; drop such rows
        const refName = cols[headerCol]?.trim()
        return refName ? [{ refName, aliases: cols.filter(f => !!f.trim()) }] : []
      })
  }
}
