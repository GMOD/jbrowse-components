import csv from 'csvtojson'

import { parseLocString } from '@jbrowse/core/util'

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
    text: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extendedData?: any
  }[]
}

export interface RowSet {
  isLoaded: boolean
  rows: Row[]
}

export interface ParseOptions {
  hasColumnNameLine?: boolean
  columnNameLineNumber?: number
  selectedAssemblyName?: string
  isValidRefName: (refName: string, assemblyName?: string) => boolean
}

export interface Column {
  name: string
  dataType: { type: string }
  isDerived?: boolean
  derivationFunctionText?: string
}

function guessColumnType(
  rowSet: RowSet,
  columnNumber: number,
  isValidRefName: (refName: string, assemblyName?: string) => boolean,
) {
  const text = rowSet.rows[0].cells[columnNumber].text || ''

  let guessedType = 'Text'

  let parsedLoc
  try {
    parsedLoc = parseLocString(text, isValidRefName)
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
    isValidRefName: () => false,
  },
) {
  // rows is an array of row objects and columnNames
  // is an array of column names (in import order)
  let maxCols = 0
  const rowSet: RowSet = {
    isLoaded: true,
    rows: rows.map((row, rowNumber) => {
      const id = rowNumber + (options.hasColumnNameLine ? 0 : 1)
      if (row.length > maxCols) maxCols = row.length
      return {
        id: String(id),
        cells: row.map((text, columnNumber) => {
          return { columnNumber, text }
        }),
      }
    }),
  }

  // process the column names row if present
  const columnNames: Record<string, string> = {}
  if (options.hasColumnNameLine && options.columnNameLineNumber !== undefined) {
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
    const guessedType = guessColumnType(
      rowSet,
      columnNumber,
      options.isValidRefName,
    )

    // store extendeddata for LocString column
    if (guessedType === 'LocString') {
      rowSet.rows.forEach(row => {
        const cell = row.cells[columnNumber]
        cell.extendedData = parseLocString(cell.text, options.isValidRefName)
      })
    }

    columns[columnNumber] = {
      name: columnNames[columnNumber],
      dataType: {
        type: guessedType,
      },
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

export async function parseCsvBuffer(
  buffer: Buffer,
  options: ParseOptions = {
    hasColumnNameLine: false,
    columnNameLineNumber: 1,
    isValidRefName: () => false,
  },
) {
  const rows = await parseWith(buffer)
  return dataToSpreadsheetSnapshot(rows, options)
}

export async function parseTsvBuffer(
  buffer: Buffer,
  options: ParseOptions = {
    hasColumnNameLine: false,
    columnNameLineNumber: 1,
    isValidRefName: () => false,
  },
) {
  const rows = await parseWith(buffer, { delimiter: '\t' })
  return dataToSpreadsheetSnapshot(rows, options)
}
