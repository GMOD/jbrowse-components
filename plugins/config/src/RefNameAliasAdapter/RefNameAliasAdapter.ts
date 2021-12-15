import {
  BaseRefNameAliasAdapter,
  BaseAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { readConfObject } from '@jbrowse/core/configuration'

export default class RefNameAliasAdapter
  extends BaseAdapter
  implements BaseRefNameAliasAdapter
{
  async getRefNameAliases() {
    const loc = readConfObject(this.config, 'location')
    if (loc.uri === '' || loc.uri === '/path/to/my/aliases.txt') {
      return []
    }
    const results = await openLocation(loc).readFile('utf8')
    return results
      .trim()
      .split('\n')
      .map((row: string) => {
        const [refName, ...aliases] = row.split('\t')
        return { refName, aliases }
      })
  }

  async freeResources() {}
}
