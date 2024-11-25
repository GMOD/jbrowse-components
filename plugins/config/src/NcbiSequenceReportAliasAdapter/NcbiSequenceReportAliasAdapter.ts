import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import type { BaseRefNameAliasAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

export default class NcbiSequenceReportAliasAdapter
  extends BaseAdapter
  implements BaseRefNameAliasAdapter
{
  async getRefNameAliases() {
    const loc = this.getConf('location')
    if (loc.uri === '' || loc.uri === '/path/to/my/sequence_report.tsv') {
      return []
    }
    const override = this.getConf('useUcscNameOverride')
    const results = await openLocation(loc, this.pluginManager).readFile('utf8')
    return results
      .split(/\n|\r\n|\r/)
      .slice(1)
      .filter(f => !!f.trim())
      .map(row => row.split('\t'))
      .map(cols => ({
        refName: cols[12]!,
        aliases: [cols[9], cols[6]].filter((f): f is string => !!f),
        override,
      }))
      .filter(f => !!f.refName)
  }

  async freeResources() {}
}
