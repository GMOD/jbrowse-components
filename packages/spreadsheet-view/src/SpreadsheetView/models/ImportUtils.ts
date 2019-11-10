import csv from 'csvtojson'
import { TextDecoder } from 'text-encoding-polyfill'

export function bufferToString(buffer: Buffer) {
  return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
}

function parseWith(buffer: Buffer, options = {}) {
  return csv({ noheader: true, output: 'csv', ...options }).fromString(
    bufferToString(buffer),
  )
}

export interface Row {
  id: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extendedData?: any
  cells: {
    text?: string
  }[]
}

export interface RowSet {
  isLoaded: boolean
  rows: Row[]
}

export interface ParseOptions {
  hasColumnNameLine: boolean
  columnNameLineNumber: number
  selectedDatasetName?: string
}

export interface Column {
  name: string
  dataType: { type: string }
  isDerived?: boolean
}

async function dataToSpreadsheetSnapshot(
  rows: string[][],
  options: ParseOptions = {
    hasColumnNameLine: false,
    columnNameLineNumber: 1,
  },
) {
  // rows is an array of row objects and columnNames
  // is an array of column names (in import order)
  let maxCols = 0
  const rowSet: RowSet = {
    isLoaded: true,
    rows: rows.map((row, rowNumber) => {
      if (row.length > maxCols) maxCols = row.length
      return {
        id: String(rowNumber),
        cells: row.map((text, columnNumber) => {
          return { columnNumber, text }
        }),
      }
    }),
  }

  // process the column names row if present
  const columnNames: Record<string, string> = {}
  if (options.hasColumnNameLine) {
    const [colNamesRow] = rowSet.rows.splice(
      options.columnNameLineNumber - 1,
      1,
    )

    if (colNamesRow) {
      colNamesRow.cells.forEach((cell, columnNumber) => {
        columnNames[columnNumber] = cell.text || ''
      })
    }
  }

  const columns: Column[] = []
  const columnDisplayOrder = []
  for (let i = 0; i < maxCols; i += 1) {
    columnDisplayOrder.push(i)
    columns[i] = { name: columnNames[i], dataType: { type: 'Text' } }
  }

  return {
    rowSet,
    columnDisplayOrder,
    hasColumnNames: !!options.hasColumnNameLine,
    columns,
    datasetName: options.selectedDatasetName,
  }
}

export function parseCsvBuffer(
  buffer: Buffer,
  options: ParseOptions = { hasColumnNameLine: false, columnNameLineNumber: 1 },
) {
  return parseWith(buffer).then(rows =>
    dataToSpreadsheetSnapshot(rows, options),
  )
}

export function parseTsvBuffer(
  buffer: Buffer,
  options: ParseOptions = { hasColumnNameLine: false, columnNameLineNumber: 1 },
) {
  return parseWith(buffer, { delimiter: '\t' }).then(rows =>
    dataToSpreadsheetSnapshot(rows, options),
  )
}

export function parseBedBuffer(buffer: Buffer, options: ParseOptions) {
  return parseTsvBuffer(buffer).then(data => {
    const bedColumns = [
      { name: 'chrom', dataType: { type: 'Text' } },
      { name: 'chromStart', dataType: { type: 'Number' } },
      { name: 'chromEnd', dataType: { type: 'Number' } },
      { name: 'name', dataType: { type: 'Text' } },
      { name: 'score', dataType: { type: 'Number' } },
      { name: 'strand', dataType: { type: 'Text' } },
    ]
    data.columns.forEach((col, colNumber) => {
      const bedColumn = bedColumns[colNumber]
      if (bedColumn) {
        col.name = bedColumn.name
        col.dataType = bedColumn.dataType
      }
    })
    data.hasColumnNames = true
    data.datasetName = options.selectedDatasetName

    return data
  })
}

export function parseBedPEBuffer(buffer: Buffer, options: ParseOptions) {
  return parseTsvBuffer(buffer).then(data => {
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
    ]
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const featureData: Record<string, any> = {}
      row.cells.forEach(({ text }, columnNumber) => {
        const bedColumn = bedColumns[columnNumber]
        const val =
          bedColumn && bedColumn.dataType.type === 'Number' && text
            ? parseInt(text, 10)
            : text
        if (bedColumn) {
          // a predefined column
          if (bedColumn.featureField.length === 2) {
            if (!featureData[bedColumn.featureField[0]])
              featureData[bedColumn.featureField[0]] = {}
            featureData[bedColumn.featureField[0]][
              bedColumn.featureField[1]
            ] = val
          } else {
            featureData[bedColumn.featureField[0]] = val
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

    data.datasetName = options.selectedDatasetName

    return data
  })
}
