import {
  BaseRefNameAliasAdapter,
  BaseAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'

export default class NcbiSequenceReportAliasAdapter
  extends BaseAdapter
  implements BaseRefNameAliasAdapter
{
  async getRefNameAliases() {
    const loc = this.getConf('location')
    if (loc.uri === '' || loc.uri === '/path/to/my/sequence_report.tsv') {
      return []
    }
    const results = await openLocation(loc, this.pluginManager).readFile('utf8')
    const colNames = results.split(/\n|\r\n|\r/)[0].split('\t')
    const res = Object.fromEntries(
      results
        .split(/\n|\r\n|\r/)
        .map(row => row.trim())
        .filter(f => !!f && !f.startsWith('#'))
        .map(row => {
          const cols = row.split('\t')
          return cols.map((c, i) => [colNames[i], c])
        }),
    )
    console.log({ res })
    return []
  }

  async freeResources() {}
}
