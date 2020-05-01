import csv from 'csvtojson'

import { parseLocString } from '@gmod/jbrowse-core/util'

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
  selectedAssemblyName?: string
}

export interface Column {
  name: string
  dataType: { type: string }
  isDerived?: boolean
}

function guessColumnType(rowSet: RowSet, columnNumber: number) {
  const text = rowSet.rows[0].cells[columnNumber].text || ''

  let guessedType = 'Text'

  let parsedLoc
  try {
    parsedLoc = parseLocString(text)
  } catch (error) {
    //
  }
  if (parsedLoc && parsedLoc.refName && typeof parsedLoc.start === 'number') {
    guessedType = 'LocString'
  } else if (/^\d+(\.\d+)?$/.test(text)) {
    guessedType = 'Number'
  }

  // MAYBE TODO: iterate over the rest of the rows to confirm
  // the type for all the rows

  return guessedType
}

function dataToSpreadsheetSnapshot(
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
        id: String(rowNumber + 1),
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

  // make our column definitions
  const columns: Column[] = []
  const columnDisplayOrder = []
  for (let columnNumber = 0; columnNumber < maxCols; columnNumber += 1) {
    columnDisplayOrder.push(columnNumber)
    columns[columnNumber] = {
      name: columnNames[columnNumber],
      dataType: { type: guessColumnType(rowSet, columnNumber) },
    }
  }

  return {
    rowSet,
    columnDisplayOrder,
    hasColumnNames: !!options.hasColumnNameLine,
    columns,
    assemblyName: options.selectedAssemblyName,
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
