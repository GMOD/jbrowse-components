import VCF from '@gmod/vcf'
import { bufferToString, Row, RowSet } from './ImportUtils'

const vcfCoreColumns = [
  'CHROM', // 0
  'POS', // 1
  'ID', // 2
  'REF', // 3
  'ALT', // 4
  'QUAL', // 5
  'FILTER', // 6
  'INFO', // 7
  'FORMAT', // 8
]

// const formatters: Record<string, Function> = {
//   ALT: (altArr: string[]): string => altArr.join(','),

// }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function vcfRecordToRow(vcfParser: any, line: string, lineNumber: number): Row {
  // const record = vcfParser.parseLine(line)
  // if (!record) console.log(`no parse for "${line}"`)
  // const cells = [
  //   ...vcfCoreColumns.map((colName, columnNumber) => {
  //     const text = formatters[colName]
  //       ? formatters[colName](record[colName])
  //       : String(record[colName])
  //     return { columnNumber, text, dataType: 'text' }
  //   }),
  //   ...vcfParser.samples.map((sampleName: string, sampleNumber: number) => {
  //     return {
  //       columnNumber: vcfCoreColumns.length + sampleNumber,
  //       text: record.SAMPLES[sampleName],
  //       dataType: 'text',
  //     }
  //   }),
  // ]
  const data = line.split('\t')
  const row: Row = {
    id: data[2] || String(lineNumber),
    cells: data.map((text, columnNumber) => {
      return {
        columnNumber,
        text,
        dataType: 'text',
      }
    }),
  }
  return row
}

export function parseVcfBuffer(buffer: Buffer) {
  let { header, body } = splitVcfFileHeaderAndBody(bufferToString(buffer))
  const rows: Row[] = []
  const vcfParser = new VCF({ header })
  header = '' // garbage collect
  body.split('\n').forEach((line: string, lineNumber) => {
    if (/\S/.test(line)) rows.push(vcfRecordToRow(vcfParser, line, lineNumber))
  })
  body = '' // garbage collect

  const rowSet: RowSet = {
    isLoaded: true,
    rows,
  }

  const columnDisplayOrder: number[] = []
  const columnNames: Record<number, string> = {}

  for (let i = 0; i < vcfCoreColumns.length; i += 1) {
    columnDisplayOrder.push(i)
    columnNames[i] = vcfCoreColumns[i]
  }
  for (let i = 0; i < vcfParser.samples.length; i += 1) {
    const oi = vcfCoreColumns.length + i
    columnDisplayOrder.push(oi)
    columnNames[oi] = vcfParser.samples[i]
  }

  return { rowSet, columnDisplayOrder, hasColumnNames: true, columnNames }
}

export function splitVcfFileHeaderAndBody(wholeFile: string) {
  // split into header and the rest of the file
  let headerEndIndex = 0
  let prevChar
  for (; headerEndIndex < wholeFile.length; headerEndIndex += 1) {
    const c = wholeFile[headerEndIndex]
    if (prevChar === '\n' && c !== '#') break
    prevChar = c
  }

  return {
    header: wholeFile.substr(0, headerEndIndex),
    body: wholeFile.substr(headerEndIndex),
  }
}
