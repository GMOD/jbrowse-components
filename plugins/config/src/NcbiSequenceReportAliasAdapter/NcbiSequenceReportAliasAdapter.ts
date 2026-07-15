import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

import { readAliasRows } from '../aliasUtils.ts'

import type { NcbiSequenceReportAliasAdapterConfig } from './configSchema.ts'
import type { BaseRefNameAliasAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

// locate a column by its header name, throwing a column-specific error if a
// required one is absent
function requireColumn(header: string[], name: string) {
  const idx = header.indexOf(name)
  if (idx === -1) {
    throw new Error(
      `sequence_report.tsv header is missing required column "${name}"`,
    )
  }
  return idx
}

export default class NcbiSequenceReportAliasAdapter
  extends BaseAdapter<NcbiSequenceReportAliasAdapterConfig>
  implements BaseRefNameAliasAdapter
{
  async getRefNameAliases() {
    const rows = await readAliasRows(
      this.getConf('location'),
      this.pluginManager,
    )
    if (rows.length === 0) {
      return []
    }
    const override = this.getConf('useNameOverride')
    const header = rows[0]!
    const dataRows = rows.slice(1)
    const genBankIdx = requireColumn(header, 'GenBank seq accession')
    const refSeqIdx = requireColumn(header, 'RefSeq seq accession')
    const ucscIdx = requireColumn(header, 'UCSC style name')
    // Sequence name is optional; -1 means absent
    const seqNameIdx = header.indexOf('Sequence name')
    const seqName = (cols: string[]) =>
      seqNameIdx === -1 ? undefined : cols[seqNameIdx]

    // refName comes from the UCSC name, falling back to the Sequence name; the
    // filter guarantees one is present, so every mapped row has a truthy refName
    return dataRows
      .filter(cols => !!cols[ucscIdx] || !!seqName(cols))
      .map(cols => ({
        refName: (cols[ucscIdx] || seqName(cols))!,
        aliases: [
          cols[genBankIdx],
          cols[refSeqIdx],
          cols[ucscIdx],
          seqName(cols),
        ].filter((f): f is string => !!f),
        override,
      }))
  }
}
