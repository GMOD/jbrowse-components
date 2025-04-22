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
    const lines = results
      .split(/\n|\r\n|\r/)
      .filter(f => !!f.trim())
      .map(row => row.split('\t'))

    const r = lines[0] || []
    const idx0 = r.indexOf('GenBank seq accession')
    const idx1 = r.indexOf('RefSeq seq accession')
    const idx2 = r.indexOf('UCSC style name')
    const idx3 = r.indexOf('Sequence name')
    if (idx0 === -1 || idx1 === -1 || idx2 === -1) {
      throw new Error(
        'Header line must include "GenBank seq accession", "RefSeq seq accession", "UCSC style name", and "Sequence name"',
      )
    }
    return lines
      .slice(1)
      .filter(cols => !!cols[idx2] || !!cols[idx3])
      .map(cols => ({
        refName: (cols[idx2] || cols[idx3])!,
        aliases: [cols[idx0], cols[idx1], cols[idx2], cols[idx3]].filter(
          (f): f is string => !!f,
        ),
        override,
      }))
      .filter(f => !!f.refName)
  }
}
