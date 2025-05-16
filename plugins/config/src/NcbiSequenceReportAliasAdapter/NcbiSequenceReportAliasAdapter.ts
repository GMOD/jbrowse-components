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
    const override = this.getConf('useNameOverride')
    const results = await openLocation(loc, this.pluginManager).readFile('utf8')
    const lines = results
      .split(/\n|\r\n|\r/)
      .filter(f => !!f.trim())
      .map(row => row.split('\t'))

    const r = lines[0] || []
    const genBankIdx = r.indexOf('GenBank seq accession')
    const refSeqIdx = r.indexOf('RefSeq seq accession')
    const ucscIdx = r.indexOf('UCSC style name')
    const seqNameIdx = r.indexOf('Sequence name')
    if (genBankIdx === -1 || refSeqIdx === -1 || ucscIdx === -1) {
      throw new Error(
        'Header line must include "GenBank seq accession", "RefSeq seq accession", "UCSC style name", and "Sequence name"',
      )
    }
    return lines
      .slice(1)
      .filter(cols => !!cols[ucscIdx] || !!cols[seqNameIdx])
      .map(cols => ({
        refName: (cols[ucscIdx] || cols[seqNameIdx])!,
        aliases: [
          cols[genBankIdx],
          cols[refSeqIdx],
          cols[ucscIdx],
          cols[seqNameIdx],
        ].filter((f): f is string => !!f),
        override,
      }))
      .filter(f => !!f.refName)
  }
}
