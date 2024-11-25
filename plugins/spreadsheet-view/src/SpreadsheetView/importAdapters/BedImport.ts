import { parseTsvBuffer } from './ImportUtils'
import type { ParseOptions } from './ImportUtils'
import type { Buffer } from 'buffer'

const browserBytes = 'browser '.split('').map(c => c.charCodeAt(0))
const trackBytes = 'track '.split('').map(c => c.charCodeAt(0))
const commentBytes = '#'.split('').map(c => c.charCodeAt(0))

function bytesAreFoundAt(position: number, buffer: Buffer, bytes: number[]) {
  let i = 0
  for (; i < bytes.length; i += 1) {
    if (buffer[position + i] !== bytes[i]) {
      return false
    }
  }
  return true
}

export function removeBedHeaders(buffer: Buffer) {
  // slice off the first lines of the buffer if it starts with one or more
  // header lines
  let i = 0
  for (; i < buffer.length; i += 1) {
    if (
      bytesAreFoundAt(i, buffer, browserBytes) ||
      bytesAreFoundAt(i, buffer, trackBytes) ||
      bytesAreFoundAt(i, buffer, commentBytes)
    ) {
      // consume up to the next newline
      do {
        i += 1
      } while (buffer[i] !== 10)
    } else {
      // end of headers, return
      break
    }
  }
  if (i) {
    return buffer.subarray(i)
  }
  return buffer
}

export async function parseBedBuffer(buffer: Buffer, options: ParseOptions) {
  const b = removeBedHeaders(buffer)
  const data = await parseTsvBuffer(b)

  const bedColumns = [
    { name: 'chrom', dataType: { type: 'LocRef' } },
    { name: 'chromStart', dataType: { type: 'LocStart' } },
    { name: 'chromEnd', dataType: { type: 'LocEnd' } },
    { name: 'name', dataType: { type: 'Text' } },
    { name: 'score', dataType: { type: 'Number' } },
    { name: 'strand', dataType: { type: 'Text' } },
  ] as const

  data.columns.forEach((col, colNumber) => {
    const bedColumn = bedColumns[colNumber]
    if (bedColumn) {
      col.name = bedColumn.name
      col.dataType = bedColumn.dataType
    }
  })
  data.hasColumnNames = true
  data.assemblyName = options.selectedAssemblyName

  data.columnDisplayOrder.push(data.columnDisplayOrder.length)
  data.columns.unshift({
    name: 'Location',
    dataType: { type: 'LocString' },
    isDerived: true,
    derivationFunctionText: `jexl:{text:row.cells[0].text+':'+row.cells[1].text+'..'+row.cells[2].text,\n
    extendedData: {refName: row.cells.ref.text, start: parseInt(row.cells.start.text,10), end: parseInt(row.cells.end.text,10)}}`,
  })
  return data
}

export async function parseBedPEBuffer(buffer: Buffer, options: ParseOptions) {
  const b = removeBedHeaders(buffer)
  const data = await parseTsvBuffer(b)
  interface BedColumn {
    name: string
    dataType: {
      type: string
    }
    featureField: string[]
  }
  const bedColumns: BedColumn[] = [
    { name: 'chrom1', dataType: { type: 'Text' }, featureField: ['refName'] },
    { name: 'start1', dataType: { type: 'Number' }, featureField: ['start'] },
    { name: 'end1', dataType: { type: 'Number' }, featureField: ['end'] },
    {
      name: 'chrom2',
      dataType: { type: 'Text' },
      featureField: ['mate', 'refName'],
    },
    {
      name: 'start2',
      dataType: { type: 'Number' },
      featureField: ['mate', 'start'],
    },
    {
      name: 'end2',
      dataType: { type: 'Number' },
      featureField: ['mate', 'end'],
    },
    { name: 'name', dataType: { type: 'Text' }, featureField: ['name'] },
    { name: 'score', dataType: { type: 'Number' }, featureField: ['score'] },
    { name: 'strand1', dataType: { type: 'Text' }, featureField: ['strand'] },
    {
      name: 'strand2',
      dataType: { type: 'Text' },
      featureField: ['mate', 'strand'],
    },
  ] as const
  data.columns.forEach((col, colNumber) => {
    const bedColumn = bedColumns[colNumber]
    if (bedColumn) {
      col.name = bedColumn.name
      col.dataType = bedColumn.dataType
    }
  })
  data.hasColumnNames = true

  // decorate each row with a feature object in its extendedData
  data.rowSet.rows.forEach((row, rowNumber) => {
    const featureData: Record<string, any> = {}
    row.cells.forEach(({ text }, columnNumber) => {
      const bedColumn = bedColumns[columnNumber]
      const val =
        bedColumn && bedColumn.dataType.type === 'Number' && text
          ? Number.parseFloat(text)
          : text
      if (bedColumn) {
        // a predefined column
        if (bedColumn.featureField.length === 2) {
          if (!featureData[bedColumn.featureField[0]!]) {
            featureData[bedColumn.featureField[0]!] = {}
          }
          featureData[bedColumn.featureField[0]!][bedColumn.featureField[1]!] =
            val
        } else {
          featureData[bedColumn.featureField[0]!] = val
        }
      } else {
        // some other column
        featureData[`column${columnNumber + 1}`] = val
      }
    })
    featureData.uniqueId = `bedpe-${rowNumber}`
    row.extendedData = {
      feature: featureData,
    }
  })

  data.assemblyName = options.selectedAssemblyName

  return data
}
