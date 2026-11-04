import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

import { readAliasRows } from '../aliasUtils.ts'

import type { NcbiSequenceReportAliasAdapterConfig } from './configSchema.ts'
import type {
  BaseOptions,
  BaseRefNameAliasAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'

// NCBI publishes the same table in two spellings: the Datasets
// `sequence_report.tsv` and the older `<accession>_assembly_report.txt`, whose
// header is the last of its `#` comment lines and which UCSC GenArk hubs ship.
// Each column is listed by both names, Datasets' first.
const columnNames = {
  genBank: ['GenBank seq accession', 'GenBank-Accn'],
  refSeq: ['RefSeq seq accession', 'RefSeq-Accn'],
  ucsc: ['UCSC style name', 'UCSC-style-name'],
  sequenceName: ['Sequence name', 'Sequence-Name'],
  role: ['Role', 'Sequence role', 'Sequence-Role'],
  molecule: ['Molecule type', 'Assigned-Molecule-Location/Type'],
}

function findColumn(header: string[], names: string[]) {
  return header.findIndex(h => names.includes(h))
}

function requireColumn(header: string[], names: string[]) {
  const idx = findColumn(header, names)
  if (idx === -1) {
    throw new Error(
      `sequence report header is missing required column "${names[0]}"`,
    )
  }
  return idx
}

function splitHeader(rows: string[][]) {
  const comments = rows.filter(cols => cols[0]!.startsWith('#'))
  const last = comments.at(-1)
  return last
    ? {
        header: [last[0]!.replace(/^#\s*/, ''), ...last.slice(1)],
        dataRows: rows.filter(cols => !cols[0]!.startsWith('#')),
      }
    : { header: rows[0]!, dataRows: rows.slice(1) }
}

export default class NcbiSequenceReportAliasAdapter
  extends BaseAdapter<NcbiSequenceReportAliasAdapterConfig>
  implements BaseRefNameAliasAdapter
{
  async getRefNameAliases(opts?: BaseOptions) {
    const rows = await readAliasRows(
      this.getConf('location'),
      this.pluginManager,
      opts,
    )
    if (rows.length === 0) {
      return []
    }
    const override = this.getConf('useNameOverride')
    const { header, dataRows } = splitHeader(rows)
    const genBankIdx = requireColumn(header, columnNames.genBank)
    const refSeqIdx = requireColumn(header, columnNames.refSeq)
    const ucscIdx = requireColumn(header, columnNames.ucsc)
    const seqNameIdx = findColumn(header, columnNames.sequenceName)
    const roleIdx = findColumn(header, columnNames.role)
    const moleculeIdx = findColumn(header, columnNames.molecule)
    // an assembly report writes `na` where the Datasets file leaves a cell empty
    const cell = (cols: string[], idx: number) => {
      const value = idx === -1 ? undefined : cols[idx]
      return value && value !== 'na' ? value : undefined
    }

    return dataRows.flatMap(cols => {
      const refName = cell(cols, ucscIdx) ?? cell(cols, seqNameIdx)
      const role = cell(cols, roleIdx)
      const molecule = cell(cols, moleculeIdx)
      return refName
        ? [
            {
              refName,
              aliases: [
                cell(cols, genBankIdx),
                cell(cols, refSeqIdx),
                cell(cols, ucscIdx),
                cell(cols, seqNameIdx),
              ].filter(f => f !== undefined),
              override,
              ...(role ? { role } : {}),
              ...(molecule ? { molecule } : {}),
            },
          ]
        : []
    })
  }
}
