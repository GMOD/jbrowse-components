import VCF from '@gmod/vcf'
import { VcfFeature } from '@jbrowse/plugin-variants'
import { bufferToString } from './ImportUtils'
import type { Row, RowSet, Column, ParseOptions } from './ImportUtils'
import type { Buffer } from 'buffer'

const vcfCoreColumns: { name: string; type: string }[] = [
  { name: 'CHROM', type: 'Text' }, // 0
  { name: 'POS', type: 'Number' }, // 1
  { name: 'ID', type: 'Text' }, // 2
  { name: 'REF', type: 'Text' }, // 3
  { name: 'ALT', type: 'Text' }, // 4
  { name: 'QUAL', type: 'Number' }, // 5
  { name: 'FILTER', type: 'Text' }, // 6
  { name: 'INFO', type: 'Text' }, // 7
  { name: 'FORMAT', type: 'Text' }, // 8
]

function vcfRecordToRow(vcfParser: any, line: string, lineNumber: number): Row {
  const vcfVariant = vcfParser.parseLine(line)
  const vcfFeature = new VcfFeature({
    variant: vcfVariant,
    parser: vcfParser,
    id: `vcf-${lineNumber}`,
  })

  const data = line.split('\t').map(d => (d === '.' ? '' : d))
  // no format column, add blank
  if (data.length === 8) {
    data.push('')
  }
  const row: Row = {
    id: String(lineNumber + 1),
    extendedData: { vcfFeature: vcfFeature.toJSON() },
    cells: data.map((text, columnNumber) => {
      return {
        columnNumber,
        text,
      }
    }),
  }
  return row
}

export function parseVcfBuffer(buffer: Buffer, options: ParseOptions = {}) {
  const { selectedAssemblyName } = options
  let { header, body } = splitVcfFileHeaderAndBody(bufferToString(buffer))
  const rows: Row[] = []
  const vcfParser = new VCF({ header })
  header = '' // garbage collect
  body.split(/\n|\r\n|\r/).forEach((line: string, lineNumber) => {
    if (/\S/.test(line)) {
      rows.push(vcfRecordToRow(vcfParser, line, lineNumber))
    }
  })
  body = '' // garbage collect

  const rowSet: RowSet = {
    isLoaded: true,
    rows,
  }

  const columnDisplayOrder: number[] = []
  const columns: Column[] = []
  for (let i = 0; i < vcfCoreColumns.length; i += 1) {
    columnDisplayOrder.push(i)
    columns[i] = {
      name: vcfCoreColumns[i]!.name,
      dataType: { type: vcfCoreColumns[i]!.type },
    }
  }
  for (let i = 0; i < vcfParser.samples.length; i += 1) {
    const oi = vcfCoreColumns.length + i
    columnDisplayOrder.push(oi)
    columns[oi] = {
      name: vcfParser.samples[i]!,
      dataType: { type: 'Text' },
    }
  }

  columnDisplayOrder.push(columnDisplayOrder.length)
  columns.unshift({
    name: 'Location',
    dataType: { type: 'LocString' },
    isDerived: true,
    derivationFunctionText: `jexl:{text:row.extendedData.vcfFeature.refName+':'\n
    +row.extendedData.vcfFeature.start+'..'+row.extendedData.vcfFeature.end, extendedData:\n
    {refName:row.extendedData.vcfFeature.refName,start:row.extendedData.vcfFeature.start,end:row.extendedData.vcfFeature.end}}`,
  })

  return {
    rowSet,
    columnDisplayOrder,
    hasColumnNames: true,
    columns,
    assemblyName: selectedAssemblyName,
  }
}

export function splitVcfFileHeaderAndBody(wholeFile: string) {
  // split into header and the rest of the file
  let headerEndIndex = 0
  let prevChar: string | undefined
  for (; headerEndIndex < wholeFile.length; headerEndIndex += 1) {
    const c = wholeFile[headerEndIndex]
    if (prevChar === '\n' && c !== '#') {
      break
    }
    prevChar = c
  }

  return {
    header: wholeFile.slice(0, Math.max(0, headerEndIndex)),
    body: wholeFile.slice(headerEndIndex),
  }
}
