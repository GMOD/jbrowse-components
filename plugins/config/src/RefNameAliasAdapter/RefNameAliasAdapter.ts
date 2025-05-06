import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'

import type { BaseRefNameAliasAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

export default class RefNameAliasAdapter
  extends BaseAdapter
  implements BaseRefNameAliasAdapter
{
  async getRefNameAliases() {
    const loc = this.getConf('location')
    if (loc.uri === '' || loc.uri === '/path/to/my/aliases.txt') {
      return []
    }
    const results = await openLocation(loc, this.pluginManager).readFile('utf8')
    const refColumn = this.getConf('refNameColumn')
    const refColumnHeaderName = this.getConf('refNameColumnHeaderName')
    const lines = results
      .trim()
      .split(/\n|\r\n|\r/)
      .filter(f => !!f)
    const header = lines.filter(f => f.startsWith('#'))
    const headerCol =
      refColumnHeaderName && header.length
        ? header
            .at(-1)!
            .slice(1)
            .split('\t')
            .map(t => t.trim())
            .indexOf(refColumnHeaderName)
        : refColumn
    return lines
      .filter(f => !f.startsWith('#'))
      .map(row => {
        const aliases = row.split('\t')
        const refName = aliases[headerCol]
        return {
          refName: refName!,
          aliases: aliases.filter(f => !!f.trim()),
        }
      })
  }
}
