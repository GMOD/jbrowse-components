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
    return results
      .trim()
      .split(/\n|\r\n|\r/)
      .filter(f => !!f && !f.startsWith('#'))
      .map(row => {
        const aliases = row.split('\t')
        const [refName] = aliases.splice(refColumn, 1)
        return {
          refName: refName!,
          aliases: aliases.filter(f => !!f.trim()),
        }
      })
  }

  async freeResources() {}
}
